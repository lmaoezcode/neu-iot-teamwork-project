#include "mqtt_gateway.hpp"

#include <ArduinoJson.h>
#include <esp_system.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "protocol.hpp"
#include "runtime_config.hpp"

namespace smartroom::esp32 {
namespace {

constexpr size_t kMaximumJsonPayload = 2048;
constexpr uint32_t kMinimumTrustedEpoch = 1704067200UL;  // 2024-01-01 UTC

void copyText(char* destination, size_t capacity, const char* source) {
  if (capacity == 0) return;
  if (source == nullptr) source = "";
  snprintf(destination, capacity, "%s", source);
}

bool sameText(const char* left, const char* right) {
  return left != nullptr && right != nullptr && strcmp(left, right) == 0;
}

bool validIdentifier(const char* value, size_t maximumLength) {
  if (value == nullptr) return false;
  const size_t length = strlen(value);
  if (length == 0 || length > maximumLength) return false;
  for (size_t i = 0; i < length; ++i) {
    const char c = value[i];
    if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9') && c != '-' && c != '_') return false;
  }
  return true;
}

bool parseIsoUtc(const char* text, time_t& result) {
  if (text == nullptr || (strlen(text) != 20 && strlen(text) != 24) || text[strlen(text) - 1] != 'Z') return false;
  int year = 0;
  int month = 0;
  int day = 0;
  int hour = 0;
  int minute = 0;
  int second = 0;
  if (sscanf(text, "%4d-%2d-%2dT%2d:%2d:%2dZ", &year, &month, &day, &hour, &minute, &second) != 6) return false;
  if (year < 2024 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return false;
  struct tm value{};
  value.tm_year = year - 1900;
  value.tm_mon = month - 1;
  value.tm_mday = day;
  value.tm_hour = hour;
  value.tm_min = minute;
  value.tm_sec = second;
  value.tm_isdst = 0;
  result = mktime(&value);
  if (result < static_cast<time_t>(kMinimumTrustedEpoch)) return false;
  struct tm normalized{};
  gmtime_r(&result, &normalized);
  return normalized.tm_year == year - 1900 && normalized.tm_mon == month - 1 && normalized.tm_mday == day &&
      normalized.tm_hour == hour && normalized.tm_min == minute && normalized.tm_sec == second;
}

const char* qualityName(DataQuality value) {
  switch (value) {
    case QUALITY_VALID: return "valid";
    case QUALITY_STALE: return "stale";
    default: return "invalid";
  }
}

const char* safetyName(SafetyState value) {
  switch (value) {
    case SAFETY_WARMING: return "warming";
    case SAFETY_NORMAL: return "normal";
    case SAFETY_ALERT: return "alert";
    default: return "sensor_fault";
  }
}

const char* roomName(RoomProfile value) {
  switch (value) {
    case PROFILE_HOME: return "home";
    case PROFILE_AWAY: return "away";
    default: return "night";
  }
}

const char* modeName(ControlMode value) { return value == MODE_MANUAL ? "manual" : "auto"; }

const char* sourceName(ControlSource value) {
  switch (value) {
    case SOURCE_POWER: return "power_protection";
    case SOURCE_SAFETY: return "safety";
    case SOURCE_SECURITY: return "security";
    case SOURCE_PROFILE: return "room_profile";
    case SOURCE_MANUAL: return "manual";
    default: return "auto";
  }
}

const char* lockName(LockCommand value) {
  switch (value) {
    case LOCK_LOCKED: return "locked";
    case LOCK_UNLOCKED: return "unlocked";
    default: return "unknown";
  }
}

const char* lifecycleName(AlertLifecycle value) {
  switch (value) {
    case ALERT_NORMAL: return "normal";
    case ALERT_SOUNDING: return "sounding";
    case ALERT_MUTED: return "muted";
    default: return "awaiting_ack";
  }
}

const char* severityName(Severity value) {
  switch (value) {
    case SEVERITY_INFO: return "info";
    case SEVERITY_NOTICE: return "notice";
    case SEVERITY_WARNING: return "warning";
    default: return "critical";
  }
}

const char* alertTypeName(AlertType value) {
  switch (value) {
    case ALERT_SAFETY: return "safety";
    case ALERT_SECURITY: return "security";
    default: return "system";
  }
}

const char* alertSourceName(AlertSource value) {
  switch (value) {
    case SOURCE_MQ2: return "mq2";
    case SOURCE_FLAME: return "flame";
    case SOURCE_DOOR: return "door_zone";
    case SOURCE_LIGHT: return "light";
    case SOURCE_LINK: return "link";
    case SOURCE_POWER_ALERT: return "power";
    case SOURCE_MR01: return "mr01";
    default: return "system";
  }
}

const char* alertOperationName(AlertOperation value) {
  switch (value) {
    case ALERT_ADD: return "add";
    case ALERT_CLEAR: return "clear";
    case ALERT_REACTIVATE: return "retrigger";
    default: return "snapshot";
  }
}

const char* eventTypeName(uint8_t value) {
  static constexpr const char* names[] = {
      "boot", "sensor_fault", "sensor_recovered", "device_state_changed", "room_profile_changed",
      "control_mode_changed", "config_applied", "config_rejected", "link_state_changed", "queue_overflow",
      "local_mute", "alert_acknowledged", "power_protection_changed"};
  return value < sizeof(names) / sizeof(names[0]) ? names[value] : "unknown_event";
}

const char* reasonName(uint16_t value) {
  switch (value) {
    case REASON_OK: return "none";
    case REASON_UNSUPPORTED_VERSION: return "unsupported_version";
    case REASON_UNSUPPORTED_TYPE: return "unsupported_type";
    case REASON_INVALID_LENGTH: return "invalid_length";
    case REASON_INVALID_ENUM: return "invalid_enum";
    case REASON_INVALID_RESERVED_BITS: return "invalid_reserved_bits";
    case REASON_CRC_ERROR: return "crc_error";
    case REASON_FRAME_TOO_LARGE: return "frame_too_large";
    case REASON_SESSION_NOT_READY: return "device_syncing";
    case REASON_SESSION_MISMATCH: return "session_mismatch";
    case REASON_SEQUENCE_CONFLICT: return "sequence_conflict";
    case REASON_CORRELATION_REUSE_CONFLICT: return "correlation_reuse_conflict";
    case REASON_BUSY: return "device_busy";
    case REASON_VALUE_OUT_OF_RANGE: return "value_out_of_range";
    case REASON_CONFIG_RELATION_INVALID: return "config_invalid";
    case REASON_STALE_CONFIG_VERSION: return "stale_config_version";
    case REASON_STALE_STATE_VERSION: return "state_version_conflict";
    case REASON_CONFIG_VERSION_CONFLICT: return "config_version_conflict";
    case REASON_ROOM_PROFILE_BLOCK: return "room_profile_block";
    case REASON_MANUAL_CONFIRM_REQUIRED: return "manual_confirmation_required";
    case REASON_SECURITY_BLOCK: return "security_alert_active";
    case REASON_ALERT_CAUSE_ACTIVE: return "safety_alert_active";
    case REASON_SENSOR_INVALID: return "sensor_invalid";
    case REASON_POWER_PROTECTION_ACTIVE: return "power_protection_active";
    case REASON_APPLY_FAILED: return "apply_failed";
    case REASON_QUEUE_FULL: return "queue_full";
    case REASON_SNAPSHOT_CHANGED: return "snapshot_changed";
    case REASON_LINK_TIMEOUT: return "uart_timeout";
    default: return "unknown_reason";
  }
}

void fillEnvelope(JsonDocument& document, const char* messageId, const char* deviceId, uint32_t espBootId,
                  uint32_t unoBootId, uint32_t linkSessionId, const char* timestamp) {
  document["schema"] = "smartroom.mqtt";
  document["schema_version"] = 1;
  document["message_id"] = messageId;
  document["device_id"] = deviceId;
  if (timestamp != nullptr) document["sent_at"] = timestamp;
  else document["sent_at"] = nullptr;
  document["time_quality"] = timestamp == nullptr ? "unsynced" : "synced";
  document["esp_boot_id"] = espBootId;
  document["uno_boot_id"] = unoBootId;
  document["link_session_id"] = linkSessionId;
}

bool serializeBounded(JsonDocument& document, char* output, size_t capacity, size_t& length) {
  length = measureJson(document);
  if (length == 0 || length > kMaximumJsonPayload || length + 1U > capacity) return false;
  return serializeJson(document, output, capacity) == length;
}

bool jsonUint32(JsonVariantConst value, uint32_t& output) {
  if (!value.is<uint32_t>()) return false;
  output = value.as<uint32_t>();
  return true;
}

bool jsonUint16(JsonVariantConst value, uint16_t& output) {
  uint32_t parsed = 0;
  if (!jsonUint32(value, parsed) || parsed > UINT16_MAX) return false;
  output = static_cast<uint16_t>(parsed);
  return true;
}

bool jsonUint8(JsonVariantConst value, uint8_t& output) {
  uint32_t parsed = 0;
  if (!jsonUint32(value, parsed) || parsed > UINT8_MAX) return false;
  output = static_cast<uint8_t>(parsed);
  return true;
}

bool jsonBoolean(JsonVariantConst value, bool& output) {
  if (!value.is<bool>()) return false;
  output = value.as<bool>();
  return true;
}

bool validInboundEnvelope(JsonObjectConst root, const char* deviceId) {
  uint32_t schemaVersion = 0;
  return !root.isNull() && sameText(root["schema"] | "", "smartroom.mqtt") &&
      jsonUint32(root["schema_version"], schemaVersion) && schemaVersion == 1 &&
      sameText(root["device_id"] | "", deviceId) && validIdentifier(root["message_id"] | "", 64);
}

}  // namespace

MqttGateway::MqttGateway(UnoLink& link, ConfigStore& store, OfflineQueue& queue)
    : link_(link), store_(store), queue_(queue) {}

void MqttGateway::begin(uint32_t espBootId) {
  espBootId_ = espBootId;
  setenv("TZ", "UTC0", 1);
  tzset();

  snprintf(topicRoot_, sizeof(topicRoot_), "smartroom/v1/devices/%s", runtime_config::kDeviceId);
  snprintf(topicAvailability_, sizeof(topicAvailability_), "%s/availability", topicRoot_);
  snprintf(topicTelemetry_, sizeof(topicTelemetry_), "%s/telemetry/sensors", topicRoot_);
  snprintf(topicState_, sizeof(topicState_), "%s/state/reported", topicRoot_);
  snprintf(topicConfigDesired_, sizeof(topicConfigDesired_), "%s/config/desired", topicRoot_);
  snprintf(topicConfigReported_, sizeof(topicConfigReported_), "%s/config/reported", topicRoot_);
  snprintf(topicCommandRequest_, sizeof(topicCommandRequest_), "%s/commands/request", topicRoot_);
  snprintf(topicCommandResult_, sizeof(topicCommandResult_), "%s/commands/result", topicRoot_);
  snprintf(topicEvents_, sizeof(topicEvents_), "%s/events", topicRoot_);
  snprintf(topicAlertEvents_, sizeof(topicAlertEvents_), "%s/alerts/events", topicRoot_);
  snprintf(topicAlertsReported_, sizeof(topicAlertsReported_), "%s/alerts/reported", topicRoot_);
  snprintf(topicSyncRequest_, sizeof(topicSyncRequest_), "%s/sync/request", topicRoot_);
  snprintf(topicSyncStatus_, sizeof(topicSyncStatus_), "%s/sync/status", topicRoot_);
  snprintf(topicDiagnostics_, sizeof(topicDiagnostics_), "%s/diagnostics", topicRoot_);

  networkConfigurationValid_ = networkConfigured() && validDeviceId();
  mqtt_.begin(runtime_config::kMqttHost, runtime_config::kMqttPort, networkClient_);
  mqtt_.setKeepAlive(30);
  mqtt_.setCleanSession(true);
  mqtt_.setTimeout(3000);
  mqtt_.onMessage([this](String& topic, String& payload) { onMqttMessage(topic, payload); });
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  nextWifiAttemptMs_ = millis();

  if (!networkConfigurationValid_) {
    Serial.println("[ESP32] Chua co secrets.hpp hop le; UART/NVS van hoat dong, Wi-Fi/MQTT tam dung.");
  }
}

void MqttGateway::tick(uint32_t nowMs) {
  serviceUnoIdentity();
  serviceWifi(nowMs);
  serviceMqtt(nowMs);
  serviceInbound(nowMs);
  servicePendingCommand(nowMs);
  serviceDesiredConfig();
  serviceReconciliation();
}

void MqttGateway::serviceUnoIdentity() {
  const uint32_t currentBootId = link_.unoBootId();
  if (currentBootId == 0 || currentBootId == observedUnoBootId_) return;

  if (observedUnoBootId_ != 0) {
    for (ActiveCause& cause : activeCauses_) cause = ActiveCause{};
    hasSensor_ = false;
    hasState_ = false;
    hasHealth_ = false;
    reportedConfigValid_ = false;
    retainedSnapshotPublished_ = false;
    if (mqtt_.connected()) {
      networkPhase_ = NetworkPhase::Syncing;
      publishAvailability("syncing", "link_sync");
    }
  }

  observedUnoBootId_ = currentBootId;
  uint32_t storedBootId = 0;
  if (!store_.loadLastUnoBootId(storedBootId) || storedBootId != currentBootId) {
    store_.saveLastUnoBootId(currentBootId);
  }
}

bool MqttGateway::networkConfigured() const {
  return runtime_config::kWifiSsid[0] != '\0' && runtime_config::kMqttHost[0] != '\0' &&
      runtime_config::kMqttUsername[0] != '\0' && runtime_config::kMqttPassword[0] != '\0';
}

bool MqttGateway::validDeviceId() const {
  const char* value = runtime_config::kDeviceId;
  const size_t length = strlen(value);
  if (length < 3 || length > 32 ||
      (!(value[0] >= 'a' && value[0] <= 'z') && !(value[0] >= '0' && value[0] <= '9'))) return false;
  for (size_t i = 1; i < length; ++i) {
    if (!(value[i] >= 'a' && value[i] <= 'z') && !(value[i] >= '0' && value[i] <= '9') && value[i] != '-') return false;
  }
  return true;
}

uint32_t MqttGateway::nextBackoffMs(uint8_t& attempt) const {
  static constexpr uint32_t schedule[] = {1000, 2000, 4000, 8000, 16000, 30000};
  const uint8_t index = attempt < 5 ? attempt : 5;
  if (attempt < 5) ++attempt;
  return schedule[index] + esp_random() % 251U;
}

void MqttGateway::serviceWifi(uint32_t nowMs) {
  if (!networkConfigurationValid_) return;
  if (WiFi.status() == WL_CONNECTED) {
    wifiAttempt_ = 0;
    if (!ntpStarted_) {
      configTime(0, 0, runtime_config::kNtpServer1, runtime_config::kNtpServer2);
      ntpStarted_ = true;
    }
    return;
  }
  if (mqtt_.connected()) mqtt_.disconnect();
  mqttWasConnected_ = false;
  networkPhase_ = NetworkPhase::Disconnected;
  retainedSnapshotPublished_ = false;
  if (static_cast<int32_t>(nowMs - nextWifiAttemptMs_) < 0) return;
  WiFi.begin(runtime_config::kWifiSsid, runtime_config::kWifiPassword);
  nextWifiAttemptMs_ = nowMs + nextBackoffMs(wifiAttempt_);
}

void MqttGateway::serviceMqtt(uint32_t nowMs) {
  if (!networkConfigurationValid_ || WiFi.status() != WL_CONNECTED) return;
  if (mqtt_.connected()) {
    mqtt_.loop();
    mqttWasConnected_ = true;
    return;
  }
  if (mqttWasConnected_) {
    mqttWasConnected_ = false;
    networkPhase_ = NetworkPhase::Disconnected;
    retainedSnapshotPublished_ = false;
  }
  if (static_cast<int32_t>(nowMs - nextMqttAttemptMs_) < 0) return;
  connectMqtt(nowMs);
  if (!mqtt_.connected()) nextMqttAttemptMs_ = nowMs + nextBackoffMs(mqttAttempt_);
}

void MqttGateway::connectMqtt(uint32_t nowMs) {
  char clientId[80] = {};
  snprintf(clientId, sizeof(clientId), "smartroom-%s-device", runtime_config::kDeviceId);
  char willPayload[256] = {};
  snprintf(willPayload, sizeof(willPayload),
           "{\"schema\":\"smartroom.mqtt\",\"schema_version\":1,\"device_id\":\"%s\",\"data\":{\"status\":\"offline\",\"reason\":\"unexpected_disconnect\"}}",
           runtime_config::kDeviceId);
  mqtt_.setWill(topicAvailability_, willPayload, true, 1);
  const bool connected = mqtt_.connect(clientId, runtime_config::kMqttUsername, runtime_config::kMqttPassword);
  if (!connected) return;
  const bool subscribed = mqtt_.subscribe(topicConfigDesired_, 1) && mqtt_.subscribe(topicCommandRequest_, 1) && mqtt_.subscribe(topicSyncRequest_, 1);
  if (!subscribed) {
    mqtt_.disconnect();
    return;
  }
  mqttAttempt_ = 0;
  nextMqttAttemptMs_ = nowMs;
  mqttWasConnected_ = true;
  networkPhase_ = NetworkPhase::Syncing;
  retainedSnapshotPublished_ = false;
  publishAvailability("syncing", "link_sync");
}

void MqttGateway::onMqttMessage(String& topic, String& payload) {
  InboundKind kind = InboundKind::None;
  if (topic == topicConfigDesired_) kind = InboundKind::Config;
  else if (topic == topicCommandRequest_) kind = InboundKind::Command;
  else if (topic == topicSyncRequest_) kind = InboundKind::Sync;
  if (kind != InboundKind::None) enqueueInbound(kind, payload);
}

bool MqttGateway::enqueueInbound(InboundKind kind, const String& payload) {
  if (payload.length() == 0 || payload.length() > kMaximumJsonPayload || inboundCount_ >= 4) {
    ++inboundDrops_;
    return false;
  }
  const uint8_t index = static_cast<uint8_t>((inboundHead_ + inboundCount_) % 4U);
  inbound_[index] = InboundMessage{};
  inbound_[index].kind = kind;
  inbound_[index].receivedAtMs = millis();
  inbound_[index].length = static_cast<uint16_t>(payload.length());
  memcpy(inbound_[index].payload, payload.c_str(), payload.length());
  inbound_[index].payload[payload.length()] = '\0';
  ++inboundCount_;
  return true;
}

bool MqttGateway::dequeueInbound(InboundMessage& message) {
  if (inboundCount_ == 0) return false;
  message = inbound_[inboundHead_];
  inbound_[inboundHead_] = InboundMessage{};
  inboundHead_ = static_cast<uint8_t>((inboundHead_ + 1U) % 4U);
  --inboundCount_;
  return true;
}

void MqttGateway::serviceInbound(uint32_t) {
  if (!mqtt_.connected()) return;
  for (uint8_t processed = 0; processed < 4; ++processed) {
    InboundMessage message{};
    if (!dequeueInbound(message)) break;
    switch (message.kind) {
      case InboundKind::Config: processDesiredConfig(message); break;
      case InboundKind::Command: processCommand(message); break;
      case InboundKind::Sync: processSyncRequest(message); break;
      default: break;
    }
  }
}

bool MqttGateway::processDesiredConfig(const InboundMessage& message) {
  JsonDocument document;
  if (deserializeJson(document, message.payload, message.length) != DeserializationError::Ok) {
    return publishConfigReported(nullptr, "rejected", "invalid_schema");
  }
  JsonObjectConst root = document.as<JsonObjectConst>();
  JsonObjectConst data = root["data"].as<JsonObjectConst>();
  JsonObjectConst settings = data["settings"].as<JsonObjectConst>();
  if (!validInboundEnvelope(root, runtime_config::kDeviceId) || data.isNull() || settings.isNull() ||
      !sameText(data["source"] | "", "server_database")) {
    return publishConfigReported(nullptr, "rejected", "invalid_schema");
  }

  DeviceConfig candidate{};
  if (!jsonUint32(data["config_version"], candidate.version)) return publishConfigReported(nullptr, "rejected", "invalid_schema");
  candidate.fieldMask = kFullConfigMask;
  if (!jsonUint8(settings["light_on_pct"], candidate.lightOnPct) ||
      !jsonUint8(settings["light_off_pct"], candidate.lightOffPct)) {
    return publishConfigReported(&candidate, "rejected", "invalid_schema");
  }
  const char* mode = settings["control_mode"] | "";
  const char* profile = settings["room_profile"] | "";
  if (sameText(mode, "auto")) candidate.controlMode = MODE_AUTO;
  else if (sameText(mode, "manual")) candidate.controlMode = MODE_MANUAL;
  else return publishConfigReported(&candidate, "rejected", "invalid_schema");
  if (sameText(profile, "home")) candidate.roomProfile = PROFILE_HOME;
  else if (sameText(profile, "away")) candidate.roomProfile = PROFILE_AWAY;
  else if (sameText(profile, "night")) candidate.roomProfile = PROFILE_NIGHT;
  else return publishConfigReported(&candidate, "rejected", "invalid_schema");

  JsonObjectConst light = settings["light_calibration"].as<JsonObjectConst>();
  JsonObjectConst mq2 = settings["mq2"].as<JsonObjectConst>();
  JsonObjectConst door = settings["door_zone"].as<JsonObjectConst>();
  if (light.isNull() || mq2.isNull() || door.isNull()) return publishConfigReported(&candidate, "rejected", "invalid_schema");
  if (!jsonUint16(light["dark_adc"], candidate.lightAdcDark) ||
      !jsonUint16(light["bright_adc"], candidate.lightAdcBright) ||
      !jsonUint16(mq2["baseline_adc"], candidate.mq2BaselineAdc) ||
      !jsonUint16(mq2["span_adc"], candidate.mq2SpanAdc) ||
      !jsonUint8(mq2["threshold_pct"], candidate.mq2ThresholdPct) ||
      !jsonUint16(door["threshold_mm"], candidate.doorThresholdMm) ||
      !jsonUint8(door["confirm_samples"], candidate.doorConfirmSamples)) {
    return publishConfigReported(&candidate, "rejected", "invalid_schema");
  }
  bool mq2Calibration = false;
  bool doorCalibration = false;
  bool lightCalibration = false;
  if (!jsonBoolean(mq2["calibration_enabled"], mq2Calibration) ||
      !jsonBoolean(door["calibration_enabled"], doorCalibration) ||
      !jsonBoolean(light["enabled"], lightCalibration)) {
    return publishConfigReported(&candidate, "rejected", "invalid_schema");
  }
  candidate.configFlags = 0;
  if (mq2Calibration) candidate.configFlags |= 1U << 0;
  if (doorCalibration) candidate.configFlags |= 1U << 1;
  if (lightCalibration) candidate.configFlags |= 1U << 2;
  uint16_t reason = REASON_OK;
  if (!validateConfig(candidate, reason)) return publishConfigReported(&candidate, "rejected", reasonName(reason));

  if (link_.hasCachedConfig()) {
    const DeviceConfig& cached = link_.cachedConfig();
    if (candidate.version < cached.version) return publishConfigReported(&candidate, "rejected", "stale_config_version");
    if (candidate.version == cached.version) {
      if (sameConfig(candidate, cached)) return publishConfigReported(&cached, "unchanged", "none");
      return publishConfigReported(&candidate, "rejected", "config_version_conflict");
    }
  }
  if (desiredConfigInFlight_) {
    if (candidate.version < inFlightConfig_.version) return publishConfigReported(&candidate, "rejected", "stale_config_version");
    if (candidate.version == inFlightConfig_.version) {
      if (sameConfig(candidate, inFlightConfig_)) return true;
      return publishConfigReported(&candidate, "rejected", "config_version_conflict");
    }
  }
  if (desiredConfigPending_ && candidate.version < desiredConfig_.version) return true;
  desiredConfig_ = candidate;
  desiredConfigPending_ = true;
  desiredConfigTag_ = candidate.version;
  networkPhase_ = NetworkPhase::Syncing;
  publishConfigReported(&candidate, "pending", "none");
  publishAvailability("syncing", "config_pending");
  return true;
}

void MqttGateway::serviceDesiredConfig() {
  if (!desiredConfigPending_ || desiredConfigInFlight_ || !link_.ready() || pendingCommand_.active) return;
  if (link_.requestConfig(desiredConfig_, desiredConfigTag_)) {
    inFlightConfig_ = desiredConfig_;
    inFlightConfigTag_ = desiredConfigTag_;
    desiredConfigPending_ = false;
    desiredConfigInFlight_ = true;
  }
}

bool MqttGateway::processCommand(const InboundMessage& message) {
  JsonDocument document;
  if (deserializeJson(document, message.payload, message.length) != DeserializationError::Ok) return false;
  JsonObjectConst root = document.as<JsonObjectConst>();
  JsonObjectConst data = root["data"].as<JsonObjectConst>();
  const char* commandId = data["command_id"] | "";
  const uint32_t payloadHash = protocol::fnv1a32(reinterpret_cast<const uint8_t*>(message.payload), message.length);
  if (!validInboundEnvelope(root, runtime_config::kDeviceId) || data.isNull() || !validIdentifier(commandId, 64)) {
    if (validIdentifier(commandId, 64)) publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
    return false;
  }

  if (CommandCacheEntry* cached = findCommandCache(commandId); cached != nullptr) {
    if (cached->payloadHash != payloadHash) return publishCommandResult(commandId, "rejected", "duplicate_command_conflict", nullptr, false);
    const char* result = cached->hasAck && !cached->report.nack ? "duplicate_ok" : cached->terminalResult;
    return publishCommandResult(commandId, result, cached->terminalReason, cached->hasAck ? &cached->report : nullptr, true);
  }
  if (pendingCommand_.active) {
    if (sameText(pendingCommand_.commandId, commandId) && pendingCommand_.payloadHash == payloadHash) return true;
    return publishCommandResult(commandId, "rejected", "device_busy", nullptr, false);
  }

  uint32_t ttlMs = 0;
  if (!jsonUint32(data["ttl_ms"], ttlMs) || ttlMs == 0 || ttlMs > 30000U) {
    rememberCommand(commandId, payloadHash, "rejected", "invalid_ttl", nullptr);
    return publishCommandResult(commandId, "rejected", "invalid_ttl", nullptr, false);
  }
  time_t issued = 0;
  time_t expires = 0;
  if (!parseIsoUtc(data["issued_at"] | "", issued) || !parseIsoUtc(data["expires_at"] | "", expires) ||
      expires < issued || expires - issued > 30) {
    rememberCommand(commandId, payloadHash, "rejected", "invalid_ttl", nullptr);
    return publishCommandResult(commandId, "rejected", "invalid_ttl", nullptr, false);
  }
  if (timeSynced()) {
    if (time(nullptr) > expires) {
      rememberCommand(commandId, payloadHash, "expired", "expired_command", nullptr);
      return publishCommandResult(commandId, "expired", "expired_command", nullptr, false);
    }
  }
  if (!link_.ready() || networkPhase_ != NetworkPhase::Online || strcmp(availabilityStatusForLink(), "online") != 0) {
    rememberCommand(commandId, payloadHash, "rejected", "device_syncing", nullptr);
    return publishCommandResult(commandId, "rejected", "device_syncing", nullptr, false);
  }

  ControlRequest request{};
  if (!jsonUint32(data["expected_state_version"], request.expectedStateVersion) ||
      !jsonUint32(data["base_config_version"], request.baseConfigVersion) ||
      !jsonUint32(data["new_config_version"], request.newConfigVersion)) {
    rememberCommand(commandId, payloadHash, "rejected", "invalid_schema", nullptr);
    return publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
  }
  const char* operation = data["operation"] | "";
  const char* target = data["target"] | "";
  const char* value = data["value"] | "";
  if (sameText(operation, "set_device") && (sameText(target, "lamp") || sameText(target, "fan")) && (sameText(value, "on") || sameText(value, "off"))) {
    request.opcode = OP_SET_DEVICE;
    request.target = sameText(target, "lamp") ? 1 : 2;
    request.value = sameText(value, "on") ? 1 : 0;
  } else if (sameText(operation, "set_control_mode") && sameText(target, "system") && (sameText(value, "auto") || sameText(value, "manual"))) {
    request.opcode = OP_SET_CONTROL_MODE;
    request.target = 0;
    request.value = sameText(value, "manual") ? MODE_MANUAL : MODE_AUTO;
  } else if (sameText(operation, "set_room_profile") && sameText(target, "system") &&
             (sameText(value, "home") || sameText(value, "away") || sameText(value, "night"))) {
    request.opcode = OP_SET_ROOM_PROFILE;
    request.target = 0;
    request.value = sameText(value, "home") ? PROFILE_HOME : sameText(value, "away") ? PROFILE_AWAY : PROFILE_NIGHT;
  } else if (sameText(operation, "set_lock") && sameText(target, "lock") && (sameText(value, "locked") || sameText(value, "unlocked"))) {
    request.opcode = OP_SET_LOCK;
    request.target = 3;
    request.value = sameText(value, "locked") ? LOCK_LOCKED : LOCK_UNLOCKED;
  } else if (sameText(operation, "alert_action") && sameText(target, "alert") && (sameText(value, "mute") || sameText(value, "acknowledge"))) {
    request.opcode = OP_ALERT_ACTION;
    request.target = 4;
    request.value = sameText(value, "mute") ? ALERT_MUTE : ALERT_ACKNOWLEDGE;
  } else {
    rememberCommand(commandId, payloadHash, "rejected", "invalid_command", nullptr);
    return publishCommandResult(commandId, "rejected", "invalid_command", nullptr, false);
  }
  const JsonVariantConst optionsValue = data["options"];
  if (!optionsValue.isNull() && !optionsValue.is<JsonObjectConst>()) {
    return publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
  }
  JsonObjectConst options = optionsValue.as<JsonObjectConst>();
  request.options = 0;
  if (!options.isNull()) {
    bool option = false;
    const JsonVariantConst userConfirmed = options["user_confirmed"];
    const JsonVariantConst forceManual = options["force_manual"];
    const JsonVariantConst transitionHome = options["transition_home"];
    if (!userConfirmed.isNull()) {
      if (!jsonBoolean(userConfirmed, option)) return publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
      if (option) request.options |= 1U << 0;
    }
    if (!forceManual.isNull()) {
      if (!jsonBoolean(forceManual, option)) return publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
      if (option) request.options |= 1U << 1;
    }
    if (!transitionHome.isNull()) {
      if (!jsonBoolean(transitionHome, option)) return publishCommandResult(commandId, "rejected", "invalid_schema", nullptr, false);
      if (option) request.options |= 1U << 2;
    }
  }

  pendingCommand_ = PendingCommand{};
  pendingCommand_.active = true;
  pendingCommand_.payloadHash = payloadHash;
  pendingCommand_.tag = payloadHash == 0 ? 1 : payloadHash;
  pendingCommand_.deadlineMs = message.receivedAtMs + ttlMs;
  pendingCommand_.request = request;
  copyText(pendingCommand_.commandId, sizeof(pendingCommand_.commandId), commandId);
  return true;
}

void MqttGateway::servicePendingCommand(uint32_t nowMs) {
  if (!pendingCommand_.active || pendingCommand_.submitted) return;
  if (static_cast<int32_t>(nowMs - pendingCommand_.deadlineMs) >= 0) {
    publishCommandResult(pendingCommand_.commandId, "expired", "expired_command", nullptr, false);
    rememberCommand(pendingCommand_.commandId, pendingCommand_.payloadHash, "expired", "expired_command", nullptr);
    pendingCommand_ = PendingCommand{};
    return;
  }
  if (!link_.ready() || networkPhase_ != NetworkPhase::Online || strcmp(availabilityStatusForLink(), "online") != 0) {
    publishCommandResult(pendingCommand_.commandId, "unknown", "device_syncing", nullptr, false);
    rememberCommand(pendingCommand_.commandId, pendingCommand_.payloadHash, "unknown", "device_syncing", nullptr);
    pendingCommand_ = PendingCommand{};
    return;
  }
  if (link_.requestControl(pendingCommand_.request, pendingCommand_.tag)) pendingCommand_.submitted = true;
}

bool MqttGateway::processSyncRequest(const InboundMessage& message) {
  JsonDocument document;
  if (deserializeJson(document, message.payload, message.length) != DeserializationError::Ok) return false;
  JsonObjectConst root = document.as<JsonObjectConst>();
  JsonObjectConst data = root["data"].as<JsonObjectConst>();
  const char* syncId = data["sync_id"] | "";
  if (!validInboundEnvelope(root, runtime_config::kDeviceId) || !validIdentifier(syncId, 64)) return false;
  if (activeSyncId_[0] != '\0' || !link_.requestResync()) return publishSyncStatus(syncId, "failed", "device_busy");
  copyText(activeSyncId_, sizeof(activeSyncId_), syncId);
  networkPhase_ = NetworkPhase::Syncing;
  retainedSnapshotPublished_ = false;
  publishAvailability("syncing", "link_sync");
  return publishSyncStatus(activeSyncId_, "started", "none");
}

void MqttGateway::serviceReconciliation() {
  if (!mqtt_.connected() || !link_.ready() || desiredConfigPending_ || desiredConfigInFlight_ || pendingCommand_.active) return;
  if (!retainedSnapshotPublished_) {
    bool ok = true;
    if (hasState_) ok = publishState() && ok;
    if (reportedConfigValid_) ok = publishConfigReported(&reportedConfig_, "unchanged", "none") && ok;
    else if (link_.hasCachedConfig()) ok = publishConfigReported(&link_.cachedConfig(), "unchanged", "none") && ok;
    ok = publishAlertsReported() && ok;
    if (!ok) return;
    retainedSnapshotPublished_ = true;
    networkPhase_ = NetworkPhase::Replaying;
  }
  if (queue_.size() > 0) {
    serviceReplay();
    return;
  }
  if (networkPhase_ != NetworkPhase::Online) {
    networkPhase_ = NetworkPhase::Online;
    overflowMarkerQueued_ = false;
    publishAvailability(availabilityStatusForLink(), availabilityReasonForLink(lastLinkReason_));
    if (activeSyncId_[0] != '\0') {
      publishSyncStatus(activeSyncId_, "completed", "none");
      activeSyncId_[0] = '\0';
    }
  }
}

void MqttGateway::serviceReplay() {
  if (!mqtt_.connected()) return;
  QueuedMessage message{};
  if (!queue_.peek(message)) return;
  char payload[2049] = {};
  size_t length = message.length;
  memcpy(payload, message.payload, message.length);
  JsonDocument document;
  if (deserializeJson(document, payload, length) == DeserializationError::Ok) {
    JsonObject data = document["data"].as<JsonObject>();
    if (!data.isNull()) data["replayed"] = true;
    size_t newLength = 0;
    if (serializeBounded(document, payload, sizeof(payload), newLength)) length = newLength;
  }
  if (publishRaw(topicForQueued(message.topic), payload, message.retained, message.qos)) queue_.pop(message.recordId);
}

void MqttGateway::onLinkStateChanged(LinkState state, uint16_t reason) {
  linkState_ = state;
  lastLinkReason_ = reason;
  if (!mqtt_.connected()) return;
  if (state == LinkState::Ready) {
    retainedSnapshotPublished_ = false;
    networkPhase_ = NetworkPhase::Syncing;
    publishAvailability("syncing", "link_sync");
  } else if (state == LinkState::Degraded || state == LinkState::Offline) {
    networkPhase_ = NetworkPhase::Syncing;
    retainedSnapshotPublished_ = false;
    publishAvailability("degraded", availabilityReasonForLink(reason));
  }
}

void MqttGateway::onHello(const HelloReport& report) {
  (void)report;
}

void MqttGateway::onConfigReport(const DeviceConfig& config) {
  reportedConfig_ = config;
  reportedConfigValid_ = true;
  if (mqtt_.connected() && networkPhase_ == NetworkPhase::Online) publishConfigReported(&config, "unchanged", "none");
}

void MqttGateway::onSensorReport(const SensorReport& report) {
  latestSensor_ = report;
  hasSensor_ = true;
  if (mqtt_.connected() && networkPhase_ == NetworkPhase::Online) publishTelemetry(report);
}

void MqttGateway::onStateReport(const StateReport& report) {
  latestState_ = report;
  hasState_ = true;
  if (mqtt_.connected() && networkPhase_ == NetworkPhase::Online) publishState();
}

bool MqttGateway::onEventReport(const EventReport& report) {
  char payload[2049] = {};
  size_t length = 0;
  return buildEventJson(report, payload, sizeof(payload), length) && publishOrQueue(QueuedTopic::Event, payload, length);
}

bool MqttGateway::onAlertReport(const AlertReport& report) {
  char payload[2049] = {};
  size_t length = 0;
  if (!buildAlertJson(report, payload, sizeof(payload), length) || !publishOrQueue(QueuedTopic::AlertEvent, payload, length)) return false;
  updateActiveCause(report);
  if (mqtt_.connected()) publishAlertsReported();
  return true;
}

void MqttGateway::onHealthReport(const HealthReport& report) {
  latestHealth_ = report;
  hasHealth_ = true;
  if (mqtt_.connected() && networkPhase_ == NetworkPhase::Online) publishHealth(report);
}

void MqttGateway::onTransactionResult(TransactionKind kind, uint32_t tag, uint32_t, const AckReport* report, bool timedOut) {
  if (kind == TransactionKind::DesiredConfig && desiredConfigInFlight_ && tag == inFlightConfigTag_) {
    desiredConfigInFlight_ = false;
    if (timedOut || report == nullptr) {
      if (!desiredConfigPending_ || inFlightConfig_.version > desiredConfig_.version) {
        desiredConfig_ = inFlightConfig_;
        desiredConfigTag_ = inFlightConfigTag_;
        desiredConfigPending_ = true;
      }
      publishConfigReported(&inFlightConfig_, "pending", "uart_timeout");
      return;
    }
    if (!report->nack) {
      if (store_.save(inFlightConfig_)) {
        link_.updateCachedConfig(inFlightConfig_);
        reportedConfig_ = inFlightConfig_;
        reportedConfigValid_ = true;
        publishConfigReported(&reportedConfig_, report->result == RESULT_DUPLICATE_OK ? "unchanged" : "applied", "none");
      } else {
        publishConfigReported(&inFlightConfig_, "rejected", "nvs_write_failed");
      }
    } else {
      publishConfigReported(&inFlightConfig_, "rejected", reasonName(report->reasonCode));
    }
    retainedSnapshotPublished_ = false;
    return;
  }
  if (kind == TransactionKind::Control && pendingCommand_.active && pendingCommand_.submitted && tag == pendingCommand_.tag) {
    finishCommand(pendingCommand_.commandId, pendingCommand_.payloadHash, report, timedOut || report == nullptr);
  }
}

void MqttGateway::onProtocolError(uint16_t reason, uint8_t offendingType) {
  HealthReport report = latestHealth_;
  report.uptimeMs = millis();
  report.lastError = reason;
  if (mqtt_.connected()) publishHealth(report, static_cast<uint16_t>(offendingType));
}

bool MqttGateway::timeSynced() const { return time(nullptr) >= static_cast<time_t>(kMinimumTrustedEpoch); }

bool MqttGateway::formatUtc(char* output, size_t capacity) const {
  if (!timeSynced() || capacity < 21) return false;
  const time_t now = time(nullptr);
  struct tm utc{};
  gmtime_r(&now, &utc);
  return strftime(output, capacity, "%Y-%m-%dT%H:%M:%SZ", &utc) == 20;
}

uint32_t MqttGateway::nextMessageCounter() {
  ++messageCounter_;
  if (messageCounter_ == 0) messageCounter_ = 1;
  return messageCounter_;
}

void MqttGateway::makeMessageId(char* output, size_t capacity, const char* category, uint32_t suffix) {
  // Gắn cả boot UNO để bộ đếm telemetry/state khởi động lại không va chạm
  // trong cùng một phiên chạy ESP32. Giới hạn phần hiển thị device/category để
  // message_id luôn nhỏ hơn 64 byte theo MQTT 1.0.
  snprintf(output, capacity, "%.12s-%.8s-%08lx-%08lx-%08lx", runtime_config::kDeviceId, category,
           static_cast<unsigned long>(espBootId_), static_cast<unsigned long>(link_.unoBootId()),
           static_cast<unsigned long>(suffix));
}

bool MqttGateway::publishRaw(const char* topic, const char* payload, bool retained, int qos) {
  if (!mqtt_.connected() || topic == nullptr || payload == nullptr || strlen(payload) > kMaximumJsonPayload) return false;
  return mqtt_.publish(topic, payload, retained, qos);
}

bool MqttGateway::publishAvailability(const char* status, const char* reason) {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "availability", nextMessageCounter());
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["status"] = status;
  data["reason"] = reason;
  data["protocol_version"] = "1.0";
  data["config_version"] = link_.currentConfigVersion();
  data["state_version"] = link_.currentStateVersion();
  data["uptime_ms"] = millis();
  char payload[1024] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicAvailability_, payload, true, 1);
}

