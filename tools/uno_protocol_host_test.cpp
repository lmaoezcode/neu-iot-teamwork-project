#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>

#include "protocol.hpp"

namespace {

using smartroom::uno::Frame;
using namespace smartroom::uno;
using namespace smartroom::uno::protocol;

void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "THAT_BAI: " << message << '\n';
    std::exit(1);
  }
}

}  // namespace

int main() {
  const std::array<uint8_t, 9> crcVector{{'1', '2', '3', '4', '5', '6', '7', '8', '9'}};
  require(crc16CcittFalse(crcVector.data(), crcVector.size()) == 0x29B1U, "CRC-16/CCITT-FALSE");

  const std::array<uint8_t, 4> cobsRaw{{0x11, 0x22, 0x00, 0x33}};
  const std::array<uint8_t, 5> cobsExpected{{0x03, 0x11, 0x22, 0x02, 0x33}};
  std::array<uint8_t, kEncodedFrameCapacity> cobsEncoded{};
  size_t cobsLength = 0;
  require(cobsEncode(cobsRaw.data(), cobsRaw.size(), cobsEncoded.data(), cobsEncoded.size(), cobsLength), "ma hoa COBS");
  require(cobsLength == cobsExpected.size(), "do dai COBS");
  for (size_t i = 0; i < cobsExpected.size(); ++i) require(cobsEncoded[i] == cobsExpected[i], "vector COBS");

  Frame hello{};
  hello.messageType = HELLO_REQUEST;
  hello.payloadLength = 8;
  hello.correlationId = 1;
  hello.payload[0] = 0x78;
  hello.payload[1] = 0x56;
  hello.payload[2] = 0x34;
  hello.payload[3] = 0x12;
  hello.payload[4] = 0x10;
  hello.payload[5] = 0x10;

  const std::array<uint8_t, 28> wireExpected{{
      0x03, 0x10, 0x01, 0x02, 0x08, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x02, 0x01, 0x01, 0x01,
      0x07, 0x78, 0x56, 0x34, 0x12, 0x10, 0x10, 0x01,
      0x03, 0x85, 0xD2, 0x00}};
  std::array<uint8_t, kEncodedFrameCapacity> wire{};
  size_t wireLength = 0;
  require(encodeFrame(hello, wire.data(), wire.size(), wireLength), "ma hoa khung HELLO_REQUEST");
  require(wireLength == wireExpected.size(), "do dai khung HELLO_REQUEST");
  for (size_t i = 0; i < wireExpected.size(); ++i) require(wire[i] == wireExpected[i], "vector day HELLO_REQUEST");

  Frame decoded{};
  require(decodeFrame(wire.data(), wireLength - 1U, decoded), "giai ma HELLO_REQUEST");
  require(decoded.messageType == HELLO_REQUEST && decoded.correlationId == 1 && decoded.payloadLength == 8, "noi dung HELLO_REQUEST");

  for (size_t length = 0; length < wireLength - 1U; ++length) {
    Frame truncated{};
    require(!decodeFrame(wire.data(), length, truncated), "tu choi khung bi cat");
  }
  require(!decodeFrame(wire.data(), wireLength, decoded), "tu choi delimiter nam trong payload COBS");
  for (size_t index = 0; index < wireLength - 1U; ++index) {
    auto corrupted = wire;
    corrupted[index] ^= static_cast<uint8_t>(1U << (index % 8U));
    Frame rejected{};
    require(!decodeFrame(corrupted.data(), wireLength - 1U, rejected), "tu choi khung hong mot bit");
  }

  Frame boundary{};
  boundary.messageType = SENSOR_REPORT;
  boundary.payloadLength = kMaxPayload;
  for (uint8_t i = 0; i < kMaxPayload; ++i) boundary.payload[i] = static_cast<uint8_t>(i * 7U);
  require(encodeFrame(boundary, wire.data(), wire.size(), wireLength), "payload 42 byte");
  require(wireLength <= kEncodedFrameCapacity, "gioi han 62 byte tren day");
  require(decodeFrame(wire.data(), wireLength - 1U, decoded), "giai ma payload 42 byte");
  require(decoded.payloadLength == kMaxPayload, "bao toan do dai payload");
  boundary.payloadLength = static_cast<uint8_t>(kMaxPayload + 1U);
  require(!encodeFrame(boundary, wire.data(), wire.size(), wireLength), "tu choi payload 43 byte");

  std::cout << "DAT: CRC, COBS, HELLO_REQUEST, khung cat/hong va bien payload 0/42/43\n";
  return 0;
}
