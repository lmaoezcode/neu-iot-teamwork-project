#pragma once

#if __has_include("secrets.hpp")
#include "secrets.hpp"
#endif

#ifndef SMARTROOM_WIFI_SSID
#define SMARTROOM_WIFI_SSID ""
#endif

#ifndef SMARTROOM_WIFI_PASSWORD
#define SMARTROOM_WIFI_PASSWORD ""
#endif

#ifndef SMARTROOM_MQTT_HOST
#define SMARTROOM_MQTT_HOST ""
#endif

#ifndef SMARTROOM_MQTT_PORT
#define SMARTROOM_MQTT_PORT 1883
#endif

#ifndef SMARTROOM_MQTT_USERNAME
#define SMARTROOM_MQTT_USERNAME ""
#endif

#ifndef SMARTROOM_MQTT_PASSWORD
#define SMARTROOM_MQTT_PASSWORD ""
#endif

#ifndef SMARTROOM_DEVICE_ID
#define SMARTROOM_DEVICE_ID "room-01"
#endif

#ifndef SMARTROOM_NTP_SERVER_1
#define SMARTROOM_NTP_SERVER_1 "pool.ntp.org"
#endif

#ifndef SMARTROOM_NTP_SERVER_2
#define SMARTROOM_NTP_SERVER_2 "time.google.com"
#endif

namespace smartroom::esp32::runtime_config {

constexpr const char* kWifiSsid = SMARTROOM_WIFI_SSID;
constexpr const char* kWifiPassword = SMARTROOM_WIFI_PASSWORD;
constexpr const char* kMqttHost = SMARTROOM_MQTT_HOST;
constexpr uint16_t kMqttPort = SMARTROOM_MQTT_PORT;
constexpr const char* kMqttUsername = SMARTROOM_MQTT_USERNAME;
constexpr const char* kMqttPassword = SMARTROOM_MQTT_PASSWORD;
constexpr const char* kDeviceId = SMARTROOM_DEVICE_ID;
constexpr const char* kNtpServer1 = SMARTROOM_NTP_SERVER_1;
constexpr const char* kNtpServer2 = SMARTROOM_NTP_SERVER_2;

}  // namespace smartroom::esp32::runtime_config
