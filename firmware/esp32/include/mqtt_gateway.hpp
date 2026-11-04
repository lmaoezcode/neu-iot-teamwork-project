#pragma once

#include <Arduino.h>
#include <MQTT.h>
#include <WiFi.h>

#include "config_store.hpp"
#include "offline_queue.hpp"
#include "uno_link.hpp"

namespace smartroom::esp32 {

class MqttGateway final : public LinkObserver {
 public:
  MqttGateway(UnoLink& link, ConfigStore& store, OfflineQueue& queue);

  void begin(uint32_t espBootId);
  void tick(uint32_t nowMs);

  void onLinkStateChanged(LinkState state, uint16_t reason) override;
  void onHello(const HelloReport& report) override;
  void onConfigReport(const DeviceConfig& config) override;
  void onSensorReport(const SensorReport& report) override;
  void onStateReport(const StateReport& report) override;
  bool onEventReport(const EventReport& report) override;
  bool onAlertReport(const AlertReport& report) override;
  void onHealthReport(const HealthReport& report) override;
  void onTransactionResult(TransactionKind kind, uint32_t tag, uint32_t correlationId,
                           const AckReport* report, bool timedOut) override;
  void onProtocolError(uint16_t reason, uint8_t offendingType) override;

 private:
  enum class NetworkPhase : uint8_t { Disconnected, Syncing, Replaying, Online };
  enum class InboundKind : uint8_t { None, Config, Command, Sync };

  struct InboundMessage {
    InboundKind kind = InboundKind::None;
    uint32_t receivedAtMs = 0;
    uint16_t length = 0;
    char payload[2049] = {};
  };

  struct ActiveCause {
    bool used = false;
    AlertReport report{};
  };

  struct PendingCommand {
    bool active = false;
    bool submitted = false;
    char commandId[65] = {};
    uint32_t payloadHash = 0;
    uint32_t tag = 0;
    uint32_t deadlineMs = 0;
    ControlRequest request{};
  };

  struct CommandCacheEntry {
    bool used = false;
    char commandId[65] = {};
    uint32_t payloadHash = 0;
    bool hasAck = false;
    char terminalResult[16] = {};
    char terminalReason[40] = {};
    AckReport report{};
  };

  void serviceWifi(uint32_t nowMs);
  void serviceMqtt(uint32_t nowMs);
  void serviceUnoIdentity();
  void serviceInbound(uint32_t nowMs);
  void serviceDesiredConfig();
  void servicePendingCommand(uint32_t nowMs);
  void serviceReconciliation();
  void serviceReplay();
  void connectMqtt(uint32_t nowMs);
  void onMqttMessage(String& topic, String& payload);
  bool enqueueInbound(InboundKind kind, const String& payload);
  bool dequeueInbound(InboundMessage& message);

  bool processDesiredConfig(const InboundMessage& message);
  bool processCommand(const InboundMessage& message);
  bool processSyncRequest(const InboundMessage& message);

  bool publishAvailability(const char* status, const char* reason);
  bool publishTelemetry(const SensorReport& report);
  bool publishState();
  bool publishConfigReported(const DeviceConfig* config, const char* result, const char* reason);
  bool publishAlertsReported();
  bool publishHealth(const HealthReport& report, uint16_t localReason = 0);
  bool publishSyncStatus(const char* syncId, const char* result, const char* reason);
  bool publishCommandResult(const char* commandId, const char* result, const char* reason,
                            const AckReport* report, bool replayed);
  bool publishRaw(const char* topic, const char* payload, bool retained, int qos);
  bool publishOrQueue(QueuedTopic topic, const char* payload, size_t length);
  bool enqueueQueueOverflowMarker(uint32_t droppedTotal);

  bool buildEventJson(const EventReport& report, char* output, size_t capacity, size_t& length);
  bool buildAlertJson(const AlertReport& report, char* output, size_t capacity, size_t& length);
  void updateActiveCause(const AlertReport& report);
  void finishCommand(const char* commandId, uint32_t payloadHash, const AckReport* report, bool timedOut);
  CommandCacheEntry* findCommandCache(const char* commandId);
  void rememberCommand(const char* commandId, uint32_t payloadHash, const char* result, const char* reason,
                       const AckReport* report);

  bool networkConfigured() const;
  bool validDeviceId() const;
  bool timeSynced() const;
  bool formatUtc(char* output, size_t capacity) const;
  uint32_t nextBackoffMs(uint8_t& attempt) const;
  uint32_t nextMessageCounter();
  void makeMessageId(char* output, size_t capacity, const char* category, uint32_t suffix);
  const char* topicForQueued(QueuedTopic topic) const;
  const char* availabilityStatusForLink() const;
  const char* availabilityReasonForLink(uint16_t reason) const;

  UnoLink& link_;
  ConfigStore& store_;
  OfflineQueue& queue_;
  WiFiClient networkClient_;
  MQTTClient mqtt_{2304, 2304};

  uint32_t espBootId_ = 0;
  uint32_t observedUnoBootId_ = 0;
  uint32_t messageCounter_ = 0;
  LinkState linkState_ = LinkState::NoSession;
  uint16_t lastLinkReason_ = REASON_OK;
  NetworkPhase networkPhase_ = NetworkPhase::Disconnected;
  bool networkConfigurationValid_ = false;
  bool mqttWasConnected_ = false;
  bool retainedSnapshotPublished_ = false;
  bool overflowMarkerQueued_ = false;
  bool ntpStarted_ = false;
  uint8_t wifiAttempt_ = 0;
  uint8_t mqttAttempt_ = 0;
  uint32_t nextWifiAttemptMs_ = 0;
  uint32_t nextMqttAttemptMs_ = 0;

  char topicRoot_[96] = {};
  char topicAvailability_[128] = {};
  char topicTelemetry_[128] = {};
  char topicState_[128] = {};
  char topicConfigDesired_[128] = {};
  char topicConfigReported_[128] = {};
  char topicCommandRequest_[128] = {};
  char topicCommandResult_[128] = {};
  char topicEvents_[128] = {};
  char topicAlertEvents_[128] = {};
  char topicAlertsReported_[128] = {};
  char topicSyncRequest_[128] = {};
  char topicSyncStatus_[128] = {};
  char topicDiagnostics_[128] = {};

  InboundMessage inbound_[4]{};
  uint8_t inboundHead_ = 0;
  uint8_t inboundCount_ = 0;
  uint32_t inboundDrops_ = 0;

  DeviceConfig reportedConfig_{};
  bool reportedConfigValid_ = false;
  DeviceConfig desiredConfig_{};
  bool desiredConfigPending_ = false;
  bool desiredConfigInFlight_ = false;
  uint32_t desiredConfigTag_ = 0;
  DeviceConfig inFlightConfig_{};
  uint32_t inFlightConfigTag_ = 0;

  SensorReport latestSensor_{};
  StateReport latestState_{};
  HealthReport latestHealth_{};
  bool hasSensor_ = false;
  bool hasState_ = false;
  bool hasHealth_ = false;

  ActiveCause activeCauses_[8]{};
  PendingCommand pendingCommand_{};
  CommandCacheEntry commandCache_[8]{};
  uint8_t commandCacheCursor_ = 0;
  char activeSyncId_[65] = {};
};

}  // namespace smartroom::esp32
