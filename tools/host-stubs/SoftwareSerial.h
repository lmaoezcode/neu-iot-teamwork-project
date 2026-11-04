#pragma once

#include <stddef.h>
#include <stdint.h>
#include <deque>
#include <vector>

namespace software_serial_stub {
extern std::deque<uint8_t> rxBytes;
extern std::vector<uint8_t> txBytes;
}

class SoftwareSerial {
 public:
  SoftwareSerial(uint8_t, uint8_t) {}
  void begin(unsigned long) {}
  void listen() {}
  int available() { return static_cast<int>(software_serial_stub::rxBytes.size()); }
  int read() {
    if (software_serial_stub::rxBytes.empty()) return -1;
    const uint8_t value = software_serial_stub::rxBytes.front();
    software_serial_stub::rxBytes.pop_front();
    return value;
  }
  size_t write(const uint8_t* data, size_t length) {
    software_serial_stub::txBytes.insert(software_serial_stub::txBytes.end(), data, data + length);
    return length;
  }
  void flush() {}
};
