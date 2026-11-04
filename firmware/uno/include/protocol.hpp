#pragma once

#include <stddef.h>
#include <stdint.h>

#include "domain.hpp"

namespace smartroom::uno::protocol {

constexpr size_t kDecodedFrameCapacity = 60;
constexpr size_t kEncodedFrameCapacity = 62;

uint16_t crc16CcittFalse(const uint8_t* data, size_t length);

// COBS không ghi byte 0 vào vùng dữ liệu; caller thêm delimiter sau khi mã hóa.
bool cobsEncode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength);
bool cobsDecode(const uint8_t* input, size_t inputLength, uint8_t* output, size_t outputCapacity, size_t& outputLength);

bool encodeFrame(const Frame& frame, uint8_t* encoded, size_t encodedCapacity, size_t& encodedLength);
bool decodeFrame(const uint8_t* encoded, size_t encodedLength, Frame& frame);

}  // namespace smartroom::uno::protocol
