#include "sensors.hpp"

#include <Arduino.h>

namespace smartroom::uno {
namespace {

constexpr uint8_t kLightAdcPin = A0;
constexpr uint8_t kMq2AdcPin = A1;
constexpr uint8_t kFlameDoPin = 4;
constexpr uint8_t kSrfTrigPin = 7;
constexpr uint8_t kSrfEchoPin = 2;
constexpr uint32_t kLightSampleIntervalMs = 2000UL;
constexpr uint32_t kSafetySampleIntervalMs = 200UL;
constexpr uint8_t kSafetyConfirmSamples = 3;
constexpr uint32_t kUltrasonicIntervalMs = 100UL;
constexpr uint32_t kUltrasonicTriggerPulseUs = 10UL;
constexpr uint32_t kUltrasonicTimeoutUs = 25000UL;
constexpr uint32_t kMq2WarmupMs = 60000UL;

#ifndef SMARTROOM_ENABLE_MQ2
#define SMARTROOM_ENABLE_MQ2 0
#endif

#ifndef SMARTROOM_ENABLE_FLAME_SENSOR
#define SMARTROOM_ENABLE_FLAME_SENSOR 0
#endif

#ifndef SMARTROOM_FLAME_ACTIVE_LOW
#define SMARTROOM_FLAME_ACTIVE_LOW 1
#endif

volatile uint32_t g_echoRiseUs = 0;
volatile uint32_t g_echoPulseUs = 0;
volatile bool g_echoReady = false;

void echoChanged() {
  if (digitalRead(kSrfEchoPin) != LOW) {
    g_echoRiseUs = micros();
  } else if (g_echoRiseUs != 0) {
    g_echoPulseUs = micros() - g_echoRiseUs;
    g_echoReady = true;
  }
}

bool elapsedMs(uint32_t now, uint32_t since, uint32_t interval) {
  return static_cast<uint32_t>(now - since) >= interval;
}

bool elapsedUs(uint32_t now, uint32_t since, uint32_t interval) {
  return static_cast<uint32_t>(now - since) >= interval;
}

uint8_t clampPct(int32_t value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return static_cast<uint8_t>(value);
}

uint8_t relativePct(uint16_t adc, uint16_t low, uint16_t span) {
  if (span == 0) return 0;
  const int32_t value = (static_cast<int32_t>(adc) - static_cast<int32_t>(low)) * 100L / static_cast<int32_t>(span);
  return clampPct(value);
}

}  // namespace

void SensorManager::begin() {
  pinMode(kLightAdcPin, INPUT);
  pinMode(kMq2AdcPin, INPUT);
  pinMode(kFlameDoPin, INPUT);
  pinMode(kSrfTrigPin, OUTPUT);
  digitalWrite(kSrfTrigPin, LOW);
  pinMode(kSrfEchoPin, INPUT);

  attachInterrupt(digitalPinToInterrupt(kSrfEchoPin), echoChanged, CHANGE);
  startedAtMs_ = millis();
  lastLightSampleMs_ = startedAtMs_ - kLightSampleIntervalMs;
  lastSafetySampleMs_ = startedAtMs_ - kSafetySampleIntervalMs;
  lastTriggerMs_ = startedAtMs_ - kUltrasonicIntervalMs;
  snapshot_.uptimeMs = startedAtMs_;
}

void SensorManager::tick(uint32_t nowMs, const Config& config, bool configValid, bool zoneArmed) {
  serviceUltrasonic(nowMs, config, configValid, zoneArmed);
  if (elapsedMs(nowMs, lastSafetySampleMs_, kSafetySampleIntervalMs)) sampleSafety(nowMs, config, configValid);
  if (elapsedMs(nowMs, lastLightSampleMs_, kLightSampleIntervalMs)) sampleLight(nowMs, config, configValid);
}

bool SensorManager::consumeSampleUpdated() {
  const bool updated = sampleUpdated_;
  sampleUpdated_ = false;
  return updated;
}

void SensorManager::sampleLight(uint32_t nowMs, const Config& config, bool configValid) {
  lastLightSampleMs_ = nowMs;
  snapshot_.uptimeMs = nowMs;
  snapshot_.sampleCounter = static_cast<uint16_t>(snapshot_.sampleCounter + 1U);

  snapshot_.lightAdc = static_cast<uint16_t>(analogRead(kLightAdcPin));
  if (configValid && (config.configFlags & (1U << 2)) != 0 && config.lightAdcBright > config.lightAdcDark) {
    snapshot_.lightPct = relativePct(snapshot_.lightAdc, config.lightAdcDark, static_cast<uint16_t>(config.lightAdcBright - config.lightAdcDark));
    snapshot_.lightQuality = QUALITY_VALID;
  } else {
    snapshot_.lightPct = 0;
    snapshot_.lightQuality = QUALITY_INVALID;
  }

  updateQualityFlags(config, configValid);
  sampleUpdated_ = true;
}

void SensorManager::sampleSafety(uint32_t nowMs, const Config& config, bool configValid) {
  lastSafetySampleMs_ = nowMs;
  snapshot_.uptimeMs = nowMs;
  snapshot_.sampleCounter = static_cast<uint16_t>(snapshot_.sampleCounter + 1U);

  snapshot_.mq2Adc = static_cast<uint16_t>(analogRead(kMq2AdcPin));
  const bool mq2Enabled = SMARTROOM_ENABLE_MQ2 != 0;
  const bool mq2Warming = !elapsedMs(nowMs, startedAtMs_, kMq2WarmupMs);
  const bool mq2Calibrated = configValid && (config.configFlags & (1U << 0)) != 0 && config.mq2SpanAdc > 0 &&
      static_cast<uint32_t>(config.mq2BaselineAdc) + config.mq2SpanAdc <= 1023UL;
  if (!mq2Enabled) {
    snapshot_.mq2State = SAFETY_SENSOR_FAULT;
    snapshot_.mq2Quality = QUALITY_INVALID;
    snapshot_.mq2Pct = 0;
    mq2AlertStreak_ = 0;
    mq2NormalStreak_ = 0;
  } else if (mq2Warming) {
    snapshot_.mq2State = SAFETY_WARMING;
    snapshot_.mq2Quality = QUALITY_INVALID;
    snapshot_.mq2Pct = 0;
    mq2AlertStreak_ = 0;
    mq2NormalStreak_ = 0;
  } else if (mq2Calibrated) {
    snapshot_.mq2Pct = relativePct(snapshot_.mq2Adc, config.mq2BaselineAdc, config.mq2SpanAdc);
    snapshot_.mq2Quality = QUALITY_VALID;
    if (snapshot_.mq2Pct >= config.mq2ThresholdPct) {
      mq2NormalStreak_ = 0;
      if (mq2AlertStreak_ < kSafetyConfirmSamples) ++mq2AlertStreak_;
      if (mq2AlertStreak_ >= kSafetyConfirmSamples) snapshot_.mq2State = SAFETY_ALERT;
      else if (snapshot_.mq2State != SAFETY_ALERT) snapshot_.mq2State = SAFETY_NORMAL;
    } else {
      mq2AlertStreak_ = 0;
      if (mq2NormalStreak_ < kSafetyConfirmSamples) ++mq2NormalStreak_;
      if (mq2NormalStreak_ >= kSafetyConfirmSamples) snapshot_.mq2State = SAFETY_NORMAL;
    }
  } else {
    snapshot_.mq2State = SAFETY_SENSOR_FAULT;
    snapshot_.mq2Quality = QUALITY_INVALID;
    snapshot_.mq2Pct = 0;
    mq2AlertStreak_ = 0;
    mq2NormalStreak_ = 0;
  }

  const bool flameEnabled = SMARTROOM_ENABLE_FLAME_SENSOR != 0;
  const bool flameActive = SMARTROOM_FLAME_ACTIVE_LOW != 0 ? digitalRead(kFlameDoPin) == LOW : digitalRead(kFlameDoPin) == HIGH;
  snapshot_.flameRaw = flameActive ? 1 : 0;
  if (flameEnabled) {
    snapshot_.flameQuality = QUALITY_VALID;
    if (flameActive) {
      flameNormalStreak_ = 0;
      if (flameAlertStreak_ < kSafetyConfirmSamples) ++flameAlertStreak_;
      if (flameAlertStreak_ >= kSafetyConfirmSamples) snapshot_.flameState = SAFETY_ALERT;
      else if (snapshot_.flameState != SAFETY_ALERT) snapshot_.flameState = SAFETY_NORMAL;
    } else {
      flameAlertStreak_ = 0;
      if (flameNormalStreak_ < kSafetyConfirmSamples) ++flameNormalStreak_;
      if (flameNormalStreak_ >= kSafetyConfirmSamples) snapshot_.flameState = SAFETY_NORMAL;
    }
  } else {
    snapshot_.flameState = SAFETY_SENSOR_FAULT;
    snapshot_.flameQuality = QUALITY_INVALID;
    flameAlertStreak_ = 0;
    flameNormalStreak_ = 0;
  }

  updateQualityFlags(config, configValid);
  sampleUpdated_ = true;
}

void SensorManager::serviceUltrasonic(uint32_t nowMs, const Config& config, bool configValid, bool zoneArmed) {
  const uint32_t nowUs = micros();
  if (triggerHigh_ && elapsedUs(nowUs, triggerStartedUs_, kUltrasonicTriggerPulseUs)) {
    digitalWrite(kSrfTrigPin, LOW);
    triggerHigh_ = false;
    waitingEcho_ = true;
    echoWaitStartedUs_ = nowUs;
  }

  if (waitingEcho_) {
    bool ready = false;
    uint32_t pulse = 0;
    noInterrupts();
    if (g_echoReady) {
      pulse = g_echoPulseUs;
      g_echoReady = false;
      ready = true;
    }
    interrupts();

    if (ready) {
      waitingEcho_ = false;
      // Đổi thời gian vọng (µs) sang mm: 1 cm ứng với 58 µs, nên mm = µs * 10 / 58.
      const uint32_t distance = (pulse * 10UL) / 58UL;
      if (distance >= 20UL && distance <= 3000UL) {
        snapshot_.distanceMm = static_cast<uint16_t>(distance);
        snapshot_.doorZoneQuality = configValid && (config.configFlags & (1U << 1)) != 0 ? QUALITY_VALID : QUALITY_INVALID;
        if (snapshot_.doorZoneQuality != QUALITY_VALID) {
          snapshot_.doorZoneState = DOOR_UNKNOWN;
          doorObjectStreak_ = 0;
          doorClearStreak_ = 0;
        } else if (!zoneArmed) {
          snapshot_.doorZoneState = DOOR_CLEAR;
          doorObjectStreak_ = 0;
          doorClearStreak_ = 0;
        } else if (snapshot_.distanceMm <= config.doorThresholdMm) {
          doorClearStreak_ = 0;
          if (doorObjectStreak_ < config.doorConfirmSamples) ++doorObjectStreak_;
          if (doorObjectStreak_ >= config.doorConfirmSamples) snapshot_.doorZoneState = DOOR_OBJECT;
          else if (snapshot_.doorZoneState == DOOR_UNKNOWN) snapshot_.doorZoneState = DOOR_CLEAR;
        } else {
          doorObjectStreak_ = 0;
          if (doorClearStreak_ < config.doorConfirmSamples) ++doorClearStreak_;
          if (doorClearStreak_ >= config.doorConfirmSamples) snapshot_.doorZoneState = DOOR_CLEAR;
          else if (snapshot_.doorZoneState == DOOR_UNKNOWN) snapshot_.doorZoneState = DOOR_CLEAR;
        }
      } else {
        snapshot_.distanceMm = 0xFFFF;
        snapshot_.doorZoneQuality = QUALITY_INVALID;
        snapshot_.doorZoneState = DOOR_UNKNOWN;
        doorObjectStreak_ = 0;
        doorClearStreak_ = 0;
      }
      snapshot_.uptimeMs = nowMs;
      snapshot_.sampleCounter = static_cast<uint16_t>(snapshot_.sampleCounter + 1U);
      updateQualityFlags(config, configValid);
      sampleUpdated_ = true;
    } else if (elapsedUs(nowUs, echoWaitStartedUs_, kUltrasonicTimeoutUs)) {
      waitingEcho_ = false;
      snapshot_.distanceMm = 0xFFFF;
      snapshot_.doorZoneQuality = QUALITY_INVALID;
      snapshot_.doorZoneState = DOOR_UNKNOWN;
      doorObjectStreak_ = 0;
      doorClearStreak_ = 0;
      snapshot_.uptimeMs = nowMs;
      snapshot_.sampleCounter = static_cast<uint16_t>(snapshot_.sampleCounter + 1U);
      updateQualityFlags(config, configValid);
      sampleUpdated_ = true;
    }
  }

  if (!triggerHigh_ && !waitingEcho_ && elapsedMs(nowMs, lastTriggerMs_, kUltrasonicIntervalMs)) {
    lastTriggerMs_ = nowMs;
    noInterrupts();
    g_echoReady = false;
    g_echoRiseUs = 0;
    interrupts();
    digitalWrite(kSrfTrigPin, HIGH);
    triggerStartedUs_ = nowUs;
    triggerHigh_ = true;
  }
}

void SensorManager::updateQualityFlags(const Config& config, bool configValid) {
  snapshot_.sensorFlags = 0;
  if (SMARTROOM_ENABLE_MQ2 != 0 && snapshot_.mq2State == SAFETY_WARMING) snapshot_.sensorFlags |= 1U << 0;
  if (snapshot_.mq2Quality == QUALITY_VALID) snapshot_.sensorFlags |= 1U << 1;
  if (configValid && (config.configFlags & (1U << 2)) != 0) snapshot_.sensorFlags |= 1U << 2;
  if (configValid && (config.configFlags & (1U << 1)) != 0) snapshot_.sensorFlags |= 1U << 3;
  if (SMARTROOM_ENABLE_FLAME_SENSOR != 0) snapshot_.sensorFlags |= 1U << 4;
  if (snapshot_.lightQuality != QUALITY_VALID || snapshot_.doorZoneQuality != QUALITY_VALID || snapshot_.mq2Quality != QUALITY_VALID || snapshot_.flameQuality != QUALITY_VALID) {
    snapshot_.sensorFlags |= 1U << 5;
  }
}

}  // namespace smartroom::uno
