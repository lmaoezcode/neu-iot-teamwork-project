#pragma once

#include <stddef.h>
#include <stdint.h>

#include "domain.hpp"

namespace smartroom::esp32::protocol {

constexpr size_t kDecodedFrameCapacity = 60;
constexpr size_t kEncodedFrameCapacity = 62;

uint16_t crc16CcittFalse(const uint8_t* data, size_t length);
uint32_t fnv1a32(const uint8_t* data, size_t length);
uint32_t crc32(const uint8_t* data, size_t length);

bool cobsEncode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength);
bool cobsDecode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength);
bool encodeFrame(const Frame& frame, uint8_t* encoded, size_t encodedCapacity, size_t& encodedLength);
bool decodeFrame(const uint8_t* encoded, size_t encodedLength, Frame& frame);

void putU16(uint8_t* target, uint16_t value);
void putU32(uint8_t* target, uint32_t value);
uint16_t getU16(const uint8_t* source);
uint32_t getU32(const uint8_t* source);

void encodeConfigPayload(const DeviceConfig& config, uint8_t* payload);
bool decodeConfigPayload(const uint8_t* payload, size_t length, DeviceConfig& config);
void encodeControlPayload(const ControlRequest& request, uint8_t* payload);

}  // namespace smartroom::esp32::protocol
