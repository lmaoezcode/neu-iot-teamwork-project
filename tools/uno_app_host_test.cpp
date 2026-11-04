#include <array>
#include <cstdint>
#include <cstdlib>
#include <deque>
#include <iostream>
#include <vector>

#include <Arduino.h>
#include <SoftwareSerial.h>

#include "app.hpp"
#include "domain.hpp"
#include "protocol.hpp"

HardwareSerial Serial;
uint8_t MCUSR = 0;

namespace arduino_stub {
uint32_t nowMs = 0;
uint32_t nowUs = 0;
int digitalValues[32] = {};
int analogValues[32] = {};
uint8_t pinModes[32] = {};
}

namespace software_serial_stub {
std::deque<uint8_t> rxBytes;
std::vector<uint8_t> txBytes;
}

namespace {

using namespace smartroom::uno;

void require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "THAT_BAI: " << message << '\n';
    std::exit(1);
  }
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

uint32_t getU32(const uint8_t* source) {
  return static_cast<uint32_t>(source[0]) |
      static_cast<uint32_t>(source[1]) << 8 |
      static_cast<uint32_t>(source[2]) << 16 |
      static_cast<uint32_t>(source[3]) << 24;
}

std::vector<uint8_t> encode(const Frame& frame) {
  std::array<uint8_t, protocol::kEncodedFrameCapacity> bytes{};
  size_t length = 0;
  require(protocol::encodeFrame(frame, bytes.data(), bytes.size(), length), "khong ma hoa duoc khung dau vao");
  return std::vector<uint8_t>(bytes.begin(), bytes.begin() + static_cast<std::ptrdiff_t>(length));
}

Frame exchange(const Frame& request) {
  software_serial_stub::txBytes.clear();
  const std::vector<uint8_t> wire = encode(request);
  software_serial_stub::rxBytes.insert(software_serial_stub::rxBytes.end(), wire.begin(), wire.end());
  smartroom::uno::tick();
  require(!software_serial_stub::txBytes.empty(), "UNO khong tra loi");
  require(software_serial_stub::txBytes.back() == 0, "thieu delimiter tra loi");
  Frame response{};
  require(protocol::decodeFrame(software_serial_stub::txBytes.data(), software_serial_stub::txBytes.size() - 1U, response), "khong giai ma duoc tra loi");
  return response;
}

void injectWithoutResponse(const Frame& frame) {
  software_serial_stub::txBytes.clear();
  const std::vector<uint8_t> wire = encode(frame);
  software_serial_stub::rxBytes.insert(software_serial_stub::rxBytes.end(), wire.begin(), wire.end());
  smartroom::uno::tick();
}

Frame baseRequest(uint8_t type, uint32_t session, uint16_t sequence, uint16_t ack, uint32_t correlation, uint8_t length) {
  Frame frame{};
  frame.messageType = type;
  frame.sessionId = session;
  frame.sequence = sequence;
  frame.ackSequence = ack;
  frame.correlationId = correlation;
  frame.payloadLength = length;
  return frame;
}

}  // namespace

