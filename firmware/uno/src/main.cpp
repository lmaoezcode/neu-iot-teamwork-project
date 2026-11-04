#include <Arduino.h>

#include "app.hpp"

void setup() {
  smartroom::uno::begin();
}

void loop() {
  smartroom::uno::tick();
}
