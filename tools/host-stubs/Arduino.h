#pragma once

#include <stddef.h>
#include <stdint.h>

constexpr uint8_t LOW = 0;
constexpr uint8_t HIGH = 1;
constexpr uint8_t INPUT = 0;
constexpr uint8_t OUTPUT = 1;
constexpr uint8_t INPUT_PULLUP = 2;
constexpr uint8_t CHANGE = 3;
constexpr uint8_t A0 = 14;
constexpr uint8_t A1 = 15;

namespace arduino_stub {
extern uint32_t nowMs;
extern uint32_t nowUs;
extern int digitalValues[32];
extern int analogValues[32];
extern uint8_t pinModes[32];
}

inline void pinMode(uint8_t pin, uint8_t mode) { arduino_stub::pinModes[pin] = mode; }
inline void digitalWrite(uint8_t pin, uint8_t value) { arduino_stub::digitalValues[pin] = value; }
inline int digitalRead(uint8_t pin) { return arduino_stub::digitalValues[pin]; }
inline int analogRead(uint8_t pin) { return arduino_stub::analogValues[pin]; }
inline uint32_t millis() { return arduino_stub::nowMs; }
inline uint32_t micros() { return arduino_stub::nowUs; }
inline int digitalPinToInterrupt(uint8_t pin) { return pin; }
inline void attachInterrupt(int, void (*)(), int) {}
inline void noInterrupts() {}
inline void interrupts() {}

class HardwareSerial {
 public:
  void begin(unsigned long) {}
};

extern HardwareSerial Serial;
