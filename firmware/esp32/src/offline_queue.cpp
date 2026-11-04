#include "offline_queue.hpp"

#include <FS.h>
#include <LittleFS.h>
#include <string.h>

#include "protocol.hpp"

namespace smartroom::esp32 {
namespace {

constexpr char kQueuePath[] = "/offline.queue";
constexpr uint32_t kHeaderMagic = 0x53525148UL;  // SRQH
constexpr uint32_t kRecordMagic = 0x53525152UL;  // SRQR
constexpr uint16_t kFormatVersion = 1;

#pragma pack(push, 1)
struct QueueHeader {
  uint32_t magic;
  uint16_t formatVersion;
  uint16_t capacity;
  uint32_t generation;
  uint32_t head;
  uint32_t count;
  uint32_t nextRecordId;
  uint32_t droppedTotal;
  uint32_t checksum;
};

struct RecordHeader {
  uint32_t magic;
  uint32_t recordId;
  uint8_t topic;
  uint8_t qos;
  uint8_t retained;
  uint8_t reserved;
  uint16_t length;
  uint16_t reserved2;
  uint32_t checksum;
};
#pragma pack(pop)

constexpr size_t kHeaderSlots = 2;
constexpr size_t kRecordSize = sizeof(RecordHeader) + OfflineQueue::kMaxPayload;
constexpr size_t kRecordsOffset = sizeof(QueueHeader) * kHeaderSlots;
constexpr size_t kFileSize = kRecordsOffset + kRecordSize * OfflineQueue::kCapacity;

uint32_t headerChecksum(const QueueHeader& header) {
  return protocol::crc32(reinterpret_cast<const uint8_t*>(&header), offsetof(QueueHeader, checksum));
}

bool validHeader(const QueueHeader& header) {
  return header.magic == kHeaderMagic && header.formatVersion == kFormatVersion && header.capacity == OfflineQueue::kCapacity &&
      header.head < OfflineQueue::kCapacity && header.count <= OfflineQueue::kCapacity && header.nextRecordId != 0 &&
      header.checksum == headerChecksum(header);
}

uint32_t recordChecksum(const RecordHeader& header, const char* payload) {
  uint32_t hash = protocol::crc32(reinterpret_cast<const uint8_t*>(&header), offsetof(RecordHeader, checksum));
  for (uint16_t i = 0; i < header.length; ++i) {
    hash ^= static_cast<uint8_t>(payload[i]);
    hash = (hash >> 1) | (hash << 31);
    hash *= 0x45D9F3BUL;
  }
  return hash;
}

bool newerGeneration(uint32_t candidate, uint32_t reference) {
  return static_cast<int32_t>(candidate - reference) > 0;
}

}  // namespace

bool OfflineQueue::begin() {
  healthy_ = false;
  // Trên board mới phân vùng chưa có hệ thống tệp; chỉ format phân vùng LittleFS
  // khi mount thất bại. Không tác động NVS hoặc firmware.
  if (!LittleFS.begin(true)) return false;
  if (!LittleFS.exists(kQueuePath) && !initializeFile()) return false;
  if (!loadHeader()) {
    LittleFS.remove(kQueuePath);
    if (!initializeFile() || !loadHeader()) return false;
  }
  healthy_ = true;
  return true;
}

bool OfflineQueue::initializeFile() {
  File file = LittleFS.open(kQueuePath, "w+");
  if (!file) return false;
  QueueHeader header{};
  header.magic = kHeaderMagic;
  header.formatVersion = kFormatVersion;
  header.capacity = kCapacity;
  header.generation = 1;
  header.nextRecordId = 1;
  header.checksum = headerChecksum(header);
  bool ok = file.write(reinterpret_cast<const uint8_t*>(&header), sizeof(header)) == sizeof(header);
  header.generation = 0;
  header.checksum = headerChecksum(header);
  ok = ok && file.write(reinterpret_cast<const uint8_t*>(&header), sizeof(header)) == sizeof(header);
  if (ok) {
    ok = file.seek(kFileSize - 1U, SeekSet) && file.write(static_cast<uint8_t>(0)) == 1;
  }
  file.flush();
  file.close();
  return ok;
}

bool OfflineQueue::loadHeader() {
  File file = LittleFS.open(kQueuePath, "r");
  if (!file || file.size() < static_cast<size_t>(kRecordsOffset)) {
    if (file) file.close();
    return false;
  }
  QueueHeader headers[kHeaderSlots]{};
  const bool readA = file.read(reinterpret_cast<uint8_t*>(&headers[0]), sizeof(QueueHeader)) == sizeof(QueueHeader);
  const bool readB = file.read(reinterpret_cast<uint8_t*>(&headers[1]), sizeof(QueueHeader)) == sizeof(QueueHeader);
  file.close();
  const bool validA = readA && validHeader(headers[0]);
  const bool validB = readB && validHeader(headers[1]);
  if (!validA && !validB) return false;
  activeHeaderSlot_ = validB && (!validA || newerGeneration(headers[1].generation, headers[0].generation)) ? 1 : 0;
  const QueueHeader& selected = headers[activeHeaderSlot_];
  generation_ = selected.generation;
  head_ = selected.head;
  count_ = selected.count;
  nextRecordId_ = selected.nextRecordId;
  droppedTotal_ = selected.droppedTotal;
  return true;
}

bool OfflineQueue::commitHeader() {
  QueueHeader header{};
  header.magic = kHeaderMagic;
  header.formatVersion = kFormatVersion;
  header.capacity = kCapacity;
  header.generation = generation_ + 1U;
  if (header.generation == 0) header.generation = 1;
  header.head = head_;
  header.count = count_;
  header.nextRecordId = nextRecordId_;
  header.droppedTotal = droppedTotal_;
  header.checksum = headerChecksum(header);
  const uint8_t slot = static_cast<uint8_t>(1U - activeHeaderSlot_);
  File file = LittleFS.open(kQueuePath, "r+");
  if (!file || !file.seek(static_cast<size_t>(slot) * sizeof(QueueHeader), SeekSet)) {
    if (file) file.close();
    return false;
  }
  const bool ok = file.write(reinterpret_cast<const uint8_t*>(&header), sizeof(header)) == sizeof(header);
  file.flush();
  file.close();
  if (!ok) return false;
  activeHeaderSlot_ = slot;
  generation_ = header.generation;
  return true;
}

bool OfflineQueue::writeRecord(uint16_t index, const QueuedMessage& message) {
  if (index >= kCapacity || message.length > kMaxPayload) return false;
  RecordHeader header{};
  header.magic = kRecordMagic;
  header.recordId = message.recordId;
  header.topic = static_cast<uint8_t>(message.topic);
  header.qos = message.qos;
  header.retained = message.retained ? 1 : 0;
  header.length = message.length;
  header.checksum = recordChecksum(header, message.payload);
  File file = LittleFS.open(kQueuePath, "r+");
  const size_t offset = kRecordsOffset + static_cast<size_t>(index) * kRecordSize;
  if (!file || !file.seek(offset, SeekSet)) {
    if (file) file.close();
    return false;
  }
  bool ok = file.write(reinterpret_cast<const uint8_t*>(&header), sizeof(header)) == sizeof(header);
  ok = ok && file.write(reinterpret_cast<const uint8_t*>(message.payload), message.length) == message.length;
  file.flush();
  file.close();
  return ok;
}

bool OfflineQueue::readRecord(uint16_t index, QueuedMessage& message) {
  if (index >= kCapacity) return false;
  File file = LittleFS.open(kQueuePath, "r");
  const size_t offset = kRecordsOffset + static_cast<size_t>(index) * kRecordSize;
  if (!file || !file.seek(offset, SeekSet)) {
    if (file) file.close();
    return false;
  }
  RecordHeader header{};
  bool ok = file.read(reinterpret_cast<uint8_t*>(&header), sizeof(header)) == sizeof(header);
  ok = ok && header.magic == kRecordMagic && header.recordId != 0 && header.length <= kMaxPayload && header.qos <= 1 &&
      header.retained <= 1 && header.reserved == 0 && header.reserved2 == 0 && header.topic >= 1 && header.topic <= 3;
  if (ok) ok = file.read(reinterpret_cast<uint8_t*>(message.payload), header.length) == header.length;
  file.close();
  if (!ok || header.checksum != recordChecksum(header, message.payload)) return false;
  message.recordId = header.recordId;
  message.topic = static_cast<QueuedTopic>(header.topic);
  message.qos = header.qos;
  message.retained = header.retained != 0;
  message.length = header.length;
  message.payload[message.length] = '\0';
  return true;
}

EnqueueResult OfflineQueue::enqueue(QueuedTopic topic, uint8_t qos, bool retained, const char* payload, size_t length) {
  EnqueueResult result{};
  result.droppedTotal = droppedTotal_;
  if (!healthy_ || payload == nullptr || length == 0 || length > kMaxPayload || qos > 1) return result;
  if (count_ == kCapacity) {
    head_ = (head_ + 1U) % kCapacity;
    --count_;
    ++droppedTotal_;
    result.droppedOldest = true;
    result.droppedTotal = droppedTotal_;
    // Commit việc loại bản cũ trước khi ghi đè ô của nó. Nếu mất điện ở
    // giữa hai lần commit, header vẫn mô tả một hàng đợi nhất quán.
    if (!commitHeader()) {
      healthy_ = false;
      return result;
    }
  }
  QueuedMessage message{};
  message.recordId = nextRecordId_++;
  if (nextRecordId_ == 0) nextRecordId_ = 1;
  message.topic = topic;
  message.qos = qos;
  message.retained = retained;
  message.length = static_cast<uint16_t>(length);
  memcpy(message.payload, payload, length);
  const uint16_t index = static_cast<uint16_t>((head_ + count_) % kCapacity);
  if (!writeRecord(index, message)) {
    healthy_ = false;
    return result;
  }
  ++count_;
  if (!commitHeader()) {
    healthy_ = false;
    return result;
  }
  result.stored = true;
  result.droppedTotal = droppedTotal_;
  return result;
}

bool OfflineQueue::discardCorruptHead() {
  if (count_ == 0) return false;
  head_ = (head_ + 1U) % kCapacity;
  --count_;
  ++droppedTotal_;
  if (!commitHeader()) {
    healthy_ = false;
    return false;
  }
  return true;
}

bool OfflineQueue::peek(QueuedMessage& message) {
  if (!healthy_) return false;
  while (count_ > 0) {
    if (readRecord(static_cast<uint16_t>(head_), message)) return true;
    if (!discardCorruptHead()) return false;
  }
  return false;
}

bool OfflineQueue::pop(uint32_t expectedRecordId) {
  if (!healthy_ || count_ == 0) return false;
  QueuedMessage current{};
  if (!readRecord(static_cast<uint16_t>(head_), current) || current.recordId != expectedRecordId) return false;
  head_ = (head_ + 1U) % kCapacity;
  --count_;
  if (!commitHeader()) {
    healthy_ = false;
    return false;
  }
  return true;
}

}  // namespace smartroom::esp32