bool MqttGateway::publishTelemetry(const SensorReport& report) {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "telemetry", report.sampleCounter);
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["uptime_ms"] = report.uptimeMs;
  data["sample_counter"] = report.sampleCounter;
  JsonObject light = data["light"].to<JsonObject>();
  if (report.lightQuality == QUALITY_INVALID) {
    light["adc"] = nullptr;
    light["relative_pct"] = nullptr;
  } else {
    light["adc"] = report.lightAdc;
    light["relative_pct"] = report.lightPct;
  }
  light["quality"] = qualityName(report.lightQuality);
  JsonObject door = data["door_zone"].to<JsonObject>();
  if (report.doorZoneQuality == QUALITY_INVALID || report.distanceMm == 0xFFFFU) door["distance_mm"] = nullptr;
  else door["distance_mm"] = report.distanceMm;
  door["state"] = report.doorZoneState == DOOR_CLEAR ? "clear" : report.doorZoneState == DOOR_OBJECT ? "object_detected" : "unknown";
  door["quality"] = qualityName(report.doorZoneQuality);
  JsonObject mq2 = data["mq2"].to<JsonObject>();
  if (report.mq2Quality == QUALITY_INVALID) {
    mq2["adc"] = nullptr;
    mq2["relative_pct"] = nullptr;
  } else {
    mq2["adc"] = report.mq2Adc;
    mq2["relative_pct"] = report.mq2Pct;
  }
  mq2["state"] = safetyName(report.mq2State);
  mq2["quality"] = qualityName(report.mq2Quality);
  mq2["heat_status"] = report.mq2State == SAFETY_WARMING ? "warming" : "ready";
  JsonObject flame = data["flame"].to<JsonObject>();
  if (report.flameQuality == QUALITY_INVALID) flame["raw"] = nullptr;
  else flame["raw"] = report.flameRaw;
  flame["state"] = safetyName(report.flameState);
  flame["quality"] = qualityName(report.flameQuality);
  char payload[2049] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicTelemetry_, payload, false, 0);
}