int main() {
  for (int& value : arduino_stub::digitalValues) value = HIGH;
  arduino_stub::analogValues[A0] = 0;
  arduino_stub::analogValues[A1] = 0;

  smartroom::uno::begin();
  require(arduino_stub::digitalValues[6] == LOW, "den phai tat khi khoi dong");
  require(arduino_stub::digitalValues[9] == LOW, "quat mo phong phai tat khi khoi dong");
  require(arduino_stub::digitalValues[5] == HIGH, "khoa mo phong phai o lenh KHOA");
  require(arduino_stub::digitalValues[3] == LOW, "coi mac dinh phai bi vo hieu hoa");

  Frame hello = baseRequest(HELLO_REQUEST, 0, 0, 0, 1, 8);
  putU32(hello.payload + 0, 0x12345678UL);
  hello.payload[4] = kProtocolVersion;
  hello.payload[5] = kProtocolVersion;
  Frame response = exchange(hello);
  require(response.messageType == HELLO && response.sessionId == 0 && response.sequence == 0, "bat tay HELLO");

  constexpr uint32_t sessionId = 0x2468ACE1UL;
  uint16_t inputSequence = 1;
  uint16_t outputAck = 0;
  Frame session = baseRequest(SESSION_START, sessionId, inputSequence, outputAck, 2, 16);
  putU32(session.payload + 0, 0);
  putU32(session.payload + 4, 0x12345678UL);
  putU32(session.payload + 8, 0);
  putU16(session.payload + 12, 200);
  putU16(session.payload + 14, 0);
  response = exchange(session);
  require(response.messageType == SESSION_ACCEPT && response.sequence == 1 && response.ackSequence == 1, "SESSION_ACCEPT");
  outputAck = response.sequence;

  Frame config = baseRequest(CONFIG_SET, sessionId, ++inputSequence, outputAck, 3, 24);
  putU32(config.payload + 0, 1);
  putU16(config.payload + 4, 0x003F);
  config.payload[6] = 30;
  config.payload[7] = 50;
  config.payload[8] = MODE_AUTO;
  config.payload[9] = PROFILE_HOME;
  putU16(config.payload + 10, 0);
  putU16(config.payload + 12, 1000);
  putU16(config.payload + 14, 0);
  putU16(config.payload + 16, 1);
  config.payload[18] = 80;
  config.payload[19] = static_cast<uint8_t>((1U << 1) | (1U << 2));
  putU16(config.payload + 20, 500);
  config.payload[22] = 3;

  Frame invalidConfig = config;
  invalidConfig.correlationId = 30;
  invalidConfig.payload[7] = 101;
  response = exchange(invalidConfig);
  require(response.messageType == NACK, "phai tu choi nguong anh sang vuot 100 phan tram");
  outputAck = response.sequence;

  config.sequence = ++inputSequence;
  config.ackSequence = outputAck;
  response = exchange(config);
  require(response.messageType == ACK && response.payload[2] == RESULT_APPLIED, "ap dung cau hinh");
  outputAck = response.sequence;

  Frame snapshot = baseRequest(SNAPSHOT_REQUEST, sessionId, ++inputSequence, outputAck, 4, 4);
  putU16(snapshot.payload + 0, 0x001F);
  response = exchange(snapshot);
  require(response.messageType == ACK, "chap nhan snapshot");
  outputAck = response.sequence;

  uint32_t snapshotConfigVersion = 0;
  uint32_t snapshotStateVersion = 0;
  bool snapshotEnded = false;
  for (uint8_t attempt = 0; attempt < 20 && !snapshotEnded; ++attempt) {
    Frame poll = baseRequest(POLL, sessionId, ++inputSequence, outputAck, 0, 4);
    response = exchange(poll);
    outputAck = response.sequence;
    if (response.messageType == SNAPSHOT_END) {
      snapshotConfigVersion = getU32(response.payload + 0);
      snapshotStateVersion = getU32(response.payload + 4);
      require(response.payload[8] >= 4, "snapshot thieu bao cao nen");
      require((response.payload[10] & 1U) != 0, "snapshot khong nhat quan");
      snapshotEnded = true;
    }
  }
  require(snapshotEnded && snapshotConfigVersion == 1, "khong hoan tat snapshot");

  Frame sync = baseRequest(SYNC_COMPLETE, sessionId, ++inputSequence, outputAck, 5, 8);
  putU32(sync.payload + 0, snapshotConfigVersion);
  putU32(sync.payload + 4, snapshotStateVersion);
  response = exchange(sync);
  require(response.messageType == ACK, "SYNC_COMPLETE");
  outputAck = response.sequence;

  Frame lightOn = baseRequest(CONTROL_SET, sessionId, ++inputSequence, outputAck, 6, 16);
  putU32(lightOn.payload + 0, snapshotStateVersion);
  putU32(lightOn.payload + 4, 1);
  putU32(lightOn.payload + 8, 2);
  lightOn.payload[12] = OP_SET_DEVICE;
  lightOn.payload[13] = 1;
  lightOn.payload[14] = 1;
  lightOn.payload[15] = 0x03;
  response = exchange(lightOn);
  require(response.messageType == ACK && response.payload[17] == MODE_MANUAL, "chuyen Thu cong va bat den");
  require((response.payload[18] & 1U) != 0 && arduino_stub::digitalValues[6] == HIGH, "phan hoi den thuc te");
  const uint32_t stateAfterLight = getU32(response.payload + 12);
  const std::vector<uint8_t> firstAckWire = software_serial_stub::txBytes;

  Frame wrongSession = baseRequest(POLL, sessionId ^ 1UL, static_cast<uint16_t>(inputSequence + 1U), response.sequence, 0, 4);
  injectWithoutResponse(wrongSession);
  require(software_serial_stub::txBytes.empty(), "khung sai phien khong duoc ACK hoac thay bao cao dang cho");

  response = exchange(lightOn);
  require(software_serial_stub::txBytes == firstAckWire, "retry phai tra lai dung byte ACK cu");
  require(getU32(response.payload + 12) == stateAfterLight, "lenh trung khong duoc thi hanh lai");
  outputAck = response.sequence;

  Frame away = baseRequest(CONTROL_SET, sessionId, ++inputSequence, outputAck, 7, 16);
  putU32(away.payload + 0, stateAfterLight);
  putU32(away.payload + 4, 2);
  putU32(away.payload + 8, 3);
  away.payload[12] = OP_SET_ROOM_PROFILE;
  away.payload[13] = 0;
  away.payload[14] = PROFILE_AWAY;
  response = exchange(away);
  require(response.messageType == ACK && response.payload[16] == PROFILE_AWAY, "chuyen Ra ngoai");
  require((response.payload[18] & 0x03U) == 0, "Ra ngoai phai tat den va quat");
  require((response.payload[18] & (1U << 2)) != 0, "Ra ngoai phai khoa mo phong");
  const uint32_t stateAway = getU32(response.payload + 12);
  outputAck = response.sequence;

  Frame blocked = baseRequest(CONTROL_SET, sessionId, ++inputSequence, outputAck, 8, 16);
  putU32(blocked.payload + 0, stateAway);
  putU32(blocked.payload + 4, 3);
  putU32(blocked.payload + 8, 3);
  blocked.payload[12] = OP_SET_DEVICE;
  blocked.payload[13] = 1;
  blocked.payload[14] = 1;
  response = exchange(blocked);
  require(response.messageType == NACK, "Ra ngoai phai tu choi bat den");
  require(arduino_stub::digitalValues[6] == LOW, "lenh bi tu choi khong duoc doi dau ra");

  std::cout << "DAT: khoi dong an toan, cau hinh bien, snapshot, dong bo, ACK lap/sai phien va rang buoc Ra ngoai\n";
  return 0;
}
