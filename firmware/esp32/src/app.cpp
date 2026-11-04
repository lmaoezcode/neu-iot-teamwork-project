#include "app.hpp"

#include <Arduino.h>
#include <esp_system.h>

#include "config_store.hpp"
#include "mqtt_gateway.hpp"
#include "offline_queue.hpp"
#include "uno_link.hpp"

namespace smartroom::esp32 {
namespace {

ConfigStore configStore;
OfflineQueue offlineQueue;
UnoLink unoLink(Serial2);
MqttGateway gateway(unoLink, configStore, offlineQueue);

uint32_t createBootId() {
  const uint32_t value = esp_random();
  return value == 0 ? 1 : value;
}

}  // namespace

void begin() {
  Serial.begin(115200);

  DeviceConfig cachedConfig{};
  const bool nvsReady = configStore.begin();
  const bool hasCachedConfig = nvsReady && configStore.load(cachedConfig);
  const bool queueReady = offlineQueue.begin();

  Serial.printf("[ESP32] NVS=%s, config=%s, offline_queue=%s\n",
                nvsReady ? "ready" : "failed",
                hasCachedConfig ? "valid" : "missing",
                queueReady ? "ready" : "failed");

  const uint32_t espBootId = createBootId();
  unoLink.setObserver(&gateway);
  gateway.begin(espBootId);
  unoLink.begin(espBootId, hasCachedConfig ? &cachedConfig : nullptr);
}

void tick() {
  const uint32_t now = millis();
  unoLink.tick(now);
  gateway.tick(now);
  yield();
}
}  // namespace smartroom::esp32