bool MqttGateway::publishState() {
  if (!hasState_) return true;
  const StateReport& report = latestState_;
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "state", report.stateVersion);
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["state_version"] = report.stateVersion;
  data["config_version"] = report.configVersion;
  data["room_profile"] = roomName(report.roomProfile);
  data["control_mode"] = modeName(report.controlMode);
  JsonObject outputs = data["outputs"].to<JsonObject>();
  JsonObject lamp = outputs["lamp"].to<JsonObject>();
  lamp["on"] = (report.outputBits & (1U << 0)) != 0;
  lamp["source"] = sourceName(report.lampSource);
  lamp["actuator_mode"] = (report.actuatorFlags & (1U << 0)) != 0 ? "hardware_real" : "unknown";
  JsonObject fan = outputs["fan"].to<JsonObject>();
  fan["on"] = (report.outputBits & (1U << 1)) != 0;
  fan["source"] = sourceName(report.fanSource);
  fan["actuator_mode"] = (report.actuatorFlags & (1U << 1)) != 0 ? "simulated" : "unknown";
  JsonObject lock = outputs["lock"].to<JsonObject>();
  lock["command"] = lockName(report.lockCommand);
  lock["actuator_mode"] = (report.actuatorFlags & (1U << 2)) != 0 ? "simulated" : "unknown";
  lock["mechanical_verified"] = (report.actuatorFlags & (1U << 3)) != 0;
  data["security"]["door_zone_armed"] = report.zoneArmed;
  data["alert"]["lifecycle"] = lifecycleName(report.alertState);
  data["alert"]["active_count"] = report.activeAlertCount;
  data["alarm_output"]["led"] = (report.outputBits & (1U << 3)) != 0;
  data["alarm_output"]["buzzer"] = (report.outputBits & (1U << 4)) != 0;
  data["alarm_output"]["buzzer_available"] = (report.actuatorFlags & (1U << 4)) != 0;
  data["health"]["connection"] = availabilityStatusForLink();
  constexpr uint16_t kRequiredSensorAvailability = (1U << 1) | (1U << 2) | (1U << 3) | (1U << 5);
  bool sensorFault = (report.healthFlags & kRequiredSensorAvailability) != kRequiredSensorAvailability || !hasSensor_;
  if (hasSensor_) {
    sensorFault = sensorFault || latestSensor_.lightQuality != QUALITY_VALID || latestSensor_.doorZoneQuality != QUALITY_VALID;
    if ((link_.capabilities() & (1UL << 2)) != 0) sensorFault = sensorFault || latestSensor_.mq2Quality == QUALITY_INVALID;
    if ((link_.capabilities() & (1UL << 3)) != 0) sensorFault = sensorFault || latestSensor_.flameQuality == QUALITY_INVALID;
  }
  data["health"]["sensor_fault"] = sensorFault;
  data["health"]["queue_depth"] = queue_.size();
  char payload[2049] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicState_, payload, true, 1);
}

