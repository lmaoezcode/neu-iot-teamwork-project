#include <Arduino.h>
#include "app.hpp"

SET_LOOP_TASK_STACK_SIZE(16 * 1024);

void setup() {
  smartroom::esp32::begin();
}

void loop() {
  smartroom::esp32::tick();
}
