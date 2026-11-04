#pragma once

#include <stddef.h>
#include <stdint.h>

namespace smartroom::esp32 {

enum class QueuedTopic : uint8_t { Event = 1, AlertEvent = 2, CommandResult = 3 };

struct QueuedMessage {
  uint32_t recordId = 0;
  QueuedTopic topic = QueuedTopic::Event;
  uint8_t qos = 1;
  bool retained = false;
  uint16_t length = 0;
  char payload[2049] = {};
};

struct EnqueueResult {
  bool stored = false;
  bool droppedOldest = false;
  uint32_t droppedTotal = 0;
};

class OfflineQueue {
 public:
  static constexpr uint16_t kCapacity = 128;
  static constexpr uint16_t kMaxPayload = 2048;

  bool begin();
  bool healthy() const { return healthy_; }
  uint16_t size() const { return static_cast<uint16_t>(count_); }
  uint32_t droppedTotal() const { return droppedTotal_; }
  EnqueueResult enqueue(QueuedTopic topic, uint8_t qos, bool retained, const char* payload, size_t length);
  bool peek(QueuedMessage& message);
  bool pop(uint32_t expectedRecordId);

 private:
  bool initializeFile();
  bool loadHeader();
  bool commitHeader();
  bool readRecord(uint16_t index, QueuedMessage& message);
  bool writeRecord(uint16_t index, const QueuedMessage& message);
  bool discardCorruptHead();

  bool healthy_ = false;
  uint8_t activeHeaderSlot_ = 0;
  uint32_t generation_ = 0;
  uint32_t head_ = 0;
  uint32_t count_ = 0;
  uint32_t nextRecordId_ = 1;
  uint32_t droppedTotal_ = 0;
};

}  // namespace smartroom::esp32
