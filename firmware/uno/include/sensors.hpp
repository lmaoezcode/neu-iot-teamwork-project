#pragma once

#include "domain.hpp"

namespace smartroom::uno {

class SensorManager {
 public:
  void begin();
  void tick(uint32_t nowMs, const Config& config, bool configValid, bool zoneArmed);
  const SensorSnapshot& snapshot() const { return snapshot_; }
  bool consumeSampleUpdated();

 private:
  void sampleLight(uint32_t nowMs, const Config& config, bool configValid);
  void sampleSafety(uint32_t nowMs, const Config& config, bool configValid);
  void serviceUltrasonic(uint32_t nowMs, const Config& config, bool configValid, bool zoneArmed);
  void updateQualityFlags(const Config& config, bool configValid);

  SensorSnapshot snapshot_{};
  uint32_t startedAtMs_ = 0;
  uint32_t lastLightSampleMs_ = 0;
  uint32_t lastSafetySampleMs_ = 0;
  uint32_t lastTriggerMs_ = 0;
  uint32_t triggerStartedUs_ = 0;
  uint32_t echoWaitStartedUs_ = 0;
  bool triggerHigh_ = false;
  bool waitingEcho_ = false;
  bool sampleUpdated_ = false;
  uint8_t doorObjectStreak_ = 0;
  uint8_t doorClearStreak_ = 0;
  uint8_t mq2AlertStreak_ = 0;
  uint8_t mq2NormalStreak_ = 0;
  uint8_t flameAlertStreak_ = 0;
  uint8_t flameNormalStreak_ = 0;
};

}  // namespace smartroom::uno