bool MqttGateway::publishConfigReported(const DeviceConfig* config, const char* result, const char* reason) {
  JsonDocument document;
  const uint32_t version = config == nullptr ? link_.currentConfigVersion() : config->version;
  char messageId[96] = {};
  // Một config_version có thể lần lượt phát pending rồi applied/rejected.
  // Mỗi lần phát phải có message_id riêng để máy chủ không khử nhầm ACK cuối.
  makeMessageId(messageId, sizeof(messageId), "config-report", nextMessageCounter());
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["config_version"] = version;
  data["apply_result"] = result;
  data["reason_code"] = reason;
  data["reported_at_uptime_ms"] = millis();
  JsonObject settings = data["settings"].to<JsonObject>();
  if (config != nullptr) {
    settings["light_on_pct"] = config->lightOnPct;
    settings["light_off_pct"] = config->lightOffPct;
    settings["control_mode"] = modeName(config->controlMode);
    settings["room_profile"] = roomName(config->roomProfile);
    settings["light_calibration"]["dark_adc"] = config->lightAdcDark;
    settings["light_calibration"]["bright_adc"] = config->lightAdcBright;
    settings["light_calibration"]["enabled"] = (config->configFlags & (1U << 2)) != 0;
    settings["mq2"]["baseline_adc"] = config->mq2BaselineAdc;
    settings["mq2"]["span_adc"] = config->mq2SpanAdc;
    settings["mq2"]["threshold_pct"] = config->mq2ThresholdPct;
    settings["mq2"]["calibration_enabled"] = (config->configFlags & (1U << 0)) != 0;
    settings["door_zone"]["threshold_mm"] = config->doorThresholdMm;
    settings["door_zone"]["confirm_samples"] = config->doorConfirmSamples;
    settings["door_zone"]["calibration_enabled"] = (config->configFlags & (1U << 1)) != 0;
  }
  char payload[2049] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicConfigReported_, payload, true, 1);
}

