#pragma once

// Sao chép file này thành secrets.hpp rồi điền giá trị thật.
// secrets.hpp bị .gitignore loại khỏi kho mã nguồn.
#define SMARTROOM_WIFI_SSID "TEN_WIFI"
#define SMARTROOM_WIFI_PASSWORD "MAT_KHAU_WIFI"

// Broker MQTT ở Giai đoạn 13. Không công khai cổng 1883 ra Internet.
#define SMARTROOM_MQTT_HOST "192.168.1.10"
#define SMARTROOM_MQTT_PORT 1883
#define SMARTROOM_MQTT_USERNAME "room-01-device"
#define SMARTROOM_MQTT_PASSWORD "MAT_KHAU_MQTT"

#define SMARTROOM_DEVICE_ID "room-01"
#define SMARTROOM_NTP_SERVER_1 "pool.ntp.org"
#define SMARTROOM_NTP_SERVER_2 "time.google.com"
