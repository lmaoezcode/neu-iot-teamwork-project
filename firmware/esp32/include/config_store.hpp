#pragma once

#include <Preferences.h>

#include "domain.hpp"

namespace smartroom::esp32 {

class ConfigStore {
 public:
  bool begin();
  void end();
  bool load(DeviceConfig& config);
  bool save(const DeviceConfig& config);
  bool loadLastUnoBootId(uint32_t& unoBootId);
  bool saveLastUnoBootId(uint32_t unoBootId);

 private:
  Preferences preferences_;
  bool open_ = false;
};

}  // namespace smartroom::esp32