bool MqttGateway::publishAlertsReported() {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "alerts", nextMessageCounter());
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  JsonArray causes = data["causes"].to<JsonArray>();
  uint8_t count = 0;
  Severity maximum = SEVERITY_INFO;
  for (const ActiveCause& cause : activeCauses_) {
    if (!cause.used || !cause.report.active) continue;
    JsonObject item = causes.add<JsonObject>();
    item["cause_id"] = cause.report.causeId;
    item["alert_type"] = alertTypeName(cause.report.type);
    item["severity"] = severityName(cause.report.severity);
    item["source"] = alertSourceName(cause.report.source);
    item["reason_code"] = reasonName(cause.report.reasonCode);
    item["detail_value"] = cause.report.detailValue;
    ++count;
    if (cause.report.severity > maximum) maximum = cause.report.severity;
  }
  data["active_count"] = count;
  data["maximum_severity"] = severityName(maximum);
  data["lifecycle"] = hasState_ ? lifecycleName(latestState_.alertState) : "normal";
  data["alarm_led"] = hasState_ && (latestState_.outputBits & (1U << 3)) != 0;
  data["buzzer"] = hasState_ && (latestState_.outputBits & (1U << 4)) != 0;
  data["buzzer_available"] = hasState_ && (latestState_.actuatorFlags & (1U << 4)) != 0;
  char payload[2049] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicAlertsReported_, payload, true, 1);
}

