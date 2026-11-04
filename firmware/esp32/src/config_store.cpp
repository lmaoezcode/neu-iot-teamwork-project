#include "config_store.hpp"

#include <string.h>

#include "protocol.hpp"

namespace smartroom::esp32 {
namespace {

constexpr uint32_t kConfigMagic = 0x534D5243UL;  // SMRC
constexpr uint16_t kConfigBlobVersion = 1;

#pragma pack(push, 1)
struct ConfigBlob {
  uint32_t magic;
  uint16_t formatVersion;
  uint16_t length;
  uint32_t configVersion;
  uint16_t fieldMask;
  uint8_t lightOnPct;
  uint8_t lightOffPct;
  uint8_t controlMode;
  uint8_t roomProfile;
  uint16_t lightAdcDark;
  uint16_t lightAdcBright;
  uint16_t mq2BaselineAdc;
  uint16_t mq2SpanAdc;
  uint8_t mq2ThresholdPct;
  uint8_t configFlags;
  uint16_t doorThresholdMm;
  uint8_t doorConfirmSamples;
  uint8_t reserved;
  uint32_t checksum;
};
#pragma pack(pop)

static_assert(sizeof(ConfigBlob) == 36, "Dinh dang NVS phai on dinh");

uint32_t blobChecksum(const ConfigBlob& blob) {
  return protocol::crc32(reinterpret_cast<const uint8_t*>(&blob), offsetof(ConfigBlob, checksum));
}

ConfigBlob toBlob(const DeviceConfig& config) {
  ConfigBlob blob{};
  blob.magic = kConfigMagic;
  blob.formatVersion = kConfigBlobVersion;
  blob.length = sizeof(ConfigBlob);
  blob.configVersion = config.version;
  blob.fieldMask = config.fieldMask;
  blob.lightOnPct = config.lightOnPct;
  blob.lightOffPct = config.lightOffPct;
  blob.controlMode = config.controlMode;
  blob.roomProfile = config.roomProfile;
  blob.lightAdcDark = config.lightAdcDark;
  blob.lightAdcBright = config.lightAdcBright;
  blob.mq2BaselineAdc = config.mq2BaselineAdc;
  blob.mq2SpanAdc = config.mq2SpanAdc;
  blob.mq2ThresholdPct = config.mq2ThresholdPct;
  blob.configFlags = config.configFlags;
  blob.doorThresholdMm = config.doorThresholdMm;
  blob.doorConfirmSamples = config.doorConfirmSamples;
  blob.checksum = blobChecksum(blob);
  return blob;
}

bool fromBlob(const ConfigBlob& blob, DeviceConfig& config) {
  if (blob.magic != kConfigMagic || blob.formatVersion != kConfigBlobVersion || blob.length != sizeof(ConfigBlob) ||
      blob.reserved != 0 || blob.checksum != blobChecksum(blob)) return false;
  DeviceConfig candidate{};
  candidate.version = blob.configVersion;
  candidate.fieldMask = blob.fieldMask;
  candidate.lightOnPct = blob.lightOnPct;
  candidate.lightOffPct = blob.lightOffPct;
  candidate.controlMode = static_cast<ControlMode>(blob.controlMode);
  candidate.roomProfile = static_cast<RoomProfile>(blob.roomProfile);
  candidate.lightAdcDark = blob.lightAdcDark;
  candidate.lightAdcBright = blob.lightAdcBright;
  candidate.mq2BaselineAdc = blob.mq2BaselineAdc;
  candidate.mq2SpanAdc = blob.mq2SpanAdc;
  candidate.mq2ThresholdPct = blob.mq2ThresholdPct;
  candidate.configFlags = blob.configFlags;
  candidate.doorThresholdMm = blob.doorThresholdMm;
  candidate.doorConfirmSamples = blob.doorConfirmSamples;
  uint16_t reason = REASON_OK;
  if (!validateConfig(candidate, reason)) return false;
  config = candidate;
  return true;
}

}  // namespace

bool ConfigStore::begin() {
  if (open_) return true;
  open_ = preferences_.begin("smartroom", false);
  return open_;
}

void ConfigStore::end() {
  if (open_) preferences_.end();
  open_ = false;
}

bool ConfigStore::load(DeviceConfig& config) {
  if (!open_ || preferences_.getBytesLength("config") != sizeof(ConfigBlob)) return false;
  ConfigBlob blob{};
  if (preferences_.getBytes("config", &blob, sizeof(blob)) != sizeof(blob)) return false;
  return fromBlob(blob, config);
}

bool ConfigStore::save(const DeviceConfig& config) {
  if (!open_) return false;
  uint16_t reason = REASON_OK;
  if (!validateConfig(config, reason)) return false;
  const ConfigBlob blob = toBlob(config);
  return preferences_.putBytes("config", &blob, sizeof(blob)) == sizeof(blob);
}

bool ConfigStore::loadLastUnoBootId(uint32_t& unoBootId) {
  if (!open_ || !preferences_.isKey("uno_boot")) return false;
  unoBootId = preferences_.getUInt("uno_boot", 0);
  return unoBootId != 0;
}

bool ConfigStore::saveLastUnoBootId(uint32_t unoBootId) {
  return open_ && unoBootId != 0 && preferences_.putUInt("uno_boot", unoBootId) == sizeof(uint32_t);
}

}  // namespace smartroom::esp32
