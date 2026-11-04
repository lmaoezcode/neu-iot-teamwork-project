#include "protocol.hpp"

#include <string.h>

namespace smartroom::esp32 {

bool validateConfig(const DeviceConfig& config, uint16_t& reason) {
  reason = REASON_VALUE_OUT_OF_RANGE;
  if (config.version == 0 || config.version == 0xFFFFFFFFUL || config.fieldMask != kFullConfigMask) return false;
  if (config.lightOnPct > 80 || config.lightOffPct < 20 || config.lightOffPct > 100) return false;
  if (config.lightOffPct < static_cast<uint8_t>(config.lightOnPct + 5U)) {
    reason = REASON_CONFIG_RELATION_INVALID;
    return false;
  }
  if (config.controlMode > MODE_MANUAL || config.roomProfile > PROFILE_NIGHT) {
    reason = REASON_INVALID_ENUM;
    return false;
  }
  if ((config.configFlags & 0xF8U) != 0 || config.doorConfirmSamples < 1 || config.doorConfirmSamples > 10) return false;
  if (config.lightAdcDark > 1023U || config.lightAdcBright > 1023U) return false;
  if ((config.configFlags & 0x04U) != 0) {
    if (config.lightAdcDark >= config.lightAdcBright ||
        static_cast<uint16_t>(config.lightAdcBright - config.lightAdcDark) < 10U) {
      reason = REASON_CONFIG_RELATION_INVALID;
      return false;
    }
  }
  if (config.mq2BaselineAdc > 1023U || config.mq2SpanAdc == 0 || config.mq2SpanAdc > 1023U ||
      static_cast<uint32_t>(config.mq2BaselineAdc) + config.mq2SpanAdc > 1023U || config.mq2ThresholdPct > 100U) {
    reason = REASON_CONFIG_RELATION_INVALID;
    return false;
  }
  if (config.doorThresholdMm < 20U || config.doorThresholdMm > 4000U) return false;
  reason = REASON_OK;
  return true;
}

bool sameConfig(const DeviceConfig& left, const DeviceConfig& right) {
  return left.version == right.version && left.fieldMask == right.fieldMask && left.lightOnPct == right.lightOnPct &&
      left.lightOffPct == right.lightOffPct && left.controlMode == right.controlMode && left.roomProfile == right.roomProfile &&
      left.lightAdcDark == right.lightAdcDark && left.lightAdcBright == right.lightAdcBright &&
      left.mq2BaselineAdc == right.mq2BaselineAdc && left.mq2SpanAdc == right.mq2SpanAdc &&
      left.mq2ThresholdPct == right.mq2ThresholdPct && left.configFlags == right.configFlags &&
      left.doorThresholdMm == right.doorThresholdMm && left.doorConfirmSamples == right.doorConfirmSamples;
}

namespace protocol {

uint16_t crc16CcittFalse(const uint8_t* data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; ++i) {
    crc ^= static_cast<uint16_t>(data[i]) << 8;
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x8000U) != 0 ? static_cast<uint16_t>((crc << 1) ^ 0x1021U) : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

uint32_t fnv1a32(const uint8_t* data, size_t length) {
  uint32_t hash = 2166136261UL;
  for (size_t i = 0; i < length; ++i) {
    hash ^= data[i];
    hash *= 16777619UL;
  }
  return hash;
}

uint32_t crc32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFFUL;
  for (size_t i = 0; i < length; ++i) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; ++bit) crc = (crc >> 1) ^ (0xEDB88320UL & static_cast<uint32_t>(-static_cast<int32_t>(crc & 1U)));
  }
  return ~crc;
}

bool cobsEncode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength) {
  if (outputCapacity == 0 || inputLength > kDecodedFrameCapacity) return false;
  size_t codeIndex = 0;
  size_t writeIndex = 1;
  uint8_t code = 1;
  for (size_t i = 0; i < inputLength; ++i) {
    if (input[i] == 0) {
      if (codeIndex >= outputCapacity || writeIndex > outputCapacity) return false;
      output[codeIndex] = code;
      codeIndex = writeIndex++;
      code = 1;
    } else {
      if (writeIndex >= outputCapacity) return false;
      output[writeIndex++] = input[i];
      ++code;
      if (code == 0xFF) {
        output[codeIndex] = code;
        codeIndex = writeIndex++;
        code = 1;
      }
    }
  }
  if (codeIndex >= outputCapacity || writeIndex > outputCapacity) return false;
  output[codeIndex] = code;
  outputLength = writeIndex;
  return true;
}

bool cobsDecode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength) {
  if (inputLength == 0 || inputLength > kEncodedFrameCapacity) return false;
  size_t readIndex = 0;
  size_t writeIndex = 0;
  while (readIndex < inputLength) {
    const uint8_t code = input[readIndex++];
    if (code == 0) return false;
    const size_t copyLength = static_cast<size_t>(code - 1U);
    if (readIndex + copyLength > inputLength || writeIndex + copyLength > outputCapacity) return false;
    for (size_t i = 0; i < copyLength; ++i) output[writeIndex++] = input[readIndex++];
    if (code != 0xFF && readIndex < inputLength) {
      if (writeIndex >= outputCapacity) return false;
      output[writeIndex++] = 0;
    }
  }
  outputLength = writeIndex;
  return true;
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
  return static_cast<uint32_t>(source[0]) | static_cast<uint32_t>(source[1]) << 8 |
      static_cast<uint32_t>(source[2]) << 16 | static_cast<uint32_t>(source[3]) << 24;
}

