#pragma once

#include <stddef.h>
#include <stdint.h>

namespace smartroom::esp32 {

constexpr uint8_t kProtocolVersion = 0x10;
constexpr uint8_t kMaxPayload = 42;
constexpr uint16_t kFullConfigMask = 0x003F;
constexpr uint32_t kAnyStateVersion = 0xFFFFFFFFUL;

enum MessageType : uint8_t {
  HELLO_REQUEST = 0x01,
  HELLO = 0x02,
  SESSION_START = 0x03,
  SESSION_ACCEPT = 0x04,
  POLL = 0x05,
  IDLE = 0x06,
  SNAPSHOT_REQUEST = 0x07,
  SNAPSHOT_END = 0x08,
  SYNC_COMPLETE = 0x09,
  ACK = 0x0A,
  NACK = 0x0B,
  ERROR_REPORT = 0x0C,
  CONFIG_SET = 0x10,
  CONFIG_REPORT = 0x11,
  CONTROL_SET = 0x20,
  SENSOR_REPORT = 0x30,
  STATE_REPORT = 0x31,
  EVENT_REPORT = 0x32,
  ALERT_REPORT = 0x33,
  HEALTH_REPORT = 0x34
};

enum FrameFlag : uint8_t {
  FLAG_ACK_REQUIRED = 1U << 0,
  FLAG_RESPONSE = 1U << 1,
  FLAG_ERROR = 1U << 2,
  FLAG_SNAPSHOT = 1U << 3,
  FLAG_MORE = 1U << 4,
  FLAG_PRIORITY = 1U << 5
};

enum DataQuality : uint8_t { QUALITY_VALID = 0, QUALITY_STALE = 1, QUALITY_INVALID = 2 };
enum ControlMode : uint8_t { MODE_AUTO = 0, MODE_MANUAL = 1 };
enum RoomProfile : uint8_t { PROFILE_HOME = 0, PROFILE_AWAY = 1, PROFILE_NIGHT = 2 };
enum SafetyState : uint8_t { SAFETY_WARMING = 0, SAFETY_NORMAL = 1, SAFETY_ALERT = 2, SAFETY_SENSOR_FAULT = 3 };
enum AlertType : uint8_t { ALERT_SAFETY = 0, ALERT_SECURITY = 1, ALERT_SYSTEM = 2 };
enum Severity : uint8_t { SEVERITY_INFO = 0, SEVERITY_NOTICE = 1, SEVERITY_WARNING = 2, SEVERITY_CRITICAL = 3 };
enum DoorZoneState : uint8_t { DOOR_CLEAR = 0, DOOR_OBJECT = 1, DOOR_UNKNOWN = 2 };
enum LockCommand : uint8_t { LOCK_LOCKED = 0, LOCK_UNLOCKED = 1, LOCK_UNKNOWN = 2 };
enum AlertLifecycle : uint8_t { ALERT_NORMAL = 0, ALERT_SOUNDING = 1, ALERT_MUTED = 2, ALERT_AWAITING_ACK = 3 };
enum ControlSource : uint8_t { SOURCE_POWER = 0, SOURCE_SAFETY = 1, SOURCE_SECURITY = 2, SOURCE_PROFILE = 3, SOURCE_MANUAL = 4, SOURCE_AUTO = 5 };
enum AlertOperation : uint8_t { ALERT_ADD = 0, ALERT_CLEAR = 1, ALERT_REACTIVATE = 2, ALERT_RESTORED = 3 };
enum AlertSource : uint8_t { SOURCE_MQ2 = 0, SOURCE_FLAME = 1, SOURCE_DOOR = 2, SOURCE_LIGHT = 3, SOURCE_LINK = 4, SOURCE_POWER_ALERT = 5, SOURCE_SYSTEM = 6, SOURCE_MR01 = 7 };
enum AlertAction : uint8_t { ALERT_MUTE = 0, ALERT_ACKNOWLEDGE = 1 };
enum ResultCode : uint8_t { RESULT_APPLIED = 0, RESULT_DUPLICATE_OK = 1, RESULT_REJECTED = 2 };
enum Opcode : uint8_t { OP_SET_DEVICE = 1, OP_SET_CONTROL_MODE = 2, OP_SET_ROOM_PROFILE = 3, OP_SET_LOCK = 4, OP_ALERT_ACTION = 5 };

enum ReasonCode : uint16_t {
  REASON_OK = 0x0000,
  REASON_UNSUPPORTED_VERSION = 0x0101,
  REASON_UNSUPPORTED_TYPE = 0x0102,
  REASON_INVALID_LENGTH = 0x0103,
  REASON_INVALID_ENUM = 0x0104,
  REASON_INVALID_RESERVED_BITS = 0x0105,
  REASON_CRC_ERROR = 0x0106,
  REASON_FRAME_TOO_LARGE = 0x0107,
  REASON_SESSION_NOT_READY = 0x0201,
  REASON_SESSION_MISMATCH = 0x0202,
  REASON_SEQUENCE_CONFLICT = 0x0203,
  REASON_CORRELATION_REUSE_CONFLICT = 0x0204,
  REASON_BUSY = 0x0205,
  REASON_VALUE_OUT_OF_RANGE = 0x0301,
  REASON_CONFIG_RELATION_INVALID = 0x0302,
  REASON_STALE_CONFIG_VERSION = 0x0303,
  REASON_STALE_STATE_VERSION = 0x0304,
  REASON_CONFIG_VERSION_CONFLICT = 0x0305,
  REASON_ROOM_PROFILE_BLOCK = 0x0401,
  REASON_MANUAL_CONFIRM_REQUIRED = 0x0402,
  REASON_SECURITY_BLOCK = 0x0403,
  REASON_ALERT_CAUSE_ACTIVE = 0x0404,
  REASON_SENSOR_INVALID = 0x0405,
  REASON_POWER_PROTECTION_ACTIVE = 0x0406,
  REASON_APPLY_FAILED = 0x0501,
  REASON_QUEUE_FULL = 0x0502,
  REASON_SNAPSHOT_CHANGED = 0x0503,
  REASON_LINK_TIMEOUT = 0x0601
};

enum class LinkState : uint8_t { NoSession, Syncing, Ready, Degraded, Offline };
enum class TransactionKind : uint8_t { None, InitialConfig, DesiredConfig, Control, Snapshot, Sync };

struct DeviceConfig {
  uint32_t version = 0;
  uint16_t fieldMask = kFullConfigMask;
  uint8_t lightOnPct = 30;
  uint8_t lightOffPct = 50;
  ControlMode controlMode = MODE_AUTO;
  RoomProfile roomProfile = PROFILE_HOME;
  uint16_t lightAdcDark = 0;
  uint16_t lightAdcBright = 1023;
  uint16_t mq2BaselineAdc = 0;
  uint16_t mq2SpanAdc = 1;
  uint8_t mq2ThresholdPct = 80;
  uint8_t configFlags = 0;
  uint16_t doorThresholdMm = 500;
  uint8_t doorConfirmSamples = 3;
};

struct ControlRequest {
  uint32_t expectedStateVersion = kAnyStateVersion;
  uint32_t baseConfigVersion = 0;
  uint32_t newConfigVersion = 0;
  Opcode opcode = OP_SET_DEVICE;
  uint8_t target = 0;
  uint8_t value = 0;
  uint8_t options = 0;
};

struct Frame {
  uint8_t protocolVersion = kProtocolVersion;
  uint8_t messageType = IDLE;
  uint8_t flags = 0;
  uint8_t payloadLength = 0;
  uint32_t sessionId = 0;
  uint16_t sequence = 0;
  uint16_t ackSequence = 0;
  uint32_t correlationId = 0;
  uint8_t payload[kMaxPayload] = {};
};

struct HelloReport {
  uint32_t unoBootId = 0;
  uint32_t uptimeMs = 0;
  uint8_t firmwareMajor = 0;
  uint8_t firmwareMinor = 0;
  uint8_t firmwarePatch = 0;
  uint8_t resetCauseBits = 0;
  uint32_t capabilities = 0;
  uint32_t configVersion = 0;
  uint32_t stateVersion = 0;
};

struct SensorReport {
  uint32_t uptimeMs = 0;
  uint16_t lightAdc = 0;
  uint8_t lightPct = 0;
  DataQuality lightQuality = QUALITY_INVALID;
  uint16_t distanceMm = 0xFFFF;
  DoorZoneState doorZoneState = DOOR_UNKNOWN;
  DataQuality doorZoneQuality = QUALITY_INVALID;
  uint16_t mq2Adc = 0;
  uint8_t mq2Pct = 0;
  SafetyState mq2State = SAFETY_WARMING;
  DataQuality mq2Quality = QUALITY_INVALID;
  uint8_t flameRaw = 0;
  SafetyState flameState = SAFETY_SENSOR_FAULT;
  DataQuality flameQuality = QUALITY_INVALID;
  uint16_t sampleCounter = 0;
  uint16_t sensorFlags = 0;
};

struct StateReport {
  uint32_t uptimeMs = 0;
  uint32_t stateVersion = 0;
  uint32_t configVersion = 0;
  RoomProfile roomProfile = PROFILE_HOME;
  ControlMode controlMode = MODE_AUTO;
  uint8_t outputBits = 0;
  ControlSource lampSource = SOURCE_POWER;
  ControlSource fanSource = SOURCE_POWER;
  LockCommand lockCommand = LOCK_UNKNOWN;
  uint8_t actuatorFlags = 0;
  bool zoneArmed = false;
  AlertLifecycle alertState = ALERT_NORMAL;
  uint8_t activeAlertCount = 0;
  uint16_t healthFlags = 0;
};

struct EventReport {
  uint32_t localEventId = 0;
  uint32_t uptimeMs = 0;
  uint32_t stateVersion = 0;
  uint8_t eventType = 0;
  Severity severity = SEVERITY_INFO;
  AlertSource source = SOURCE_SYSTEM;
  uint8_t eventFlags = 0;
  uint16_t reasonCode = 0;
  uint16_t detailValue = 0;
};

struct AlertReport {
  uint32_t causeId = 0;
  uint32_t uptimeMs = 0;
  AlertOperation operation = ALERT_ADD;
  AlertType type = ALERT_SYSTEM;
  Severity severity = SEVERITY_NOTICE;
  AlertSource source = SOURCE_SYSTEM;
  AlertLifecycle lifecycle = ALERT_NORMAL;
  bool active = false;
  uint16_t reasonCode = 0;
  uint16_t detailValue = 0;
  uint16_t alertFlags = 0;
};

struct HealthReport {
  uint32_t uptimeMs = 0;
  uint32_t healthFlags = 0;
  uint16_t rxCrcErrors = 0;
  uint16_t rxFrameErrors = 0;
  uint16_t queueOverflows = 0;
  uint16_t lastError = 0;
};

struct AckReport {
  uint8_t requestType = 0;
  uint8_t opcode = 0;
  ResultCode result = RESULT_REJECTED;
  uint16_t reasonCode = REASON_OK;
  uint32_t configVersion = 0;
  uint32_t stateVersion = 0;
  RoomProfile roomProfile = PROFILE_HOME;
  ControlMode controlMode = MODE_AUTO;
  uint8_t outputBits = 0;
  ControlSource lampSource = SOURCE_POWER;
  ControlSource fanSource = SOURCE_POWER;
  LockCommand lockCommand = LOCK_UNKNOWN;
  uint8_t actuatorFlags = 0;
  AlertLifecycle alertState = ALERT_NORMAL;
  bool nack = false;
};

bool validateConfig(const DeviceConfig& config, uint16_t& reason);
bool sameConfig(const DeviceConfig& left, const DeviceConfig& right);

}  // namespace smartroom::esp32
