#include "uno_link.hpp"

#include <esp_system.h>
#include <string.h>

namespace smartroom::esp32 {
namespace {

constexpr int kUnoRxPin = 16;
constexpr int kUnoTxPin = 17;
constexpr uint32_t kUartBaud = 19200;
constexpr uint32_t kResponseTimeoutMs = 150;
constexpr uint32_t kFrameTimeoutMs = 200;
constexpr uint32_t kPollIntervalMs = 200;
constexpr uint32_t kHelloIntervalMs = 1000;
constexpr uint8_t kMaximumAttempts = 3;
constexpr uint16_t kFullSnapshotMask = 0x001F;

bool elapsed(uint32_t now, uint32_t since, uint32_t interval) {
  return static_cast<uint32_t>(now - since) >= interval;
}

bool validQuality(uint8_t value) { return value <= QUALITY_INVALID; }
bool validSafety(uint8_t value) { return value <= SAFETY_SENSOR_FAULT; }
bool validSeverity(uint8_t value) { return value <= SEVERITY_CRITICAL; }
bool validAlertSource(uint8_t value) { return value <= SOURCE_MR01; }

}  // namespace

UnoLink::UnoLink(HardwareSerial& serial) : serial_(serial) {}

void UnoLink::begin(uint32_t espBootId, const DeviceConfig* cachedConfig) {
  espBootId_ = espBootId == 0 ? createNonZeroRandom() : espBootId;
  cachedConfigValid_ = false;
  if (cachedConfig != nullptr) {
    uint16_t reason = REASON_OK;
    if (validateConfig(*cachedConfig, reason)) {
      cachedConfig_ = *cachedConfig;
      cachedConfigValid_ = true;
    }
  }
  serial_.begin(kUartBaud, SERIAL_8N1, kUnoRxPin, kUnoTxPin);
  restartHandshake(REASON_OK, false);
}

void UnoLink::updateCachedConfig(const DeviceConfig& config) {
  uint16_t reason = REASON_OK;
  if (!validateConfig(config, reason)) return;
  cachedConfig_ = config;
  cachedConfigValid_ = true;
  currentConfigVersion_ = config.version;
}

uint32_t UnoLink::createNonZeroRandom() const {
  uint32_t value = esp_random();
  return value == 0 ? 1 : value;
}

uint16_t UnoLink::nextSequence() {
  const uint16_t value = nextTxSequence_;
  nextTxSequence_ = nextTxSequence_ == 0xFFFFU ? 1U : static_cast<uint16_t>(nextTxSequence_ + 1U);
  return value;
}

uint32_t UnoLink::nextCorrelation() {
  const uint32_t value = nextCorrelationId_ == 0 ? 1 : nextCorrelationId_;
  ++nextCorrelationId_;
  if (nextCorrelationId_ == 0) nextCorrelationId_ = 1;
  return value;
}

void UnoLink::setState(LinkState state, uint16_t reason) {
  if (state_ == state) return;
  state_ = state;
  if (observer_ != nullptr) observer_->onLinkStateChanged(state, reason);
}

void UnoLink::restartHandshake(uint16_t reason, bool countTimeout) {
  const TransactionKind abandonedKind = pending_.transactionKind;
  const uint32_t abandonedTag = pending_.tag;
  const uint32_t abandonedCorrelation = pending_.correlationId;
  pending_ = PendingRequest{};
  phase_ = Phase::NeedHello;
  sessionId_ = 0;
  nextTxSequence_ = 1;
  lastRxSequence_ = 0;
  lastIncomingSequence_ = 0;
  lastIncomingHash_ = 0;
  configConflict_ = false;
  nextHelloAtMs_ = millis();
  if (countTimeout) {
    missedWindows_ = static_cast<uint8_t>(missedWindows_ > 252U ? 255U : missedWindows_ + 3U);
    setState(missedWindows_ >= 15U ? LinkState::Offline : LinkState::Degraded, reason);
  } else {
    setState(LinkState::NoSession, reason);
  }
  if (abandonedKind != TransactionKind::None && observer_ != nullptr) {
    observer_->onTransactionResult(abandonedKind, abandonedTag, abandonedCorrelation, nullptr, true);
  }
}

bool UnoLink::sendRequest(Frame frame, RequestKind kind, TransactionKind transactionKind, uint32_t tag) {
  if (pending_.active) return false;
  const bool preSession = kind == RequestKind::Hello;
  if (frame.correlationId == 0) frame.correlationId = nextCorrelation();
  if (preSession) {
    frame.sessionId = 0;
    frame.sequence = 0;
    frame.ackSequence = 0;
  } else {
    if (sessionId_ == 0) return false;
    frame.sessionId = sessionId_;
    frame.sequence = nextSequence();
    frame.ackSequence = lastRxSequence_;
  }
  size_t encodedLength = 0;
  uint8_t encoded[protocol::kEncodedFrameCapacity] = {};
  if (!protocol::encodeFrame(frame, encoded, sizeof(encoded), encodedLength)) return false;
  if (serial_.write(encoded, encodedLength) != encodedLength) return false;
  pending_ = PendingRequest{};
  pending_.active = true;
  pending_.kind = kind;
  pending_.transactionKind = transactionKind;
  pending_.tag = tag;
  pending_.correlationId = frame.correlationId;
  pending_.sequence = frame.sequence;
  pending_.attempts = 1;
  pending_.sentAtMs = millis();
  pending_.encodedLength = encodedLength;
  memcpy(pending_.encoded, encoded, encodedLength);
  return true;
}

bool UnoLink::resendPending(uint32_t nowMs) {
  if (!pending_.active || pending_.attempts >= kMaximumAttempts) return false;
  if (serial_.write(pending_.encoded, pending_.encodedLength) != pending_.encodedLength) return false;
  ++pending_.attempts;
  pending_.sentAtMs = nowMs;
  return true;
}

void UnoLink::completePending() { pending_ = PendingRequest{}; }

uint32_t UnoLink::hashFrame(const Frame& frame) const {
  uint8_t raw[16 + kMaxPayload] = {};
  raw[0] = frame.protocolVersion;
  raw[1] = frame.messageType;
  raw[2] = frame.flags;
  raw[3] = frame.payloadLength;
  protocol::putU32(raw + 4, frame.sessionId);
  protocol::putU16(raw + 8, frame.sequence);
  protocol::putU16(raw + 10, frame.ackSequence);
  protocol::putU32(raw + 12, frame.correlationId);
  if (frame.payloadLength > 0) memcpy(raw + 16, frame.payload, frame.payloadLength);
  return protocol::fnv1a32(raw, 16U + frame.payloadLength);
}

bool UnoLink::acceptSequence(const Frame& frame, bool& duplicate) const {
  duplicate = frame.sequence == lastIncomingSequence_ && hashFrame(frame) == lastIncomingHash_ && frame.sequence != 0;
  if (duplicate) return true;
  const uint16_t expected = lastRxSequence_ == 0xFFFFU ? 1U : static_cast<uint16_t>(lastRxSequence_ + 1U);
  return frame.sequence == expected;
}

void UnoLink::commitSequence(const Frame& frame) {
  lastRxSequence_ = frame.sequence;
  lastIncomingSequence_ = frame.sequence;
  lastIncomingHash_ = hashFrame(frame);
}

void UnoLink::tick(uint32_t nowMs) {
  serviceReceive(nowMs);
  if (rxEncodedLength_ > 0 && elapsed(nowMs, rxStartedAtMs_, kFrameTimeoutMs)) {
    rxEncodedLength_ = 0;
    rxOverflow_ = false;
    if (observer_ != nullptr) observer_->onProtocolError(REASON_INVALID_LENGTH, 0);
  }
  handleTimeout(nowMs);
  drive(nowMs);
}

void UnoLink::serviceReceive(uint32_t nowMs) {
  while (serial_.available() > 0) {
    const int next = serial_.read();
    if (next < 0) break;
    const uint8_t value = static_cast<uint8_t>(next);
    if (value == 0) {
      if (rxOverflow_) {
        if (observer_ != nullptr) observer_->onProtocolError(REASON_FRAME_TOO_LARGE, 0);
      } else if (rxEncodedLength_ > 0) {
        Frame frame{};
        if (protocol::decodeFrame(rxEncoded_, rxEncodedLength_, frame)) handleFrame(frame, nowMs);
        else if (observer_ != nullptr) observer_->onProtocolError(REASON_CRC_ERROR, 0);
      }
      rxEncodedLength_ = 0;
      rxOverflow_ = false;
      continue;
    }
    if (rxEncodedLength_ == 0) rxStartedAtMs_ = nowMs;
    if (rxEncodedLength_ < protocol::kEncodedFrameCapacity) rxEncoded_[rxEncodedLength_++] = value;
    else rxOverflow_ = true;
  }
}

void UnoLink::handleTimeout(uint32_t nowMs) {
  if (!pending_.active || !elapsed(nowMs, pending_.sentAtMs, kResponseTimeoutMs)) return;
  if (resendPending(nowMs)) return;
  restartHandshake(REASON_LINK_TIMEOUT, true);
}

void UnoLink::drive(uint32_t nowMs) {
  if (pending_.active) return;
  if (phase_ == Phase::NeedHello) {
    if (static_cast<int32_t>(nowMs - nextHelloAtMs_) < 0) return;
    Frame frame{};
    frame.messageType = HELLO_REQUEST;
    frame.payloadLength = 8;
    protocol::putU32(frame.payload, espBootId_);
    frame.payload[4] = kProtocolVersion;
    frame.payload[5] = kProtocolVersion;
    if (!sendRequest(frame, RequestKind::Hello)) nextHelloAtMs_ = nowMs + kHelloIntervalMs;
    return;
  }
  if (phase_ == Phase::NeedSession) {
    sessionId_ = createNonZeroRandom();
    nextTxSequence_ = 1;
    lastRxSequence_ = 0;
    Frame frame{};
    frame.messageType = SESSION_START;
    frame.payloadLength = 16;
    protocol::putU32(frame.payload + 0, unoBootId_ == 0 ? createNonZeroRandom() : unoBootId_);
    protocol::putU32(frame.payload + 4, espBootId_);
    protocol::putU32(frame.payload + 8, cachedConfigValid_ ? cachedConfig_.version : 0);
    protocol::putU16(frame.payload + 12, kPollIntervalMs);
    protocol::putU16(frame.payload + 14, cachedConfigValid_ ? 1U : 0U);
    sendRequest(frame, RequestKind::Session);
    return;
  }
  if (phase_ == Phase::ReconcileConfig) {
    if (cachedConfigValid_ && cachedConfig_.version > currentConfigVersion_) {
      Frame frame{};
      frame.messageType = CONFIG_SET;
      frame.flags = FLAG_ACK_REQUIRED;
      frame.payloadLength = 24;
      protocol::encodeConfigPayload(cachedConfig_, frame.payload);
      sendRequest(frame, RequestKind::InitialConfig, TransactionKind::InitialConfig, 0);
      return;
    }
    configConflict_ = cachedConfigValid_ && currentConfigVersion_ > cachedConfig_.version;
    phase_ = Phase::NeedSnapshot;
  }
  if (phase_ == Phase::NeedSnapshot) {
    setState(LinkState::Syncing, configConflict_ ? REASON_CONFIG_VERSION_CONFLICT : REASON_OK);
    Frame frame{};
    frame.messageType = SNAPSHOT_REQUEST;
    frame.flags = FLAG_ACK_REQUIRED;
    frame.payloadLength = 4;
    protocol::putU16(frame.payload, kFullSnapshotMask);
    sendRequest(frame, RequestKind::SnapshotStart, TransactionKind::Snapshot, 0);
    return;
  }
  if (phase_ == Phase::CollectSnapshot) {
    if (!elapsed(nowMs, nextPollAtMs_, kPollIntervalMs)) return;
    Frame frame{};
    frame.messageType = POLL;
    frame.payloadLength = 4;
    protocol::putU16(frame.payload, 0x0007);
    if (sendRequest(frame, RequestKind::SnapshotPoll)) nextPollAtMs_ = nowMs;
    return;
  }
  if (phase_ == Phase::NeedSync) {
    Frame frame{};
    frame.messageType = SYNC_COMPLETE;
    frame.flags = FLAG_ACK_REQUIRED;
    frame.payloadLength = 8;
    protocol::putU32(frame.payload + 0, snapshotConfigVersion_);
    protocol::putU32(frame.payload + 4, snapshotStateVersion_);
    sendRequest(frame, RequestKind::Sync, TransactionKind::Sync, 0);
    return;
  }
  if (phase_ == Phase::Operational && elapsed(nowMs, nextPollAtMs_, kPollIntervalMs)) {
    Frame frame{};
    frame.messageType = POLL;
    frame.payloadLength = 4;
    // Poll vận hành không ép bit nào: nếu ép bit trạng thái, UNO trả STATE mãi và không bao giờ gửi SENSOR.
    protocol::putU16(frame.payload, 0x0000);
    if (sendRequest(frame, RequestKind::Poll)) nextPollAtMs_ = nowMs;
  }
}

void UnoLink::handleFrame(const Frame& frame, uint32_t nowMs) {
  if (!pending_.active || frame.protocolVersion != kProtocolVersion) return;
  if (pending_.kind == RequestKind::Hello) {
    HelloReport report{};
    if (frame.messageType != HELLO || frame.sessionId != 0 || frame.sequence != 0 || frame.correlationId != pending_.correlationId || !decodeHello(frame, report)) return;
    completePending();
    missedWindows_ = 0;
    unoBootId_ = report.unoBootId;
    currentConfigVersion_ = report.configVersion;
    currentStateVersion_ = report.stateVersion;
    capabilities_ = report.capabilities;
    if (observer_ != nullptr) observer_->onHello(report);
    phase_ = Phase::NeedSession;
    setState(LinkState::Syncing, REASON_OK);
    return;
  }
  if (sessionId_ == 0 || frame.sessionId != sessionId_ || frame.sequence == 0) {
    if (observer_ != nullptr) observer_->onProtocolError(REASON_SESSION_MISMATCH, frame.messageType);
    restartHandshake(REASON_SESSION_MISMATCH, false);
    return;
  }
  bool duplicate = false;
  if (!acceptSequence(frame, duplicate)) {
    if (observer_ != nullptr) observer_->onProtocolError(REASON_SEQUENCE_CONFLICT, frame.messageType);
    restartHandshake(REASON_SEQUENCE_CONFLICT, false);
    return;
  }
  if (duplicate) {
    // Khung cũ đến muộn không được phép hoàn tất yêu cầu mới đang chờ.
    return;
  }
  if (frame.ackSequence != pending_.sequence) {
    // Phản hồi nằm ngoài cửa sổ yêu cầu hiện tại: ghi lỗi và bỏ, không để
    // một khung đến muộn phá phiên đang còn khả năng tự phục hồi bằng retry.
    if (observer_ != nullptr) observer_->onProtocolError(REASON_SEQUENCE_CONFLICT, frame.messageType);
    return;
  }
  if (pending_.kind == RequestKind::Session) {
    if (frame.messageType != SESSION_ACCEPT || frame.correlationId != pending_.correlationId || frame.payloadLength != 16) return;
    const uint32_t acceptedUnoBoot = protocol::getU32(frame.payload + 0);
    if (acceptedUnoBoot == 0) return;
    unoBootId_ = acceptedUnoBoot;
    currentConfigVersion_ = protocol::getU32(frame.payload + 4);
    currentStateVersion_ = protocol::getU32(frame.payload + 8);
    capabilities_ = protocol::getU32(frame.payload + 12);
    commitSequence(frame);
    completePending();
    missedWindows_ = 0;
    phase_ = Phase::ReconcileConfig;
    return;
  }
  if (!handleBusinessFrame(frame)) return;
  commitSequence(frame);
  missedWindows_ = 0;
  completePending();
  nextPollAtMs_ = nowMs;
}

bool UnoLink::handleBusinessFrame(const Frame& frame) {
  if (frame.messageType == ACK || frame.messageType == NACK) {
    if (frame.correlationId != pending_.correlationId) return false;
    const uint8_t expectedRequestType =
        pending_.kind == RequestKind::InitialConfig || pending_.kind == RequestKind::DesiredConfig ? CONFIG_SET :
        pending_.kind == RequestKind::SnapshotStart ? SNAPSHOT_REQUEST :
        pending_.kind == RequestKind::Sync ? SYNC_COMPLETE :
        pending_.kind == RequestKind::Control ? CONTROL_SET : 0;
    if (expectedRequestType == 0 || frame.payloadLength != 24 || frame.payload[0] != expectedRequestType) return false;
    return handleAckFrame(frame);
  }
  if (pending_.kind != RequestKind::Poll && pending_.kind != RequestKind::SnapshotPoll) return false;
  if (frame.messageType == IDLE) return frame.payloadLength == 12;
  if (frame.messageType == CONFIG_REPORT) {
    bool empty = frame.payloadLength == 24;
    for (uint8_t i = 0; empty && i < 24; ++i) empty = frame.payload[i] == 0;
    if (empty) {
      currentConfigVersion_ = 0;
      return true;
    }
    DeviceConfig config{};
    if (!protocol::decodeConfigPayload(frame.payload, frame.payloadLength, config)) return false;
    currentConfigVersion_ = config.version;
    if (observer_ != nullptr) observer_->onConfigReport(config);
    return true;
  }
  if (frame.messageType == SENSOR_REPORT) {
    SensorReport report{};
    if (!decodeSensor(frame, report)) return false;
    if (observer_ != nullptr) observer_->onSensorReport(report);
    return true;
  }
  if (frame.messageType == STATE_REPORT) {
    StateReport report{};
    if (!decodeState(frame, report)) return false;
    currentConfigVersion_ = report.configVersion;
    currentStateVersion_ = report.stateVersion;
    if (observer_ != nullptr) observer_->onStateReport(report);
    return true;
  }
  if (frame.messageType == EVENT_REPORT) {
    EventReport report{};
    return decodeEvent(frame, report) && observer_ != nullptr && observer_->onEventReport(report);
  }
  if (frame.messageType == ALERT_REPORT) {
    AlertReport report{};
    return decodeAlert(frame, report) && observer_ != nullptr && observer_->onAlertReport(report);
  }
  if (frame.messageType == HEALTH_REPORT) {
    HealthReport report{};
    if (!decodeHealth(frame, report)) return false;
    if (observer_ != nullptr) observer_->onHealthReport(report);
    return true;
  }
  if (frame.messageType == ERROR_REPORT && frame.payloadLength == 12) {
    if (observer_ != nullptr) observer_->onProtocolError(protocol::getU16(frame.payload + 4), frame.payload[6]);
    return true;
  }
  if (frame.messageType == SNAPSHOT_END && pending_.kind == RequestKind::SnapshotPoll && frame.payloadLength == 12) {
    const uint16_t flags = protocol::getU16(frame.payload + 10);
    if ((flags & ~0x0003U) != 0 || (flags & 0x0001U) == 0 || (flags & 0x0002U) != 0) {
      phase_ = Phase::NeedSnapshot;
      return true;
    }
    snapshotConfigVersion_ = protocol::getU32(frame.payload + 0);
    snapshotStateVersion_ = protocol::getU32(frame.payload + 4);
    currentConfigVersion_ = snapshotConfigVersion_;
    currentStateVersion_ = snapshotStateVersion_;
    phase_ = Phase::NeedSync;
    return true;
  }
  return false;
}

bool UnoLink::handleAckFrame(const Frame& frame) {
  AckReport report{};
  if (!decodeAck(frame, report)) return false;
  const RequestKind kind = pending_.kind;
  const TransactionKind transactionKind = pending_.transactionKind;
  const uint32_t tag = pending_.tag;
  const uint32_t correlation = pending_.correlationId;
  currentConfigVersion_ = report.configVersion;
  currentStateVersion_ = report.stateVersion;

  if (kind == RequestKind::InitialConfig) {
    if (!report.nack) currentConfigVersion_ = cachedConfig_.version;
    else configConflict_ = true;
    phase_ = Phase::NeedSnapshot;
  } else if (kind == RequestKind::SnapshotStart) {
    phase_ = report.nack ? Phase::NeedSnapshot : Phase::CollectSnapshot;
    nextPollAtMs_ = millis();
  } else if (kind == RequestKind::Sync) {
    if (report.nack) {
      phase_ = Phase::NeedSnapshot;
    } else {
      phase_ = Phase::Operational;
      setState(LinkState::Ready, REASON_OK);
    }
  }

  if (transactionKind != TransactionKind::None && observer_ != nullptr) {
    observer_->onTransactionResult(transactionKind, tag, correlation, &report, false);
  }
  return true;
}

bool UnoLink::requestConfig(const DeviceConfig& config, uint32_t tag) {
  uint16_t reason = REASON_OK;
  if (!ready() || pending_.active || !validateConfig(config, reason)) return false;
  Frame frame{};
  frame.messageType = CONFIG_SET;
  frame.flags = FLAG_ACK_REQUIRED;
  frame.payloadLength = 24;
  protocol::encodeConfigPayload(config, frame.payload);
  return sendRequest(frame, RequestKind::DesiredConfig, TransactionKind::DesiredConfig, tag);
}

bool UnoLink::requestControl(const ControlRequest& request, uint32_t tag) {
  if (!ready() || pending_.active || request.opcode < OP_SET_DEVICE || request.opcode > OP_ALERT_ACTION || (request.options & 0xF8U) != 0) return false;
  Frame frame{};
  frame.messageType = CONTROL_SET;
  frame.flags = FLAG_ACK_REQUIRED;
  frame.payloadLength = 16;
  protocol::encodeControlPayload(request, frame.payload);
  return sendRequest(frame, RequestKind::Control, TransactionKind::Control, tag);
}

bool UnoLink::requestResync() {
  if (!ready() || pending_.active) return false;
  phase_ = Phase::NeedSnapshot;
  setState(LinkState::Syncing, REASON_OK);
  return true;
}

bool UnoLink::decodeHello(const Frame& frame, HelloReport& report) const {
  if (frame.payloadLength != 24 || (frame.flags & FLAG_RESPONSE) == 0) return false;
  report.unoBootId = protocol::getU32(frame.payload + 0);
  report.uptimeMs = protocol::getU32(frame.payload + 4);
  report.firmwareMajor = frame.payload[8];
  report.firmwareMinor = frame.payload[9];
  report.firmwarePatch = frame.payload[10];
  report.resetCauseBits = frame.payload[11];
  report.capabilities = protocol::getU32(frame.payload + 12);
  report.configVersion = protocol::getU32(frame.payload + 16);
  report.stateVersion = protocol::getU32(frame.payload + 20);
  return true;
}

bool UnoLink::decodeAck(const Frame& frame, AckReport& report) const {
  if (frame.payloadLength != 24 || (frame.flags & FLAG_RESPONSE) == 0 || frame.payload[3] != 0 || protocol::getU16(frame.payload + 6) != 0) return false;
  if (frame.payload[2] > RESULT_REJECTED || frame.payload[16] > PROFILE_NIGHT || frame.payload[17] > MODE_MANUAL ||
      frame.payload[19] > SOURCE_AUTO || frame.payload[20] > SOURCE_AUTO || frame.payload[21] > LOCK_UNKNOWN || frame.payload[23] > ALERT_AWAITING_ACK) return false;
  report.requestType = frame.payload[0];
  report.opcode = frame.payload[1];
  report.result = static_cast<ResultCode>(frame.payload[2]);
  report.reasonCode = protocol::getU16(frame.payload + 4);
  report.configVersion = protocol::getU32(frame.payload + 8);
  report.stateVersion = protocol::getU32(frame.payload + 12);
  report.roomProfile = static_cast<RoomProfile>(frame.payload[16]);
  report.controlMode = static_cast<ControlMode>(frame.payload[17]);
  report.outputBits = frame.payload[18];
  report.lampSource = static_cast<ControlSource>(frame.payload[19]);
  report.fanSource = static_cast<ControlSource>(frame.payload[20]);
  report.lockCommand = static_cast<LockCommand>(frame.payload[21]);
  report.actuatorFlags = frame.payload[22];
  report.alertState = static_cast<AlertLifecycle>(frame.payload[23]);
  report.nack = frame.messageType == NACK;
  if (report.nack != (report.result == RESULT_REJECTED)) return false;
  return true;
}

bool UnoLink::decodeSensor(const Frame& frame, SensorReport& report) const {
  if (frame.payloadLength != 24 || !validQuality(frame.payload[7]) || frame.payload[10] > DOOR_UNKNOWN ||
      !validQuality(frame.payload[11]) || !validSafety(frame.payload[15]) || !validQuality(frame.payload[16]) ||
      frame.payload[17] > 1 || !validSafety(frame.payload[18]) || !validQuality(frame.payload[19]) ||
      (protocol::getU16(frame.payload + 22) & 0xFFC0U) != 0) return false;
  report.uptimeMs = protocol::getU32(frame.payload + 0);
  report.lightAdc = protocol::getU16(frame.payload + 4);
  report.lightPct = frame.payload[6];
  report.lightQuality = static_cast<DataQuality>(frame.payload[7]);
  report.distanceMm = protocol::getU16(frame.payload + 8);
  report.doorZoneState = static_cast<DoorZoneState>(frame.payload[10]);
  report.doorZoneQuality = static_cast<DataQuality>(frame.payload[11]);
  report.mq2Adc = protocol::getU16(frame.payload + 12);
  report.mq2Pct = frame.payload[14];
  report.mq2State = static_cast<SafetyState>(frame.payload[15]);
  report.mq2Quality = static_cast<DataQuality>(frame.payload[16]);
  report.flameRaw = frame.payload[17];
  report.flameState = static_cast<SafetyState>(frame.payload[18]);
  report.flameQuality = static_cast<DataQuality>(frame.payload[19]);
  report.sampleCounter = protocol::getU16(frame.payload + 20);
  report.sensorFlags = protocol::getU16(frame.payload + 22);
  return report.lightAdc <= 1023U && report.lightPct <= 100U && report.mq2Adc <= 1023U && report.mq2Pct <= 100U;
}

bool UnoLink::decodeState(const Frame& frame, StateReport& report) const {
  if (frame.payloadLength != 24 || frame.payload[12] > PROFILE_NIGHT || frame.payload[13] > MODE_MANUAL ||
      (frame.payload[14] & 0xC0U) != 0 || frame.payload[15] > SOURCE_AUTO || frame.payload[16] > SOURCE_AUTO ||
      frame.payload[17] > LOCK_UNKNOWN || (frame.payload[18] & 0xE0U) != 0 || frame.payload[19] > 1 ||
      frame.payload[20] > ALERT_AWAITING_ACK || (protocol::getU16(frame.payload + 22) & 0xE000U) != 0) return false;
  report.uptimeMs = protocol::getU32(frame.payload + 0);
  report.stateVersion = protocol::getU32(frame.payload + 4);
  report.configVersion = protocol::getU32(frame.payload + 8);
  report.roomProfile = static_cast<RoomProfile>(frame.payload[12]);
  report.controlMode = static_cast<ControlMode>(frame.payload[13]);
  report.outputBits = frame.payload[14];
  report.lampSource = static_cast<ControlSource>(frame.payload[15]);
  report.fanSource = static_cast<ControlSource>(frame.payload[16]);
  report.lockCommand = static_cast<LockCommand>(frame.payload[17]);
  report.actuatorFlags = frame.payload[18];
  report.zoneArmed = frame.payload[19] != 0;
  report.alertState = static_cast<AlertLifecycle>(frame.payload[20]);
  report.activeAlertCount = frame.payload[21];
  report.healthFlags = protocol::getU16(frame.payload + 22);
  return true;
}

bool UnoLink::decodeEvent(const Frame& frame, EventReport& report) const {
  if (frame.payloadLength != 20 || frame.payload[12] > 12 || !validSeverity(frame.payload[13]) ||
      !validAlertSource(frame.payload[14]) || (frame.payload[15] & 0xF0U) != 0) return false;
  report.localEventId = protocol::getU32(frame.payload + 0);
  report.uptimeMs = protocol::getU32(frame.payload + 4);
  report.stateVersion = protocol::getU32(frame.payload + 8);
  report.eventType = frame.payload[12];
  report.severity = static_cast<Severity>(frame.payload[13]);
  report.source = static_cast<AlertSource>(frame.payload[14]);
  report.eventFlags = frame.payload[15];
  report.reasonCode = protocol::getU16(frame.payload + 16);
  report.detailValue = protocol::getU16(frame.payload + 18);
  return report.localEventId != 0;
}

bool UnoLink::decodeAlert(const Frame& frame, AlertReport& report) const {
  if (frame.payloadLength != 20 || frame.payload[8] > ALERT_RESTORED || frame.payload[9] > ALERT_SYSTEM ||
      !validSeverity(frame.payload[10]) || !validAlertSource(frame.payload[11]) || frame.payload[12] > ALERT_AWAITING_ACK ||
      frame.payload[13] > 1 || (protocol::getU16(frame.payload + 18) & 0xFFF0U) != 0) return false;
  report.causeId = protocol::getU32(frame.payload + 0);
  report.uptimeMs = protocol::getU32(frame.payload + 4);
  report.operation = static_cast<AlertOperation>(frame.payload[8]);
  report.type = static_cast<AlertType>(frame.payload[9]);
  report.severity = static_cast<Severity>(frame.payload[10]);
  report.source = static_cast<AlertSource>(frame.payload[11]);
  report.lifecycle = static_cast<AlertLifecycle>(frame.payload[12]);
  report.active = frame.payload[13] != 0;
  report.reasonCode = protocol::getU16(frame.payload + 14);
  report.detailValue = protocol::getU16(frame.payload + 16);
  report.alertFlags = protocol::getU16(frame.payload + 18);
  return report.causeId != 0;
}

bool UnoLink::decodeHealth(const Frame& frame, HealthReport& report) const {
  if (frame.payloadLength != 16 || (protocol::getU32(frame.payload + 4) & 0xFFFFE000UL) != 0) return false;
  report.uptimeMs = protocol::getU32(frame.payload + 0);
  report.healthFlags = protocol::getU32(frame.payload + 4);
  report.rxCrcErrors = protocol::getU16(frame.payload + 8);
  report.rxFrameErrors = protocol::getU16(frame.payload + 10);
  report.queueOverflows = protocol::getU16(frame.payload + 12);
  report.lastError = protocol::getU16(frame.payload + 14);
  return true;
}

}  // namespace smartroom::esp32