bool MqttGateway::publishHealth(const HealthReport& report, uint16_t localReason) {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "diagnostics", nextMessageCounter());
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["uptime_ms"] = report.uptimeMs;
  data["health_flags"] = report.healthFlags;
  data["uart_crc_errors"] = report.rxCrcErrors;
  data["uart_frame_errors"] = report.rxFrameErrors;
  data["uno_queue_overflows"] = report.queueOverflows;
  data["last_error"] = reasonName(report.lastError);
  data["local_detail"] = localReason;
  data["offline_queue_depth"] = queue_.size();
  data["offline_queue_dropped"] = queue_.droppedTotal();
  data["mqtt_inbound_dropped"] = inboundDrops_;
  char payload[1536] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicDiagnostics_, payload, false, 0);
}

bool MqttGateway::publishSyncStatus(const char* syncId, const char* result, const char* reason) {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "sync", nextMessageCounter());
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["sync_id"] = syncId;
  data["result"] = result;
  data["config_version"] = link_.currentConfigVersion();
  data["state_version"] = link_.currentStateVersion();
  data["queue_remaining"] = queue_.size();
  data["reason_code"] = reason;
  char payload[1024] = {};
  size_t length = 0;
  return serializeBounded(document, payload, sizeof(payload), length) && publishRaw(topicSyncStatus_, payload, false, 1);
}

