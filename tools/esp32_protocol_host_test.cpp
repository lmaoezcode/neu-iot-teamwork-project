#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>

#include "protocol.hpp"

namespace {

using namespace smartroom::esp32;
using namespace smartroom::esp32::protocol;

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

  Frame hello{};
  hello.messageType = HELLO_REQUEST;
  hello.payloadLength = 8;
  hello.correlationId = 1;
  putU32(hello.payload, 0x12345678UL);
  hello.payload[4] = kProtocolVersion;
  hello.payload[5] = kProtocolVersion;
  const std::array<uint8_t, 28> expected{{
      0x03, 0x10, 0x01, 0x02, 0x08, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x02, 0x01, 0x01, 0x01,
      0x07, 0x78, 0x56, 0x34, 0x12, 0x10, 0x10, 0x01,
      0x03, 0x85, 0xD2, 0x00}};
  std::array<uint8_t, kEncodedFrameCapacity> wire{};
  size_t wireLength = 0;
  require(encodeFrame(hello, wire.data(), wire.size(), wireLength), "ma hoa HELLO_REQUEST");
  require(wireLength == expected.size(), "do dai vector day");
  for (size_t i = 0; i < expected.size(); ++i) require(wire[i] == expected[i], "vector day dung tai lieu");

  Frame decoded{};
  require(decodeFrame(wire.data(), wireLength - 1U, decoded), "giai ma vector day");
  require(decoded.correlationId == 1 && getU32(decoded.payload) == 0x12345678UL, "bao toan header/payload");

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

  DeviceConfig config{};
  config.version = 7;
  config.lightOnPct = 30;
  config.lightOffPct = 50;
  config.lightAdcDark = 80;
  config.lightAdcBright = 920;
  config.mq2BaselineAdc = 300;
  config.mq2SpanAdc = 500;
  config.mq2ThresholdPct = 60;
  config.configFlags = 0x06;
  config.doorThresholdMm = 350;
  config.doorConfirmSamples = 3;
  uint16_t reason = REASON_OK;
  require(validateConfig(config, reason), "cau hinh hop le");
  uint8_t configPayload[24] = {};
  encodeConfigPayload(config, configPayload);
  DeviceConfig decodedConfig{};
  require(decodeConfigPayload(configPayload, sizeof(configPayload), decodedConfig), "giai ma cau hinh");
  require(sameConfig(config, decodedConfig), "cau hinh round-trip");
  decodedConfig.lightOffPct = 32;
  require(!validateConfig(decodedConfig, reason) && reason == REASON_CONFIG_RELATION_INVALID, "tu choi vung tre sai");

  ControlRequest control{};
  control.expectedStateVersion = 44;
  control.baseConfigVersion = 13;
  control.newConfigVersion = 14;
  control.opcode = OP_SET_DEVICE;
  control.target = 1;
  control.value = 1;
  control.options = 0x03;
  uint8_t controlPayload[16] = {};
  encodeControlPayload(control, controlPayload);
  require(getU32(controlPayload) == 44 && getU32(controlPayload + 4) == 13 && getU32(controlPayload + 8) == 14,
          "phien ban CONTROL_SET");
  require(controlPayload[12] == OP_SET_DEVICE && controlPayload[13] == 1 && controlPayload[14] == 1 && controlPayload[15] == 3,
          "opcode/target/options CONTROL_SET");

  std::cout << "DAT: ESP32 codec, vector day, khung cat/hong va payload config/control\n";
  return 0;
}
