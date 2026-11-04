#include "protocol.hpp"

#include <string.h>

namespace smartroom::uno::protocol {

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
    const size_t copyLength = static_cast<size_t>(code - 1);
    if (readIndex + copyLength > inputLength) return false;
    if (writeIndex + copyLength > outputCapacity) return false;

    for (size_t i = 0; i < copyLength; ++i) output[writeIndex++] = input[readIndex++];
    if (code != 0xFF && readIndex < inputLength) {
      if (writeIndex >= outputCapacity) return false;
      output[writeIndex++] = 0;
    }
  }
  outputLength = writeIndex;
  return true;
}

static void putU16(uint8_t* target, uint16_t value) {
  target[0] = static_cast<uint8_t>(value & 0xFFU);
  target[1] = static_cast<uint8_t>((value >> 8) & 0xFFU);
}

static void putU32(uint8_t* target, uint32_t value) {
  target[0] = static_cast<uint8_t>(value & 0xFFUL);
  target[1] = static_cast<uint8_t>((value >> 8) & 0xFFUL);
  target[2] = static_cast<uint8_t>((value >> 16) & 0xFFUL);
  target[3] = static_cast<uint8_t>((value >> 24) & 0xFFUL);
}

static uint16_t getU16(const uint8_t* source) {
  return static_cast<uint16_t>(source[0]) | static_cast<uint16_t>(source[1]) << 8;
}

static uint32_t getU32(const uint8_t* source) {
  return static_cast<uint32_t>(source[0]) |
      static_cast<uint32_t>(source[1]) << 8 |
      static_cast<uint32_t>(source[2]) << 16 |
      static_cast<uint32_t>(source[3]) << 24;
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
  const uint16_t crc = crc16CcittFalse(raw, rawLength - 2U);
  putU16(raw + rawLength - 2U, crc);

  size_t cobsLength = 0;
  if (!cobsEncode(raw, rawLength, encoded, encodedCapacity - 1U, cobsLength)) return false;
  if (cobsLength + 1U > encodedCapacity) return false;
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
  const uint16_t expected = getU16(raw + rawLength - 2U);
  const uint16_t actual = crc16CcittFalse(raw, rawLength - 2U);
  if (expected != actual) return false;
  if ((raw[2] & 0xC0U) != 0) return false;

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

}  // namespace smartroom::uno::protocol