bool MqttGateway::buildEventJson(const EventReport& report, char* output, size_t capacity, size_t& length) {
  JsonDocument document;
  char eventId[112] = {};
  snprintf(eventId, sizeof(eventId), "%s-event-%lu-%lu", runtime_config::kDeviceId,
           static_cast<unsigned long>(link_.unoBootId()), static_cast<unsigned long>(report.localEventId));
  char timestamp[24] = {};
  fillEnvelope(document, eventId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["event_id"] = eventId;
  data["event_type"] = eventTypeName(report.eventType);
  data["severity"] = severityName(report.severity);
  data["source"] = "uno";
  data["occurred_at"] = nullptr;
  data["uptime_ms"] = report.uptimeMs;
  data["state_version"] = report.stateVersion;
  data["details"]["component"] = alertSourceName(report.source);
  data["details"]["reason_code"] = reasonName(report.reasonCode);
  data["details"]["detail_value"] = report.detailValue;
  data["replayed"] = (report.eventFlags & (1U << 1)) != 0;
  return serializeBounded(document, output, capacity, length);
}

bool MqttGateway::buildAlertJson(const AlertReport& report, char* output, size_t capacity, size_t& length) {
  JsonDocument document;
  char alertId[112] = {};
  snprintf(alertId, sizeof(alertId), "%s-alert-%lu-%lu", runtime_config::kDeviceId,
           static_cast<unsigned long>(link_.unoBootId()), static_cast<unsigned long>(report.causeId));
  char messageId[96] = {};
  snprintf(messageId, sizeof(messageId), "%s-a-%08lx-%08lx-%u", runtime_config::kDeviceId,
           static_cast<unsigned long>(link_.unoBootId()), static_cast<unsigned long>(report.causeId),
           static_cast<unsigned int>(report.operation));
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["alert_id"] = alertId;
  data["operation"] = alertOperationName(report.operation);
  data["alert_type"] = alertTypeName(report.type);
  data["severity"] = severityName(report.severity);
  data["source"] = alertSourceName(report.source);
  data["lifecycle"] = lifecycleName(report.lifecycle);
  data["active"] = report.active;
  data["cause_id"] = report.causeId;
  data["reason_code"] = reasonName(report.reasonCode);
  data["detail"]["value"] = report.detailValue;
  data["detail"]["buzzer_available"] = (report.alertFlags & 1U) != 0;
  data["degraded_sensor"] = (report.alertFlags & (1U << 3)) != 0;
  data["replayed"] = false;
  return serializeBounded(document, output, capacity, length);
}

void MqttGateway::updateActiveCause(const AlertReport& report) {
  ActiveCause* empty = nullptr;
  for (ActiveCause& cause : activeCauses_) {
    if (cause.used && cause.report.causeId == report.causeId) {
      if (!report.active || report.operation == ALERT_CLEAR) cause = ActiveCause{};
      else cause.report = report;
      return;
    }
    if (!cause.used && empty == nullptr) empty = &cause;
  }
  if (report.active && empty != nullptr) {
    empty->used = true;
    empty->report = report;
  }
}

bool MqttGateway::publishOrQueue(QueuedTopic topic, const char* payload, size_t length) {
  if (mqtt_.connected() && networkPhase_ == NetworkPhase::Online && publishRaw(topicForQueued(topic), payload, false, 1)) return true;
  const EnqueueResult result = queue_.enqueue(topic, 1, false, payload, length);
  if (result.stored && result.droppedOldest && !overflowMarkerQueued_) {
    overflowMarkerQueued_ = true;
    if (!enqueueQueueOverflowMarker(result.droppedTotal + 1U)) overflowMarkerQueued_ = false;
  }
  return result.stored;
}

bool MqttGateway::enqueueQueueOverflowMarker(uint32_t droppedTotal) {
  JsonDocument document;
  char messageId[96] = {};
  makeMessageId(messageId, sizeof(messageId), "queue-overflow", droppedTotal);
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["event_id"] = messageId;
  data["event_type"] = "queue_overflow";
  data["severity"] = "warning";
  data["source"] = "esp32";
  data["occurred_at"] = nullptr;
  data["uptime_ms"] = millis();
  data["state_version"] = link_.currentStateVersion();
  data["details"]["dropped_total"] = droppedTotal;
  data["replayed"] = false;
  char payload[1024] = {};
  size_t length = 0;
  if (!serializeBounded(document, payload, sizeof(payload), length)) return false;
  return queue_.enqueue(QueuedTopic::Event, 1, false, payload, length).stored;
}

const char* MqttGateway::topicForQueued(QueuedTopic topic) const {
  switch (topic) {
    case QueuedTopic::AlertEvent: return topicAlertEvents_;
    case QueuedTopic::CommandResult: return topicCommandResult_;
    default: return topicEvents_;
  }
}

void MqttGateway::finishCommand(const char* commandId, uint32_t payloadHash, const AckReport* report, bool timedOut) {
  const char* result = timedOut ? "unknown" : report->nack ? "rejected" : report->result == RESULT_DUPLICATE_OK ? "duplicate_ok" : "applied";
  const char* reason = timedOut ? "uart_timeout" : reasonName(report->reasonCode);
  if (!timedOut && report != nullptr && !report->nack && link_.hasCachedConfig() &&
      report->configVersion != link_.cachedConfig().version) {
    DeviceConfig updated = link_.cachedConfig();
    const ControlRequest& request = pendingCommand_.request;
    updated.version = report->configVersion;
    if (request.opcode == OP_SET_DEVICE && (request.options & (1U << 1)) != 0) updated.controlMode = MODE_MANUAL;
    else if (request.opcode == OP_SET_CONTROL_MODE) updated.controlMode = static_cast<ControlMode>(request.value);
    else if (request.opcode == OP_SET_ROOM_PROFILE) updated.roomProfile = static_cast<RoomProfile>(request.value);
    else if (request.opcode == OP_SET_LOCK && (request.options & (1U << 2)) != 0) updated.roomProfile = PROFILE_HOME;
    uint16_t validationReason = REASON_OK;
    if (validateConfig(updated, validationReason) && store_.save(updated)) {
      link_.updateCachedConfig(updated);
      reportedConfig_ = updated;
      reportedConfigValid_ = true;
      publishConfigReported(&updated, "applied", "none");
    } else {
      lastLinkReason_ = REASON_APPLY_FAILED;
    }
  }
  publishCommandResult(commandId, result, reason, timedOut ? nullptr : report, false);
  rememberCommand(commandId, payloadHash, result, reason, timedOut ? nullptr : report);
  pendingCommand_ = PendingCommand{};
  retainedSnapshotPublished_ = false;
}

bool MqttGateway::publishCommandResult(const char* commandId, const char* result, const char* reason,
                                       const AckReport* report, bool replayed) {
  JsonDocument document;
  char messageId[96] = {};
  const uint32_t commandHash = protocol::fnv1a32(reinterpret_cast<const uint8_t*>(commandId), strlen(commandId));
  snprintf(messageId, sizeof(messageId), "%s-result-%08lx", runtime_config::kDeviceId, static_cast<unsigned long>(commandHash));
  char timestamp[24] = {};
  fillEnvelope(document, messageId, runtime_config::kDeviceId, espBootId_, link_.unoBootId(), link_.sessionId(),
               formatUtc(timestamp, sizeof(timestamp)) ? timestamp : nullptr);
  JsonObject data = document["data"].to<JsonObject>();
  data["command_id"] = commandId;
  data["result"] = result;
  data["reason_code"] = reason;
  data["config_version"] = report == nullptr ? link_.currentConfigVersion() : report->configVersion;
  data["state_version"] = report == nullptr ? link_.currentStateVersion() : report->stateVersion;
  if (report != nullptr) {
    data["actual_state"]["lamp_on"] = (report->outputBits & (1U << 0)) != 0;
    data["actual_state"]["fan_on"] = (report->outputBits & (1U << 1)) != 0;
    data["actual_state"]["room_profile"] = roomName(report->roomProfile);
    data["actual_state"]["control_mode"] = modeName(report->controlMode);
    data["actual_state"]["lock_command"] = lockName(report->lockCommand);
  }
  // Lược đồ máy chủ bắt buộc có actual_state; khi bị từ chối sớm (chưa hỏi UNO) gửi đối tượng rỗng.
  if (report == nullptr) data["actual_state"].to<JsonObject>();
  data["uno_ack"] = report != nullptr;
  data["replayed"] = replayed;
  char payload[2049] = {};
  size_t length = 0;
  if (!serializeBounded(document, payload, sizeof(payload), length)) return false;
  if (mqtt_.connected() && publishRaw(topicCommandResult_, payload, false, 1)) return true;
  const EnqueueResult queued = queue_.enqueue(QueuedTopic::CommandResult, 1, false, payload, length);
  if (queued.stored && queued.droppedOldest && !overflowMarkerQueued_) {
    overflowMarkerQueued_ = true;
    if (!enqueueQueueOverflowMarker(queued.droppedTotal + 1U)) overflowMarkerQueued_ = false;
  }
  return queued.stored;
}

MqttGateway::CommandCacheEntry* MqttGateway::findCommandCache(const char* commandId) {
  for (CommandCacheEntry& entry : commandCache_) {
    if (entry.used && sameText(entry.commandId, commandId)) return &entry;
  }
  return nullptr;
}

void MqttGateway::rememberCommand(const char* commandId, uint32_t payloadHash, const char* result, const char* reason,
                                  const AckReport* report) {
  CommandCacheEntry& entry = commandCache_[commandCacheCursor_];
  entry = CommandCacheEntry{};
  entry.used = true;
  copyText(entry.commandId, sizeof(entry.commandId), commandId);
  entry.payloadHash = payloadHash;
  entry.hasAck = report != nullptr;
  copyText(entry.terminalResult, sizeof(entry.terminalResult), result);
  copyText(entry.terminalReason, sizeof(entry.terminalReason), reason);
  if (report != nullptr) entry.report = *report;
  commandCacheCursor_ = static_cast<uint8_t>((commandCacheCursor_ + 1U) % 8U);
}

const char* MqttGateway::availabilityStatusForLink() const {
  if (linkState_ != LinkState::Ready || !queue_.healthy()) return "degraded";
  if (!link_.hasCachedConfig() || link_.currentConfigVersion() != link_.cachedConfig().version) return "degraded";
  if (reportedConfigValid_ && reportedConfig_.version == link_.cachedConfig().version &&
      !sameConfig(reportedConfig_, link_.cachedConfig())) return "degraded";
  return "online";
}

const char* MqttGateway::availabilityReasonForLink(uint16_t reason) const {
  if (!queue_.healthy()) return "queue_unavailable";
  if (linkState_ != LinkState::Ready) return reasonName(reason);
  if (!link_.hasCachedConfig()) return "config_pending";
  if (link_.currentConfigVersion() != link_.cachedConfig().version) return "config_version_conflict";
  if (reportedConfigValid_ && reportedConfig_.version == link_.cachedConfig().version &&
      !sameConfig(reportedConfig_, link_.cachedConfig())) return "config_version_conflict";
  return "ready";
}

}  // namespace smartroom::esp32
