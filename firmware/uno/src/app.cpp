#include "app.hpp"

#include <Arduino.h>
#include <SoftwareSerial.h>
#include <avr/wdt.h>
#include <string.h>

#include "domain.hpp"
#include "protocol.hpp"
#include "sensors.hpp"

namespace smartroom::uno {
namespace {

constexpr uint8_t kLinkRxPin = 10;
constexpr uint8_t kLinkTxPin = 11;
constexpr uint8_t kBuzzerPin = 3;
constexpr uint8_t kLockLedPin = 5;
constexpr uint8_t kRoomLightPin = 6;
constexpr uint8_t kFanLedPin = 9;
constexpr uint8_t kAlarmLedPin = 12;
constexpr uint8_t kLocalStatusLedPin = 13;
constexpr uint8_t kMuteButtonPin = 8;

#ifndef SMARTROOM_ENABLE_BUZZER
#define SMARTROOM_ENABLE_BUZZER 0
#endif

#ifndef SMARTROOM_ENABLE_MQ2
#define SMARTROOM_ENABLE_MQ2 0
#endif

#ifndef SMARTROOM_ENABLE_FLAME_SENSOR
#define SMARTROOM_ENABLE_FLAME_SENSOR 0
#endif

constexpr uint8_t kFlagResponse = 1U << 1;
constexpr uint8_t kFlagError = 1U << 2;
constexpr uint8_t kFlagSnapshot = 1U << 3;
constexpr uint8_t kFlagMore = 1U << 4;
constexpr uint8_t kFlagPriority = 1U << 5;

constexpr uint16_t kFullConfigMask = 0x003FU;
constexpr uint32_t kNoExpectedState = 0xFFFFFFFFUL;
constexpr uint16_t kMinDoorDistanceMm = 20;
constexpr uint16_t kMaxDoorDistanceMm = 3000;
constexpr uint32_t kAutomationHoldMs = 10000UL;
constexpr uint32_t kLightGraceMs = 30000UL;
constexpr uint32_t kHeartbeatIntervalMs = 1000UL;
constexpr uint32_t kHealthReportIntervalMs = 5000UL;
constexpr uint32_t kSensorReportIntervalMs = 2000UL;

constexpr uint32_t kCapabilityLdr = 1UL << 0;
constexpr uint32_t kCapabilitySrf04 = 1UL << 1;
constexpr uint32_t kCapabilityMq2 = 1UL << 2;
constexpr uint32_t kCapabilityFlame = 1UL << 3;
constexpr uint32_t kCapabilityAlarmLed = 1UL << 4;
constexpr uint32_t kCapabilityBuzzer = 1UL << 5;
constexpr uint32_t kCapabilityRoomLed = 1UL << 6;
constexpr uint32_t kCapabilityFanLed = 1UL << 7;
constexpr uint32_t kCapabilityLockLed = 1UL << 8;
constexpr uint32_t kCapabilityMuteButton = 1UL << 9;

constexpr uint8_t kOutputLight = 1U << 0;
constexpr uint8_t kOutputFan = 1U << 1;
constexpr uint8_t kOutputLock = 1U << 2;
constexpr uint8_t kOutputAlarm = 1U << 3;
constexpr uint8_t kOutputBuzzer = 1U << 4;
constexpr uint8_t kOutputZone = 1U << 5;

constexpr uint8_t kActuatorLampReal = 1U << 0;
constexpr uint8_t kActuatorFanSimulated = 1U << 1;
constexpr uint8_t kActuatorLockSimulated = 1U << 2;
constexpr uint8_t kActuatorBuzzerAvailable = 1U << 4;

constexpr uint8_t kSnapshotConfig = 1U << 0;
constexpr uint8_t kSnapshotState = 1U << 1;
constexpr uint8_t kSnapshotSensor = 1U << 2;
constexpr uint8_t kSnapshotAlert = 1U << 3;
constexpr uint8_t kSnapshotHealth = 1U << 4;

enum PendingKind : uint8_t {
  PENDING_NONE = 0,
  PENDING_QUEUE = 1,
  PENDING_STATE = 2,
  PENDING_SENSOR = 3,
  PENDING_HEALTH = 4,
  PENDING_SNAPSHOT = 5
};

struct PendingFrame {
  bool valid = false;
  uint16_t sequence = 0;
  uint8_t encoded[protocol::kEncodedFrameCapacity] = {};
  size_t encodedLength = 0;
  PendingKind kind = PENDING_NONE;
  bool snapshotLast = false;
};

SoftwareSerial linkSerial(kLinkRxPin, kLinkTxPin);
SensorManager sensors;
SensorSnapshot previousSensor{};
bool havePreviousSensor = false;

Config config{};
RuntimeState state{};
LinkCounters counters{};
AlertCause causes[6]{};
PendingReport reports[4]{};
TransactionCacheEntry transactionCache[4]{};

uint8_t reportHead = 0;
uint8_t reportCount = 0;
uint8_t cacheCursor = 0;

bool configValid = false;
bool stateDirty = true;
bool snapshotActive = false;
bool snapshotChanged = false;
bool linkReady = false;
uint16_t snapshotMask = 0;
uint8_t snapshotStep = 0;
uint8_t snapshotAlertIndex = 0;
uint8_t snapshotReportCount = 0;

uint32_t unoBootId = 0;
uint32_t linkSessionId = 0;
uint16_t lastRxSequence = 0;
uint16_t nextTxSequence = 0;
uint32_t lastIncomingHash = 0;
uint16_t lastIncomingSequence = 0;
PendingFrame pending{};

uint8_t encodedRx[protocol::kEncodedFrameCapacity] = {};
size_t encodedRxLength = 0;
uint32_t encodedRxStartedMs = 0;
bool rxOverflow = false;

uint32_t lastSensorReportMs = 0;
uint32_t lastHealthReportMs = 0;
uint32_t lastHeartbeatMs = 0;
uint32_t lastLightChangeMs = 0;
uint32_t lightInvalidSinceMs = 0;
uint32_t nextCauseId = 1;
uint8_t resetCauseBits = 0;
bool lastMuteRaw = true;
bool stableMuteState = true;
uint32_t muteChangedMs = 0;
bool securityAckRequired = false;
bool safetyAckRequired = false;

bool elapsed(uint32_t now, uint32_t since, uint32_t interval) {
  return static_cast<uint32_t>(now - since) >= interval;
}

void saturatingIncrement(uint16_t& value) {
  if (value != 0xFFFFU) ++value;
}

void putU16(uint8_t* target, uint16_t value) {
  target[0] = static_cast<uint8_t>(value & 0xFFU);
  target[1] = static_cast<uint8_t>((value >> 8) & 0xFFU);
}

void putU32(uint8_t* target, uint32_t value) {
  target[0] = static_cast<uint8_t>(value & 0xFFUL);
  target[1] = static_cast<uint8_t>((value >> 8) & 0xFFUL);
  target[2] = static_cast<uint8_t>((value >> 16) & 0xFFUL);
  target[3] = static_cast<uint8_t>((value >> 24) & 0xFFUL);
}

uint16_t getU16(const uint8_t* source) {
  return static_cast<uint16_t>(source[0]) | static_cast<uint16_t>(source[1]) << 8;
}

uint32_t getU32(const uint8_t* source) {
  return static_cast<uint32_t>(source[0]) |
      static_cast<uint32_t>(source[1]) << 8 |
      static_cast<uint32_t>(source[2]) << 16 |
      static_cast<uint32_t>(source[3]) << 24;
}

uint32_t hashFrame(const Frame& frame) {
  uint8_t bytes[16 + kMaxPayload] = {};
  bytes[0] = frame.protocolVersion;
  bytes[1] = frame.messageType;
  bytes[2] = frame.flags;
  bytes[3] = frame.payloadLength;
  putU32(bytes + 4, frame.sessionId);
  putU16(bytes + 8, frame.sequence);
  putU16(bytes + 10, frame.ackSequence);
  putU32(bytes + 12, frame.correlationId);
  if (frame.payloadLength > 0) memcpy(bytes + 16, frame.payload, frame.payloadLength);
  return protocol::crc16CcittFalse(bytes, static_cast<size_t>(16U + frame.payloadLength));
}

uint16_t payloadHash(const Frame& frame) {
  return protocol::crc16CcittFalse(frame.payload, frame.payloadLength);
}

bool sequenceAcked(uint16_t sequence, uint16_t ackSequence) {
  if (sequence == 0 || ackSequence == 0) return false;
  return static_cast<uint16_t>(ackSequence - sequence) < 0x8000U;
}

uint32_t createBootId() {
  uint32_t value = static_cast<uint32_t>(micros()) ^ (static_cast<uint32_t>(analogRead(A0)) << 16) ^ 0xA5C39E17UL;
  if (value == 0) value = 1;
  return value;
}

uint32_t capabilities() {
  return kCapabilityLdr | kCapabilitySrf04 |
      (SMARTROOM_ENABLE_MQ2 != 0 ? kCapabilityMq2 : 0UL) |
      (SMARTROOM_ENABLE_FLAME_SENSOR != 0 ? kCapabilityFlame : 0UL) | kCapabilityAlarmLed |
      kCapabilityRoomLed | kCapabilityFanLed | kCapabilityLockLed | kCapabilityMuteButton |
      (SMARTROOM_ENABLE_BUZZER != 0 ? kCapabilityBuzzer : 0UL);
}

uint16_t healthFlags16() {
  uint16_t flags = 0;
  if (configValid) flags |= 1U << 0;
  flags |= 1U << 1;
  flags |= 1U << 2;
  if (SMARTROOM_ENABLE_MQ2 != 0) flags |= 1U << 3;
  if (sensors.snapshot().mq2Quality == QUALITY_VALID) flags |= 1U << 4;
  if (SMARTROOM_ENABLE_FLAME_SENSOR != 0) flags |= 1U << 5;
  flags |= 1U << 6;
  if (SMARTROOM_ENABLE_BUZZER != 0) flags |= 1U << 7;
  flags |= 1U << 8;
  if (counters.queueOverflows != 0) flags |= 1U << 9;
  return flags;
}

uint32_t healthFlags32() { return static_cast<uint32_t>(healthFlags16()); }

uint8_t outputBits() {
  uint8_t bits = 0;
  if (state.lightOn) bits |= kOutputLight;
  if (state.fanOn) bits |= kOutputFan;
  if (state.lockCommand == LOCK_LOCKED) bits |= kOutputLock;
  if (state.alertState != ALERT_NORMAL) bits |= kOutputAlarm;
  if (state.buzzerOn) bits |= kOutputBuzzer;
  if (state.zoneArmed) bits |= kOutputZone;
  return bits;
}

uint8_t actuatorFlags() {
  uint8_t flags = kActuatorLampReal | kActuatorFanSimulated | kActuatorLockSimulated;
  if (SMARTROOM_ENABLE_BUZZER != 0) flags |= kActuatorBuzzerAvailable;
  return flags;
}

void applyOutputs() {
  digitalWrite(kRoomLightPin, state.lightOn ? HIGH : LOW);
  digitalWrite(kFanLedPin, state.fanOn ? HIGH : LOW);
  digitalWrite(kLockLedPin, state.lockCommand == LOCK_LOCKED ? HIGH : LOW);
  digitalWrite(kAlarmLedPin, state.alertState == ALERT_NORMAL ? LOW : HIGH);
  state.buzzerOn = SMARTROOM_ENABLE_BUZZER != 0 && state.alertState == ALERT_SOUNDING;
  digitalWrite(kBuzzerPin, state.buzzerOn ? HIGH : LOW);
}

uint8_t activeCauseCount() {
  uint8_t count = 0;
  for (const AlertCause& cause : causes) {
    if (cause.active) ++count;
  }
  return count;
}

int8_t findCause(AlertSource source, uint16_t reasonCode) {
  for (uint8_t i = 0; i < 6; ++i) {
    if (causes[i].active && causes[i].source == source && causes[i].reasonCode == reasonCode) return static_cast<int8_t>(i);
  }
  return -1;
}

int8_t findFreeCause() {
  for (uint8_t i = 0; i < 6; ++i) {
    if (!causes[i].active) return static_cast<int8_t>(i);
  }
  return -1;
}

void enqueueReport(uint8_t messageType, uint8_t flags, const uint8_t* payload, uint8_t payloadLength, uint8_t priority);
void queueEvent(uint8_t eventType, Severity severity, AlertSource source, uint16_t reasonCode, uint16_t detailValue, uint8_t eventFlags = 0);
void queueAlertReport(const AlertCause& cause, AlertOperation operation);
void refreshAlertLifecycle();

void markStateChanged(uint8_t eventType, Severity severity, AlertSource source, uint16_t reasonCode, uint16_t detailValue) {
  ++state.stateVersion;
  stateDirty = true;
  if (snapshotActive) snapshotChanged = true;
  queueEvent(eventType, severity, source, reasonCode, detailValue);
  applyOutputs();
}

void refreshAlertLifecycle() {
  const uint8_t count = activeCauseCount();
  const AlertLifecycle before = state.alertState;
  const bool newlyActive = count > state.activeAlertCount;
  state.activeAlertCount = count;

  if (count > 0) {
    if (before == ALERT_NORMAL || before == ALERT_AWAITING_ACK || newlyActive) state.alertState = ALERT_SOUNDING;
  } else if (before == ALERT_SOUNDING || before == ALERT_MUTED) {
    state.alertState = ALERT_AWAITING_ACK;
  }

  if (state.alertState != before) markStateChanged(3, state.alertState == ALERT_SOUNDING ? SEVERITY_CRITICAL : SEVERITY_NOTICE, SOURCE_SYSTEM, 0, count);
  else applyOutputs();
}

void setAlertCause(AlertType type, Severity severity, AlertSource source, uint16_t reasonCode, uint16_t detailValue, bool active) {
  const int8_t existing = findCause(source, reasonCode);
  if (active) {
    if (existing >= 0) {
      if (causes[existing].detailValue != detailValue) causes[existing].detailValue = detailValue;
      return;
    }
    const int8_t slot = findFreeCause();
    if (slot < 0) {
      saturatingIncrement(counters.queueOverflows);
      return;
    }
    causes[slot].active = true;
    causes[slot].causeId = nextCauseId++;
    if (causes[slot].causeId == 0) causes[slot].causeId = nextCauseId++;
    causes[slot].type = type;
    causes[slot].severity = severity;
    causes[slot].source = source;
    causes[slot].reasonCode = reasonCode;
    causes[slot].detailValue = detailValue;
    if (type == ALERT_SECURITY) securityAckRequired = true;
    if (type == ALERT_SAFETY) safetyAckRequired = true;
    refreshAlertLifecycle();
    queueAlertReport(causes[slot], ALERT_ADD);
    return;
  }

  if (existing >= 0) {
    AlertCause copy = causes[existing];
    causes[existing].active = false;
    copy.active = false;
    refreshAlertLifecycle();
    queueAlertReport(copy, ALERT_CLEAR);
  }
}

bool validateConfig(const Config& candidate) {
  if (candidate.version == 0 || candidate.version == 0xFFFFFFFFUL) return false;
  if (candidate.fieldMask != kFullConfigMask) return false;
  if (candidate.lightOnPct > 80 || candidate.lightOffPct < 20 || candidate.lightOffPct > 100 ||
      candidate.lightOffPct < static_cast<uint8_t>(candidate.lightOnPct + 5U)) return false;
  if (candidate.controlMode > MODE_MANUAL || candidate.roomProfile > PROFILE_NIGHT) return false;
  const uint8_t allowedFlags = static_cast<uint8_t>((1U << 0) | (1U << 1) | (1U << 2));
  if ((candidate.configFlags & static_cast<uint8_t>(~allowedFlags)) != 0) return false;
  if (candidate.lightAdcDark > 1023 || candidate.lightAdcBright > 1023) return false;
  const uint16_t lightCalibrationSpan = static_cast<uint16_t>(candidate.lightAdcBright - candidate.lightAdcDark);
  if ((candidate.configFlags & (1U << 2)) != 0 && (candidate.lightAdcBright <= candidate.lightAdcDark || lightCalibrationSpan < 10U)) return false;
  if (candidate.mq2SpanAdc == 0 || static_cast<uint32_t>(candidate.mq2BaselineAdc) + candidate.mq2SpanAdc > 1023UL) return false;
  if (candidate.mq2ThresholdPct > 100) return false;
  if (candidate.doorThresholdMm < kMinDoorDistanceMm || candidate.doorThresholdMm > kMaxDoorDistanceMm) return false;
  if (candidate.doorConfirmSamples == 0 || candidate.doorConfirmSamples > 10) return false;
  return true;
}

bool decodeConfigPayload(const Frame& frame, Config& candidate) {
  if (frame.payloadLength != 24) return false;
  candidate.version = getU32(frame.payload + 0);
  candidate.fieldMask = getU16(frame.payload + 4);
  candidate.lightOnPct = frame.payload[6];
  candidate.lightOffPct = frame.payload[7];
  candidate.controlMode = static_cast<ControlMode>(frame.payload[8]);
  candidate.roomProfile = static_cast<RoomProfile>(frame.payload[9]);
  candidate.lightAdcDark = getU16(frame.payload + 10);
  candidate.lightAdcBright = getU16(frame.payload + 12);
  candidate.mq2BaselineAdc = getU16(frame.payload + 14);
  candidate.mq2SpanAdc = getU16(frame.payload + 16);
  candidate.mq2ThresholdPct = frame.payload[18];
  candidate.configFlags = frame.payload[19];
  candidate.doorThresholdMm = getU16(frame.payload + 20);
  candidate.doorConfirmSamples = frame.payload[22];
  if (frame.payload[23] != 0) return false;
  return validateConfig(candidate);
}

void fillConfigPayload(uint8_t* payload) {
  memset(payload, 0, 24);
  if (!configValid) return;
  putU32(payload + 0, config.version);
  putU16(payload + 4, config.fieldMask);
  payload[6] = config.lightOnPct;
  payload[7] = config.lightOffPct;
  payload[8] = static_cast<uint8_t>(config.controlMode);
  payload[9] = static_cast<uint8_t>(config.roomProfile);
  putU16(payload + 10, config.lightAdcDark);
  putU16(payload + 12, config.lightAdcBright);
  putU16(payload + 14, config.mq2BaselineAdc);
  putU16(payload + 16, config.mq2SpanAdc);
  payload[18] = config.mq2ThresholdPct;
  payload[19] = config.configFlags;
  putU16(payload + 20, config.doorThresholdMm);
  payload[22] = config.doorConfirmSamples;
}

void fillStatePayload(uint8_t* payload) {
  memset(payload, 0, 24);
  putU32(payload + 0, millis());
  putU32(payload + 4, state.stateVersion);
  putU32(payload + 8, configValid ? config.version : 0);
  payload[12] = static_cast<uint8_t>(state.roomProfile);
  payload[13] = static_cast<uint8_t>(state.controlMode);
  payload[14] = outputBits();
  payload[15] = static_cast<uint8_t>(state.lampSource);
  payload[16] = static_cast<uint8_t>(state.fanSource);
  payload[17] = static_cast<uint8_t>(state.lockCommand);
  payload[18] = actuatorFlags();
  payload[19] = state.zoneArmed ? 1 : 0;
  payload[20] = static_cast<uint8_t>(state.alertState);
  payload[21] = state.activeAlertCount;
  putU16(payload + 22, healthFlags16());
}

void fillSensorPayload(uint8_t* payload) {
  const SensorSnapshot& sensor = sensors.snapshot();
  memset(payload, 0, 24);
  putU32(payload + 0, sensor.uptimeMs);
  putU16(payload + 4, sensor.lightAdc);
  payload[6] = sensor.lightPct;
  payload[7] = static_cast<uint8_t>(sensor.lightQuality);
  putU16(payload + 8, sensor.distanceMm);
  payload[10] = static_cast<uint8_t>(sensor.doorZoneState);
  payload[11] = static_cast<uint8_t>(sensor.doorZoneQuality);
  putU16(payload + 12, sensor.mq2Adc);
  payload[14] = sensor.mq2Pct;
  payload[15] = static_cast<uint8_t>(sensor.mq2State);
  payload[16] = static_cast<uint8_t>(sensor.mq2Quality);
  payload[17] = sensor.flameRaw;
  payload[18] = static_cast<uint8_t>(sensor.flameState);
  payload[19] = static_cast<uint8_t>(sensor.flameQuality);
  putU16(payload + 20, sensor.sampleCounter);
  putU16(payload + 22, sensor.sensorFlags);
}

void fillHealthPayload(uint8_t* payload) {
  memset(payload, 0, 16);
  putU32(payload + 0, millis());
  putU32(payload + 4, healthFlags32());
  putU16(payload + 8, counters.rxCrcErrors);
  putU16(payload + 10, counters.rxFrameErrors);
  putU16(payload + 12, counters.queueOverflows);
  putU16(payload + 14, counters.lastError);
}

void fillIdlePayload(uint8_t* payload) {
  memset(payload, 0, 12);
  putU32(payload + 0, millis());
  putU32(payload + 4, state.stateVersion);
  payload[8] = reportCount;
  payload[9] = static_cast<uint8_t>(healthFlags16() & 0xFFU);
  putU16(payload + 10, counters.rxFrameErrors);
}

void fillEventPayload(uint8_t* payload, uint32_t eventId, uint8_t eventType, Severity severity, AlertSource source, uint8_t flags, uint16_t reason, uint16_t detail) {
  memset(payload, 0, 20);
  putU32(payload + 0, eventId);
  putU32(payload + 4, millis());
  putU32(payload + 8, state.stateVersion);
  payload[12] = eventType;
  payload[13] = static_cast<uint8_t>(severity);
  payload[14] = static_cast<uint8_t>(source);
  payload[15] = flags;
  putU16(payload + 16, reason);
  putU16(payload + 18, detail);
}

void fillAlertPayload(uint8_t* payload, const AlertCause& cause, AlertOperation operation) {
  memset(payload, 0, 20);
  putU32(payload + 0, cause.causeId);
  putU32(payload + 4, millis());
  payload[8] = static_cast<uint8_t>(operation);
  payload[9] = static_cast<uint8_t>(cause.type);
  payload[10] = static_cast<uint8_t>(cause.severity);
  payload[11] = static_cast<uint8_t>(cause.source);
  payload[12] = static_cast<uint8_t>(state.alertState);
  payload[13] = cause.active ? 1 : 0;
  putU16(payload + 14, cause.reasonCode);
  putU16(payload + 16, cause.detailValue);
  uint16_t flags = SMARTROOM_ENABLE_BUZZER != 0 ? 1U : 0U;
  if (state.buzzerOn) flags |= 1U << 1;
  putU16(payload + 18, flags);
}

void enqueueReport(uint8_t messageType, uint8_t flags, const uint8_t* payload, uint8_t payloadLength, uint8_t priority) {
  if (payloadLength > kMaxPayload) return;
  if (reportCount >= 4) {
    saturatingIncrement(counters.queueOverflows);
    counters.lastError = REASON_QUEUE_FULL;
    if (priority < 3) return;
    reports[reportHead].valid = false;
    reportHead = static_cast<uint8_t>((reportHead + 1U) % 4U);
    --reportCount;
  }
  const uint8_t index = static_cast<uint8_t>((reportHead + reportCount) % 4U);
  reports[index].valid = true;
  reports[index].messageType = messageType;
  reports[index].flags = flags;
  reports[index].payloadLength = payloadLength;
  reports[index].priority = priority;
  if (payloadLength > 0) memcpy(reports[index].payload, payload, payloadLength);
  ++reportCount;
}

PendingReport* frontReport() {
  if (reportCount == 0) return nullptr;
  uint8_t bestIndex = reportHead;
  for (uint8_t offset = 1; offset < reportCount; ++offset) {
    const uint8_t index = static_cast<uint8_t>((reportHead + offset) % 4U);
    if (reports[index].priority > reports[bestIndex].priority) bestIndex = index;
  }
  if (bestIndex != reportHead) {
    const PendingReport temporary = reports[reportHead];
    reports[reportHead] = reports[bestIndex];
    reports[bestIndex] = temporary;
  }
  return &reports[reportHead];
}

void popReport() {
  if (reportCount == 0) return;
  reports[reportHead].valid = false;
  reportHead = static_cast<uint8_t>((reportHead + 1U) % 4U);
  --reportCount;
}

void queueEvent(uint8_t eventType, Severity severity, AlertSource source, uint16_t reasonCode, uint16_t detailValue, uint8_t eventFlags) {
  uint8_t payload[20] = {};
  const uint32_t eventId = (unoBootId << 1) ^ static_cast<uint32_t>(nextCauseId++);
  fillEventPayload(payload, eventId, eventType, severity, source, eventFlags, reasonCode, detailValue);
  enqueueReport(EVENT_REPORT, severity >= SEVERITY_WARNING ? kFlagPriority : 0, payload, 20, severity >= SEVERITY_WARNING ? 2 : 1);
}

void queueAlertReport(const AlertCause& cause, AlertOperation operation) {
  uint8_t payload[20] = {};
  fillAlertPayload(payload, cause, operation);
  enqueueReport(ALERT_REPORT, kFlagPriority, payload, 20, 3);
}

void acknowledgePending(uint16_t ackSequence) {
  if (!pending.valid || !sequenceAcked(pending.sequence, ackSequence)) return;
  const PendingKind kind = pending.kind;
  const bool snapshotLast = pending.snapshotLast;
  pending.valid = false;
  pending.kind = PENDING_NONE;
  if (kind == PENDING_QUEUE) popReport();
  if (kind == PENDING_STATE) stateDirty = false;
  if (kind == PENDING_SENSOR) lastSensorReportMs = millis();
  if (kind == PENDING_HEALTH) lastHealthReportMs = millis();
  if (kind == PENDING_SNAPSHOT && snapshotLast) snapshotActive = false;
}

bool sendFrame(Frame frame, PendingKind kind = PENDING_NONE, bool snapshotLast = false) {
  if (pending.valid) return false;
  const bool preSession = frame.messageType == HELLO || linkSessionId == 0;
  if (preSession) {
    frame.sessionId = 0;
    frame.sequence = 0;
    frame.ackSequence = 0;
  } else {
    frame.sessionId = linkSessionId;
    frame.sequence = nextTxSequence;
    nextTxSequence = nextTxSequence == 0xFFFFU ? 1U : static_cast<uint16_t>(nextTxSequence + 1U);
    frame.ackSequence = lastRxSequence;
  }

  uint8_t encoded[protocol::kEncodedFrameCapacity] = {};
  size_t encodedLength = 0;
  if (!protocol::encodeFrame(frame, encoded, sizeof(encoded), encodedLength)) return false;
  linkSerial.write(encoded, encodedLength);
  linkSerial.flush();
  saturatingIncrement(counters.txFrames);

  if (!preSession && frame.sequence != 0) {
    memcpy(pending.encoded, encoded, encodedLength);
    pending.encodedLength = encodedLength;
    pending.sequence = frame.sequence;
    pending.kind = kind;
    pending.snapshotLast = snapshotLast;
    pending.valid = true;
  }
  return true;
}

void resendPending() {
  if (!pending.valid) return;
  linkSerial.write(pending.encoded, pending.encodedLength);
  linkSerial.flush();
  saturatingIncrement(counters.txFrames);
}

void sendHello(const Frame& request) {
  Frame response{};
  response.messageType = HELLO;
  response.flags = kFlagResponse;
  response.correlationId = request.correlationId;
  putU32(response.payload + 0, unoBootId);
  putU32(response.payload + 4, millis());
  response.payload[8] = 1;
  response.payload[9] = 0;
  response.payload[10] = 0;
  response.payload[11] = resetCauseBits;
  putU32(response.payload + 12, capabilities());
  putU32(response.payload + 16, configValid ? config.version : 0);
  putU32(response.payload + 20, state.stateVersion);
  response.payloadLength = 24;
  sendFrame(response);
}

void fillAckPayload(uint8_t* payload, uint8_t requestType, uint8_t opcode, ResultCode result, uint16_t reason) {
  memset(payload, 0, 24);
  payload[0] = requestType;
  payload[1] = opcode;
  payload[2] = static_cast<uint8_t>(result);
  putU16(payload + 4, reason);
  putU32(payload + 8, configValid ? config.version : 0);
  putU32(payload + 12, state.stateVersion);
  payload[16] = static_cast<uint8_t>(state.roomProfile);
  payload[17] = static_cast<uint8_t>(state.controlMode);
  payload[18] = outputBits();
  payload[19] = static_cast<uint8_t>(state.lampSource);
  payload[20] = static_cast<uint8_t>(state.fanSource);
  payload[21] = static_cast<uint8_t>(state.lockCommand);
  payload[22] = actuatorFlags();
  payload[23] = static_cast<uint8_t>(state.alertState);
}

void cacheTransaction(const Frame& request, uint8_t responseType, const uint8_t* responsePayload) {
  if (request.correlationId == 0) return;
  TransactionCacheEntry& entry = transactionCache[cacheCursor];
  entry.valid = true;
  entry.sessionId = request.sessionId;
  entry.correlationId = request.correlationId;
  entry.requestType = request.messageType;
  entry.payloadHash = payloadHash(request);
  entry.responseType = responseType;
  memcpy(entry.responsePayload, responsePayload, 24);
  cacheCursor = static_cast<uint8_t>((cacheCursor + 1U) % 4U);
}

TransactionCacheEntry* findTransaction(const Frame& request) {
  if (request.correlationId == 0) return nullptr;
  for (TransactionCacheEntry& entry : transactionCache) {
    if (entry.valid && entry.sessionId == request.sessionId && entry.correlationId == request.correlationId && entry.requestType == request.messageType) return &entry;
  }
  return nullptr;
}

void sendCachedTransaction(const Frame& request, TransactionCacheEntry& entry) {
  Frame response{};
  response.messageType = entry.responseType;
  response.flags = static_cast<uint8_t>(kFlagResponse | (entry.responseType == NACK ? kFlagError : 0));
  response.correlationId = request.correlationId;
  memcpy(response.payload, entry.responsePayload, 24);
  response.payload[2] = entry.responseType == ACK ? RESULT_DUPLICATE_OK : RESULT_REJECTED;
  if (entry.responseType == ACK) putU16(response.payload + 4, REASON_OK);
  response.payloadLength = 24;
  sendFrame(response);
}

void sendReject(const Frame& request, uint16_t reason, uint8_t opcode = 0) {
  uint8_t payload[24] = {};
  fillAckPayload(payload, request.messageType, opcode, RESULT_REJECTED, reason);
  Frame response{};
  response.messageType = NACK;
  response.flags = static_cast<uint8_t>(kFlagResponse | kFlagError);
  response.correlationId = request.correlationId;
  memcpy(response.payload, payload, 24);
  response.payloadLength = 24;
  cacheTransaction(request, NACK, payload);
  sendFrame(response);
}

void sendAccepted(const Frame& request, uint8_t opcode) {
  uint8_t payload[24] = {};
  fillAckPayload(payload, request.messageType, opcode, RESULT_APPLIED, REASON_OK);
  Frame response{};
  response.messageType = ACK;
  response.flags = kFlagResponse;
  response.correlationId = request.correlationId;
  memcpy(response.payload, payload, 24);
  response.payloadLength = 24;
  cacheTransaction(request, ACK, payload);
  sendFrame(response);
}

void updateZoneArming();
void evaluateAutomaticLight(uint32_t now);


void updateZoneArming() {
  const bool armed = configValid && config.roomProfile != PROFILE_HOME && (config.configFlags & (1U << 1)) != 0;
  if (armed != state.zoneArmed) {
    state.zoneArmed = armed;
    markStateChanged(4, SEVERITY_NOTICE, SOURCE_DOOR, 0, armed ? 1 : 0);
  }
}

void evaluateAutomaticLight(uint32_t now) {
  if (!configValid || state.controlMode != MODE_AUTO || state.roomProfile == PROFILE_AWAY) {
    if (state.roomProfile == PROFILE_AWAY && state.lightOn) {
      state.lightOn = false;
      state.lampSource = SOURCE_PROFILE;
      lastLightChangeMs = now;
      markStateChanged(3, SEVERITY_NOTICE, SOURCE_SYSTEM, REASON_ROOM_PROFILE_BLOCK, 0);
    }
    return;
  }

  const SensorSnapshot& sensor = sensors.snapshot();
  if (sensor.lightQuality != QUALITY_VALID) {
    if (lightInvalidSinceMs == 0) lightInvalidSinceMs = now;
    if (elapsed(now, lightInvalidSinceMs, kLightGraceMs) && state.lightOn && state.lampSource == SOURCE_AUTO) {
      state.lightOn = false;
      state.lampSource = SOURCE_SAFETY;
      lastLightChangeMs = now;
      markStateChanged(3, SEVERITY_NOTICE, SOURCE_LIGHT, REASON_SENSOR_INVALID, 0);
    }
    return;
  }

  lightInvalidSinceMs = 0;
  if (!elapsed(now, lastLightChangeMs, kAutomationHoldMs)) return;
  if (!state.lightOn && sensor.lightPct <= config.lightOnPct) {
    state.lightOn = true;
    state.lampSource = SOURCE_AUTO;
    lastLightChangeMs = now;
    markStateChanged(3, SEVERITY_NOTICE, SOURCE_LIGHT, 0, sensor.lightPct);
  } else if (state.lightOn && sensor.lightPct >= config.lightOffPct) {
    state.lightOn = false;
    state.lampSource = SOURCE_AUTO;
    lastLightChangeMs = now;
    markStateChanged(3, SEVERITY_NOTICE, SOURCE_LIGHT, 0, sensor.lightPct);
  }
}

void updateSensorAlerts() {
  const SensorSnapshot& sensor = sensors.snapshot();
  setAlertCause(ALERT_SAFETY, SEVERITY_CRITICAL, SOURCE_MQ2, REASON_OK, sensor.mq2Pct,
                sensor.mq2State == SAFETY_ALERT && sensor.mq2Quality == QUALITY_VALID);
  setAlertCause(ALERT_SYSTEM, SEVERITY_NOTICE, SOURCE_MQ2, REASON_SENSOR_INVALID, 0xA2,
                sensor.mq2State == SAFETY_SENSOR_FAULT);
  setAlertCause(ALERT_SAFETY, SEVERITY_CRITICAL, SOURCE_FLAME, REASON_OK, sensor.flameRaw,
                sensor.flameState == SAFETY_ALERT && sensor.flameQuality == QUALITY_VALID);
  setAlertCause(ALERT_SYSTEM, SEVERITY_NOTICE, SOURCE_FLAME, REASON_SENSOR_INVALID, 0xF1,
                sensor.flameState == SAFETY_SENSOR_FAULT);

  const bool doorAlert = state.zoneArmed && sensor.doorZoneState == DOOR_OBJECT && sensor.doorZoneQuality == QUALITY_VALID;
  setAlertCause(ALERT_SECURITY, SEVERITY_CRITICAL, SOURCE_DOOR, REASON_OK, sensor.distanceMm, doorAlert);
  const bool doorFault = state.roomProfile != PROFILE_HOME && sensor.doorZoneQuality != QUALITY_VALID;
  setAlertCause(ALERT_SYSTEM, SEVERITY_NOTICE, SOURCE_DOOR, REASON_SENSOR_INVALID, 0xD0, doorFault);
}

void processSensorUpdate() {
  const SensorSnapshot& sensor = sensors.snapshot();
  if (havePreviousSensor) {
    if (sensor.lightQuality != previousSensor.lightQuality ||
        sensor.doorZoneState != previousSensor.doorZoneState || sensor.doorZoneQuality != previousSensor.doorZoneQuality ||
        sensor.mq2State != previousSensor.mq2State || sensor.mq2Quality != previousSensor.mq2Quality ||
        sensor.flameState != previousSensor.flameState || sensor.flameQuality != previousSensor.flameQuality) {
      stateDirty = true;
    }
  }
  previousSensor = sensor;
  havePreviousSensor = true;
  updateSensorAlerts();
  evaluateAutomaticLight(millis());
}

void applyConfig(const Config& candidate, bool emitEvent) {
  const bool profileChanged = !configValid || state.roomProfile != candidate.roomProfile;
  config = candidate;
  configValid = true;
  state.configVersion = config.version;
  state.controlMode = config.controlMode;
  state.roomProfile = config.roomProfile;
  if (profileChanged && state.roomProfile == PROFILE_AWAY) {
    state.lightOn = false;
    state.fanOn = false;
    state.lampSource = SOURCE_PROFILE;
    state.fanSource = SOURCE_PROFILE;
    state.lockCommand = LOCK_LOCKED;
  } else if (profileChanged && state.roomProfile == PROFILE_NIGHT) {
    state.lockCommand = LOCK_LOCKED;
  }
  updateZoneArming();
  if (state.controlMode == MODE_AUTO) evaluateAutomaticLight(millis());
  if (emitEvent) markStateChanged(6, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, static_cast<uint16_t>(config.version & 0xFFFFU));
  else applyOutputs();
}

bool parseControl(const Frame& frame, uint32_t& expectedState, uint32_t& baseConfig, uint32_t& newConfig, uint8_t& opcode, uint8_t& target, uint8_t& value, uint8_t& options) {
  if (frame.payloadLength != 16) return false;
  expectedState = getU32(frame.payload + 0);
  baseConfig = getU32(frame.payload + 4);
  newConfig = getU32(frame.payload + 8);
  opcode = frame.payload[12];
  target = frame.payload[13];
  value = frame.payload[14];
  options = frame.payload[15];
  if ((options & 0xF8U) != 0) return false;
  if (opcode < OP_SET_DEVICE || opcode > OP_ALERT_ACTION) return false;
  if (opcode == OP_SET_DEVICE && (target < 1 || target > 2 || value > 1)) return false;
  if (opcode == OP_SET_CONTROL_MODE && (target != 0 || value > 1)) return false;
  if (opcode == OP_SET_ROOM_PROFILE && (target != 0 || value > 2)) return false;
  if (opcode == OP_SET_LOCK && (target != 3 || value > 1)) return false;
  if (opcode == OP_ALERT_ACTION && (target != 4 || value > 1)) return false;
  return true;
}

bool applyControl(const Frame& frame, uint8_t opcode, uint8_t target, uint8_t value, uint8_t options, uint32_t baseConfig, uint32_t newConfig, uint16_t& reason) {
  (void)frame;
  if (opcode != OP_ALERT_ACTION) {
    if (!configValid) {
      reason = REASON_SESSION_NOT_READY;
      return false;
    }
    if (baseConfig != config.version) {
      reason = baseConfig < config.version ? REASON_STALE_CONFIG_VERSION : REASON_CONFIG_VERSION_CONFLICT;
      return false;
    }
  }

  const bool confirmed = (options & (1U << 0)) != 0;
  const bool forceManual = (options & (1U << 1)) != 0;
  const bool transitionHome = (options & (1U << 2)) != 0;

  if (opcode == OP_SET_DEVICE) {
    if (state.roomProfile == PROFILE_AWAY) {
      reason = REASON_ROOM_PROFILE_BLOCK;
      return false;
    }
    if (state.controlMode == MODE_AUTO) {
      if (!forceManual || !confirmed || newConfig <= baseConfig || newConfig == 0xFFFFFFFFUL) {
        reason = REASON_MANUAL_CONFIRM_REQUIRED;
        return false;
      }
      config.controlMode = MODE_MANUAL;
      config.version = newConfig;
      state.configVersion = newConfig;
      state.controlMode = MODE_MANUAL;
      markStateChanged(5, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, 0);
    } else if (newConfig != baseConfig) {
      reason = REASON_CONFIG_VERSION_CONFLICT;
      return false;
    }
    if (target == 1) {
      state.lightOn = value != 0;
      state.lampSource = SOURCE_MANUAL;
    } else {
      state.fanOn = value != 0;
      state.fanSource = SOURCE_MANUAL;
    }
    markStateChanged(3, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, value);
    return true;
  }

  if (opcode == OP_SET_CONTROL_MODE) {
    if (newConfig <= baseConfig || newConfig == 0xFFFFFFFFUL) {
      reason = REASON_CONFIG_RELATION_INVALID;
      return false;
    }
    config.controlMode = static_cast<ControlMode>(value);
    config.version = newConfig;
    state.configVersion = newConfig;
    state.controlMode = config.controlMode;
    markStateChanged(5, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, value);
    if (state.controlMode == MODE_AUTO) evaluateAutomaticLight(millis());
    return true;
  }

  if (opcode == OP_SET_ROOM_PROFILE) {
    if (newConfig <= baseConfig || newConfig == 0xFFFFFFFFUL) {
      reason = REASON_CONFIG_RELATION_INVALID;
      return false;
    }
    config.roomProfile = static_cast<RoomProfile>(value);
    config.version = newConfig;
    state.configVersion = newConfig;
    state.roomProfile = config.roomProfile;
    if (state.roomProfile == PROFILE_AWAY) {
      state.lightOn = false;
      state.fanOn = false;
      state.lampSource = SOURCE_PROFILE;
      state.fanSource = SOURCE_PROFILE;
      state.lockCommand = LOCK_LOCKED;
    } else if (state.roomProfile == PROFILE_NIGHT) {
      state.lockCommand = LOCK_LOCKED;
    }
    updateZoneArming();
    markStateChanged(4, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, value);
    if (state.controlMode == MODE_AUTO) evaluateAutomaticLight(millis());
    return true;
  }

  if (opcode == OP_SET_LOCK) {
    if (value == LOCK_UNLOCKED) {
      bool securityActive = false;
      bool safetyActive = false;
      for (const AlertCause& cause : causes) {
        if (!cause.active) continue;
        if (cause.type == ALERT_SECURITY) securityActive = true;
        if (cause.type == ALERT_SAFETY) safetyActive = true;
      }
      if (securityActive || securityAckRequired) {
        reason = REASON_SECURITY_BLOCK;
        return false;
      }
      if (state.roomProfile != PROFILE_HOME && (!transitionHome || !confirmed)) {
        reason = REASON_ROOM_PROFILE_BLOCK;
        return false;
      }
      if ((safetyActive || safetyAckRequired) && !confirmed) {
        reason = REASON_ALERT_CAUSE_ACTIVE;
        return false;
      }
      if (transitionHome) {
        if (newConfig <= baseConfig || newConfig == 0xFFFFFFFFUL) {
          reason = REASON_CONFIG_RELATION_INVALID;
          return false;
        }
        config.roomProfile = PROFILE_HOME;
        config.version = newConfig;
        state.roomProfile = PROFILE_HOME;
        state.configVersion = newConfig;
        updateZoneArming();
      } else if (newConfig != baseConfig) {
        reason = REASON_CONFIG_VERSION_CONFLICT;
        return false;
      }
      state.lockCommand = LOCK_UNLOCKED;
    } else {
      if (newConfig != baseConfig) {
        reason = REASON_CONFIG_VERSION_CONFLICT;
        return false;
      }
      state.lockCommand = LOCK_LOCKED;
    }
    markStateChanged(3, SEVERITY_NOTICE, SOURCE_DOOR, 0, value);
    return true;
  }

  if (opcode == OP_ALERT_ACTION) {
    if (value == ALERT_MUTE) {
      if (state.activeAlertCount > 0 && state.alertState == ALERT_SOUNDING) {
        state.alertState = ALERT_MUTED;
        markStateChanged(10, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, 0);
      }
      return true;
    }
    if (state.activeAlertCount > 0) {
      reason = REASON_ALERT_CAUSE_ACTIVE;
      return false;
    }
    if (state.alertState != ALERT_NORMAL) {
      state.alertState = ALERT_NORMAL;
      securityAckRequired = false;
      safetyAckRequired = false;
      markStateChanged(11, SEVERITY_INFO, SOURCE_SYSTEM, 0, 0);
    }
    return true;
  }

  reason = REASON_UNSUPPORTED_TYPE;
  return false;
}

void sendSnapshotReport() {
  Frame frame{};
  frame.messageType = IDLE;
  frame.flags = kFlagSnapshot;
  frame.payloadLength = 0;
  bool found = false;

  while (snapshotStep < 6 && !found) {
    if (snapshotStep == 0) {
      ++snapshotStep;
      if ((snapshotMask & kSnapshotConfig) != 0) {
        frame.messageType = CONFIG_REPORT;
        fillConfigPayload(frame.payload);
        frame.payloadLength = 24;
        found = true;
      }
    } else if (snapshotStep == 1) {
      ++snapshotStep;
      if ((snapshotMask & kSnapshotState) != 0) {
        frame.messageType = STATE_REPORT;
        fillStatePayload(frame.payload);
        frame.payloadLength = 24;
        found = true;
      }
    } else if (snapshotStep == 2) {
      ++snapshotStep;
      if ((snapshotMask & kSnapshotSensor) != 0) {
        frame.messageType = SENSOR_REPORT;
        fillSensorPayload(frame.payload);
        frame.payloadLength = 24;
        found = true;
      }
    } else if (snapshotStep == 3) {
      while (snapshotAlertIndex < 6 && !causes[snapshotAlertIndex].active) ++snapshotAlertIndex;
      if ((snapshotMask & kSnapshotAlert) != 0 && snapshotAlertIndex < 6) {
        frame.messageType = ALERT_REPORT;
        fillAlertPayload(frame.payload, causes[snapshotAlertIndex], ALERT_RESTORED);
        frame.payloadLength = 20;
        ++snapshotAlertIndex;
        found = true;
      } else {
        ++snapshotStep;
        snapshotAlertIndex = 0;
      }
    } else if (snapshotStep == 4) {
      ++snapshotStep;
      if ((snapshotMask & kSnapshotHealth) != 0) {
        frame.messageType = HEALTH_REPORT;
        fillHealthPayload(frame.payload);
        frame.payloadLength = 16;
        found = true;
      }
    } else {
      ++snapshotStep;
    }
  }

  if (found) {
    frame.flags = static_cast<uint8_t>(kFlagSnapshot | kFlagMore);
    ++snapshotReportCount;
    sendFrame(frame, PENDING_SNAPSHOT);
    return;
  }

  frame.messageType = SNAPSHOT_END;
  frame.flags = kFlagSnapshot;
  putU32(frame.payload + 0, configValid ? config.version : 0);
  putU32(frame.payload + 4, state.stateVersion);
  frame.payload[8] = snapshotReportCount;
  frame.payload[9] = state.activeAlertCount;
  putU16(frame.payload + 10, snapshotChanged ? 2U : 1U);
  frame.payloadLength = 12;
  sendFrame(frame, PENDING_SNAPSHOT, true);
}

void respondToPoll(const Frame& request) {
  if (pending.valid) {
    resendPending();
    return;
  }

  const uint16_t requestMask = request.payloadLength == 4 ? getU16(request.payload) : 0;
  if (reportCount > 0) {
    PendingReport* report = frontReport();
    Frame frame{};
    frame.messageType = report->messageType;
    frame.flags = report->flags;
    frame.payloadLength = report->payloadLength;
    memcpy(frame.payload, report->payload, report->payloadLength);
    sendFrame(frame, PENDING_QUEUE);
    return;
  }
  if (snapshotActive) {
    sendSnapshotReport();
    return;
  }

  const uint32_t now = millis();
  if (stateDirty || (requestMask & (1U << 1)) != 0) {
    Frame frame{};
    frame.messageType = STATE_REPORT;
    frame.payloadLength = 24;
    fillStatePayload(frame.payload);
    sendFrame(frame, PENDING_STATE);
    return;
  }
  if ((requestMask & 1U) != 0 || elapsed(now, lastSensorReportMs, kSensorReportIntervalMs)) {
    Frame frame{};
    frame.messageType = SENSOR_REPORT;
    frame.payloadLength = 24;
    fillSensorPayload(frame.payload);
    sendFrame(frame, PENDING_SENSOR);
    return;
  }
  if ((requestMask & (1U << 2)) != 0 || elapsed(now, lastHealthReportMs, kHealthReportIntervalMs)) {
    Frame frame{};
    frame.messageType = HEALTH_REPORT;
    frame.payloadLength = 16;
    fillHealthPayload(frame.payload);
    sendFrame(frame, PENDING_HEALTH);
    return;
  }

  Frame idle{};
  idle.messageType = IDLE;
  idle.payloadLength = 12;
  fillIdlePayload(idle.payload);
  sendFrame(idle);
}

bool expectedPayloadLength(uint8_t messageType, uint8_t length) {
  switch (messageType) {
    case HELLO_REQUEST: return length == 8;
    case SESSION_START: return length == 16;
    case POLL: return length == 4;
    case SNAPSHOT_REQUEST: return length == 4;
    case SYNC_COMPLETE: return length == 8;
    case CONFIG_SET: return length == 24;
    case CONTROL_SET: return length == 16;
    default: return true;
  }
}

void handleFrame(const Frame& frame) {
  saturatingIncrement(counters.rxFrames);
  if (frame.protocolVersion != kProtocolVersion) {
    counters.lastError = REASON_UNSUPPORTED_VERSION;
    return;
  }

  if (frame.messageType == HELLO_REQUEST) {
    if (frame.payloadLength != 8 || getU16(frame.payload + 6) != 0 || frame.payload[4] != kProtocolVersion || frame.payload[5] != kProtocolVersion) {
      counters.lastError = REASON_INVALID_LENGTH;
      return;
    }
    pending.valid = false;
    linkSessionId = 0;
    linkReady = false;
    lastRxSequence = 0;
    nextTxSequence = 0;
    snapshotActive = false;
    sendHello(frame);
    return;
  }

  if (frame.messageType == SESSION_START) {
    if (frame.payloadLength != 16 || frame.sessionId == 0 || frame.sequence != 1 || getU16(frame.payload + 14) > 1 || getU16(frame.payload + 12) != 200) {
      sendReject(frame, REASON_INVALID_LENGTH);
      return;
    }
    const uint32_t requestedUnoBoot = getU32(frame.payload + 0);
    if (unoBootId == 0) unoBootId = requestedUnoBoot == 0 ? createBootId() : requestedUnoBoot;
    if (requestedUnoBoot != 0 && requestedUnoBoot != unoBootId) {
      sendReject(frame, REASON_SESSION_MISMATCH);
      return;
    }
    linkSessionId = frame.sessionId;
    linkReady = false;
    lastRxSequence = 1;
    lastIncomingSequence = 1;
    lastIncomingHash = hashFrame(frame);
    nextTxSequence = 1;
    pending.valid = false;
    Frame accept{};
    accept.messageType = SESSION_ACCEPT;
    accept.flags = kFlagResponse;
    accept.correlationId = frame.correlationId;
    putU32(accept.payload + 0, unoBootId);
    putU32(accept.payload + 4, configValid ? config.version : 0);
    putU32(accept.payload + 8, state.stateVersion);
    putU32(accept.payload + 12, capabilities());
    accept.payloadLength = 16;
    sendFrame(accept);
    return;
  }

  if (linkSessionId == 0) {
    counters.lastError = REASON_SESSION_NOT_READY;
    return;
  }
  if (frame.sessionId != linkSessionId) {
    counters.lastError = REASON_SESSION_MISMATCH;
    if (frame.correlationId != 0) sendReject(frame, REASON_SESSION_MISMATCH);
    return;
  }
  if (!expectedPayloadLength(frame.messageType, frame.payloadLength)) {
    counters.lastError = REASON_INVALID_LENGTH;
    if (frame.correlationId != 0) sendReject(frame, REASON_INVALID_LENGTH);
    return;
  }

  const uint16_t expectedSequence = lastRxSequence == 0xFFFFU ? 1U : static_cast<uint16_t>(lastRxSequence + 1U);
  const uint32_t currentHash = hashFrame(frame);
  const bool duplicateFrame = frame.sequence == lastIncomingSequence && currentHash == lastIncomingHash;
  if (!duplicateFrame && frame.sequence != expectedSequence) {
    saturatingIncrement(counters.sequenceConflicts);
    counters.lastError = REASON_SEQUENCE_CONFLICT;
    linkReady = false;
    if (frame.correlationId != 0) sendReject(frame, REASON_SEQUENCE_CONFLICT);
    return;
  }
  if (!duplicateFrame) {
    lastRxSequence = frame.sequence;
    lastIncomingSequence = frame.sequence;
    lastIncomingHash = currentHash;
  }
  // Chỉ chấp nhận ACK cộng dồn sau khi phiên, độ dài và sequence của khung
  // hiện tại đã hợp lệ; khung sai phiên không được phép làm mất báo cáo chờ.
  acknowledgePending(frame.ackSequence);
  if (duplicateFrame && pending.valid) {
    resendPending();
    return;
  }

  if (frame.messageType == POLL) {
    if (frame.payload[2] != 0 || frame.payload[3] != 0) {
      sendReject(frame, REASON_INVALID_RESERVED_BITS);
      return;
    }
    respondToPoll(frame);
    return;
  }

  if (frame.messageType == SNAPSHOT_REQUEST) {
    const uint16_t mask = getU16(frame.payload);
    if (getU16(frame.payload + 2) != 0 || mask == 0 || (mask & ~0x001FU) != 0) {
      sendReject(frame, REASON_INVALID_RESERVED_BITS);
      return;
    }
    snapshotActive = true;
    snapshotChanged = false;
    snapshotMask = mask;
    snapshotStep = 0;
    snapshotAlertIndex = 0;
    snapshotReportCount = 0;
    sendAccepted(frame, 0);
    return;
  }

  if (frame.messageType == SYNC_COMPLETE) {
    const uint32_t remoteConfig = getU32(frame.payload + 0);
    const uint32_t remoteState = getU32(frame.payload + 4);
    if (remoteConfig != (configValid ? config.version : 0) || remoteState != state.stateVersion || snapshotChanged) {
      sendReject(frame, REASON_SNAPSHOT_CHANGED);
    } else {
      linkReady = true;
      sendAccepted(frame, 0);
    }
    return;
  }

  if (frame.messageType != CONFIG_SET && frame.messageType != CONTROL_SET) {
    if (frame.correlationId != 0) sendReject(frame, REASON_UNSUPPORTED_TYPE);
    return;
  }

  if (frame.messageType == CONTROL_SET && !linkReady) {
    sendReject(frame, REASON_SESSION_NOT_READY);
    return;
  }

  TransactionCacheEntry* cached = findTransaction(frame);
  if (cached != nullptr) {
    if (cached->payloadHash == payloadHash(frame)) sendCachedTransaction(frame, *cached);
    else sendReject(frame, REASON_CORRELATION_REUSE_CONFLICT);
    return;
  }
  if (pending.valid) {
    sendReject(frame, REASON_BUSY);
    return;
  }

  if (frame.messageType == CONFIG_SET) {
    Config candidate{};
    if ((frame.payload[19] & 0xF8U) != 0) {
      sendReject(frame, REASON_INVALID_RESERVED_BITS);
      return;
    }
    if (!decodeConfigPayload(frame, candidate)) {
      counters.lastError = REASON_VALUE_OUT_OF_RANGE;
      sendReject(frame, REASON_VALUE_OUT_OF_RANGE);
      return;
    }
    if (configValid && candidate.version < config.version) {
      sendReject(frame, REASON_STALE_CONFIG_VERSION);
      return;
    }
    if (configValid && candidate.version == config.version) {
      uint8_t currentPayload[24] = {};
      fillConfigPayload(currentPayload);
      if (memcmp(currentPayload, frame.payload, 24) != 0) {
        sendReject(frame, REASON_CONFIG_VERSION_CONFLICT);
        return;
      }
      uint8_t payload[24] = {};
      fillAckPayload(payload, frame.messageType, 0, RESULT_DUPLICATE_OK, REASON_OK);
      cacheTransaction(frame, ACK, payload);
      Frame response{};
      response.messageType = ACK;
      response.flags = kFlagResponse;
      response.correlationId = frame.correlationId;
      memcpy(response.payload, payload, 24);
      response.payloadLength = 24;
      sendFrame(response);
      return;
    }
    applyConfig(candidate, true);
    sendAccepted(frame, 0);
    return;
  }

  uint32_t expectedState = 0;
  uint32_t baseConfig = 0;
  uint32_t newConfig = 0;
  uint8_t opcode = 0;
  uint8_t target = 0;
  uint8_t value = 0;
  uint8_t options = 0;
  if (!parseControl(frame, expectedState, baseConfig, newConfig, opcode, target, value, options)) {
    sendReject(frame, REASON_INVALID_ENUM, opcode);
    return;
  }
  if (expectedState != kNoExpectedState && expectedState != state.stateVersion) {
    sendReject(frame, REASON_STALE_STATE_VERSION, opcode);
    return;
  }
  uint16_t reason = REASON_OK;
  if (!applyControl(frame, opcode, target, value, options, baseConfig, newConfig, reason)) {
    sendReject(frame, reason, opcode);
    return;
  }
  sendAccepted(frame, opcode);
}

void serviceSerial() {
  const uint32_t now = millis();
  if (encodedRxLength > 0 && elapsed(now, encodedRxStartedMs, 200UL)) {
    encodedRxLength = 0;
    rxOverflow = false;
    saturatingIncrement(counters.rxFrameErrors);
    counters.lastError = REASON_INVALID_LENGTH;
  }

  while (linkSerial.available() > 0) {
    const int value = linkSerial.read();
    if (value < 0) break;
    const uint8_t byte = static_cast<uint8_t>(value);
    if (byte == 0) {
      if (rxOverflow) {
        saturatingIncrement(counters.rxFrameErrors);
        counters.lastError = REASON_FRAME_TOO_LARGE;
      } else if (encodedRxLength > 0) {
        Frame frame{};
        if (protocol::decodeFrame(encodedRx, encodedRxLength, frame)) {
          handleFrame(frame);
        } else {
          saturatingIncrement(counters.rxCrcErrors);
          counters.lastError = REASON_INVALID_LENGTH;
        }
      }
      encodedRxLength = 0;
      rxOverflow = false;
      continue;
    }
    if (encodedRxLength == 0) encodedRxStartedMs = now;
    if (encodedRxLength < protocol::kEncodedFrameCapacity) {
      encodedRx[encodedRxLength++] = byte;
    } else {
      rxOverflow = true;
    }
  }
}

void serviceLocalMute() {
  const uint32_t now = millis();
  const bool raw = digitalRead(kMuteButtonPin) != LOW;
  if (raw != lastMuteRaw) {
    lastMuteRaw = raw;
    muteChangedMs = now;
  }
  if (!elapsed(now, muteChangedMs, 30UL) || raw == stableMuteState) return;
  stableMuteState = raw;
  if (!stableMuteState && state.activeAlertCount > 0 && state.alertState == ALERT_SOUNDING) {
    state.alertState = ALERT_MUTED;
    markStateChanged(10, SEVERITY_NOTICE, SOURCE_SYSTEM, 0, 1);
  }
}

void heartbeat() {
  const uint32_t now = millis();
  if (!elapsed(now, lastHeartbeatMs, kHeartbeatIntervalMs)) return;
  lastHeartbeatMs = now;
  digitalWrite(kLocalStatusLedPin, !digitalRead(kLocalStatusLedPin));
}

}  // namespace

void begin() {
  resetCauseBits = MCUSR;
  MCUSR = 0;
  wdt_disable();

  pinMode(kBuzzerPin, OUTPUT);
  pinMode(kLockLedPin, OUTPUT);
  pinMode(kRoomLightPin, OUTPUT);
  pinMode(kFanLedPin, OUTPUT);
  pinMode(kAlarmLedPin, OUTPUT);
  pinMode(kLocalStatusLedPin, OUTPUT);
  pinMode(kMuteButtonPin, INPUT_PULLUP);

  Serial.begin(115200);
  linkSerial.begin(19200);
  linkSerial.listen();

  state = RuntimeState{};
  config = Config{};
  state.lockCommand = LOCK_LOCKED;
  lastLightChangeMs = millis();
  muteChangedMs = millis();
  applyOutputs();

  sensors.begin();
  queueEvent(0, SEVERITY_INFO, SOURCE_SYSTEM, 0, resetCauseBits, 0);
}

void tick() {
  const uint32_t now = millis();
  sensors.tick(now, config, configValid, state.zoneArmed);
  if (sensors.consumeSampleUpdated()) processSensorUpdate();
  serviceLocalMute();
  evaluateAutomaticLight(now);
  serviceSerial();
  heartbeat();
}

}  // namespace smartroom::uno