bool encodeFrame(const Frame& frame, uint8_t* encoded, size_t encodedCapacity, size_t& encodedLength) {
  if (frame.payloadLength > kMaxPayload || encodedCapacity < kEncodedFrameCapacity) return false;
  uint8_t raw[kDecodedFrameCapacity] = {};
  raw[0] = frame.protocolVersion;
  raw[1] = frame.messageType;
  raw[2] = frame.flags;
  raw[3] = frame.payloadLength;
  putU32(raw + 4, frame.sessionId);
  putU16(raw + 8, frame.sequence);
  putU16(raw + 10, frame.ackSequence);
  putU32(raw + 12, frame.correlationId);
  if (frame.payloadLength > 0) memcpy(raw + 16, frame.payload, frame.payloadLength);
  const size_t rawLength = static_cast<size_t>(18U + frame.payloadLength);
  putU16(raw + rawLength - 2U, crc16CcittFalse(raw, rawLength - 2U));
  size_t cobsLength = 0;
  if (!cobsEncode(raw, rawLength, encoded, encodedCapacity - 1U, cobsLength) || cobsLength + 1U > encodedCapacity) return false;
  encoded[cobsLength] = 0;
  encodedLength = cobsLength + 1U;
  return true;
}

bool decodeFrame(const uint8_t* encoded, size_t encodedLength, Frame& frame) {
  if (encodedLength == 0 || encodedLength > kEncodedFrameCapacity) return false;
  uint8_t raw[kDecodedFrameCapacity] = {};
  size_t rawLength = 0;
  if (!cobsDecode(encoded, encodedLength, raw, sizeof(raw), rawLength)) return false;
  if (rawLength < 18U || raw[3] > kMaxPayload || rawLength != static_cast<size_t>(18U + raw[3])) return false;
  if (getU16(raw + rawLength - 2U) != crc16CcittFalse(raw, rawLength - 2U) || (raw[2] & 0xC0U) != 0) return false;
  frame = Frame{};
  frame.protocolVersion = raw[0];
  frame.messageType = raw[1];
  frame.flags = raw[2];
  frame.payloadLength = raw[3];
  frame.sessionId = getU32(raw + 4);
  frame.sequence = getU16(raw + 8);
  frame.ackSequence = getU16(raw + 10);
  frame.correlationId = getU32(raw + 12);
  if (frame.payloadLength > 0) memcpy(frame.payload, raw + 16, frame.payloadLength);
  return true;
}

void encodeConfigPayload(const DeviceConfig& config, uint8_t* payload) {
  memset(payload, 0, 24);
  putU32(payload + 0, config.version);
  putU16(payload + 4, config.fieldMask);
  payload[6] = config.lightOnPct;
  payload[7] = config.lightOffPct;
  payload[8] = config.controlMode;
  payload[9] = config.roomProfile;
  putU16(payload + 10, config.lightAdcDark);
  putU16(payload + 12, config.lightAdcBright);
  putU16(payload + 14, config.mq2BaselineAdc);
  putU16(payload + 16, config.mq2SpanAdc);
  payload[18] = config.mq2ThresholdPct;
  payload[19] = config.configFlags;
  putU16(payload + 20, config.doorThresholdMm);
  payload[22] = config.doorConfirmSamples;
}

bool decodeConfigPayload(const uint8_t* payload, size_t length, DeviceConfig& config) {
  if (length != 24 || payload[23] != 0) return false;
  config.version = getU32(payload + 0);
  config.fieldMask = getU16(payload + 4);
  config.lightOnPct = payload[6];
  config.lightOffPct = payload[7];
  config.controlMode = static_cast<ControlMode>(payload[8]);
  config.roomProfile = static_cast<RoomProfile>(payload[9]);
  config.lightAdcDark = getU16(payload + 10);
  config.lightAdcBright = getU16(payload + 12);
  config.mq2BaselineAdc = getU16(payload + 14);
  config.mq2SpanAdc = getU16(payload + 16);
  config.mq2ThresholdPct = payload[18];
  config.configFlags = payload[19];
  config.doorThresholdMm = getU16(payload + 20);
  config.doorConfirmSamples = payload[22];
  uint16_t reason = REASON_OK;
  return validateConfig(config, reason);
}

void encodeControlPayload(const ControlRequest& request, uint8_t* payload) {
  memset(payload, 0, 16);
  putU32(payload + 0, request.expectedStateVersion);
  putU32(payload + 4, request.baseConfigVersion);
  putU32(payload + 8, request.newConfigVersion);
  payload[12] = request.opcode;
  payload[13] = request.target;
  payload[14] = request.value;
  payload[15] = request.options;
}

}  // namespace protocol
}  // namespace smartroom::esp32
