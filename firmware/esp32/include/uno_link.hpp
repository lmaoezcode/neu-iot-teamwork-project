#pragma once

#include <Arduino.h>

#include "domain.hpp"
#include "protocol.hpp"

namespace smartroom::esp32 {

class LinkObserver {
 public:
  virtual ~LinkObserver() = default;
  virtual void onLinkStateChanged(LinkState state, uint16_t reason) = 0;
  virtual void onHello(const HelloReport& report) = 0;
  virtual void onConfigReport(const DeviceConfig& config) = 0;
  virtual void onSensorReport(const SensorReport& report) = 0;
  virtual void onStateReport(const StateReport& report) = 0;
  virtual bool onEventReport(const EventReport& report) = 0;
  virtual bool onAlertReport(const AlertReport& report) = 0;
  virtual void onHealthReport(const HealthReport& report) = 0;
  virtual void onTransactionResult(TransactionKind kind, uint32_t tag, uint32_t correlationId,
                                   const AckReport* report, bool timedOut) = 0;
  virtual void onProtocolError(uint16_t reason, uint8_t offendingType) = 0;
};

class UnoLink {
 public:
  explicit UnoLink(HardwareSerial& serial);

  void setObserver(LinkObserver* observer) { observer_ = observer; }
  void begin(uint32_t espBootId, const DeviceConfig* cachedConfig);
  void tick(uint32_t nowMs);

  bool requestConfig(const DeviceConfig& config, uint32_t tag);
  bool requestControl(const ControlRequest& request, uint32_t tag);
  bool requestResync();
  void updateCachedConfig(const DeviceConfig& config);

  LinkState state() const { return state_; }
  bool ready() const { return state_ == LinkState::Ready && phase_ == Phase::Operational; }
  bool busy() const { return pending_.active || phase_ != Phase::Operational; }
  uint32_t espBootId() const { return espBootId_; }
  uint32_t unoBootId() const { return unoBootId_; }
  uint32_t sessionId() const { return sessionId_; }
  uint32_t currentConfigVersion() const { return currentConfigVersion_; }
  uint32_t currentStateVersion() const { return currentStateVersion_; }
  uint32_t capabilities() const { return capabilities_; }
  bool hasCachedConfig() const { return cachedConfigValid_; }
  const DeviceConfig& cachedConfig() const { return cachedConfig_; }

 private:
  enum class Phase : uint8_t { NeedHello, NeedSession, ReconcileConfig, NeedSnapshot, CollectSnapshot, NeedSync, Operational };
  enum class RequestKind : uint8_t { None, Hello, Session, InitialConfig, SnapshotStart, SnapshotPoll, Sync, DesiredConfig, Control, Poll };

  struct PendingRequest {
    bool active = false;
    RequestKind kind = RequestKind::None;
    TransactionKind transactionKind = TransactionKind::None;
    uint32_t tag = 0;
    uint32_t correlationId = 0;
    uint16_t sequence = 0;
    uint8_t attempts = 0;
    uint32_t sentAtMs = 0;
    size_t encodedLength = 0;
    uint8_t encoded[protocol::kEncodedFrameCapacity] = {};
  };

  void serviceReceive(uint32_t nowMs);
  void handleFrame(const Frame& frame, uint32_t nowMs);
  bool handleBusinessFrame(const Frame& frame);
  bool handleAckFrame(const Frame& frame);
  void handleTimeout(uint32_t nowMs);
  void drive(uint32_t nowMs);
  void restartHandshake(uint16_t reason, bool countTimeout);
  void setState(LinkState state, uint16_t reason);

  bool sendRequest(Frame frame, RequestKind kind, TransactionKind transactionKind = TransactionKind::None, uint32_t tag = 0);
  bool resendPending(uint32_t nowMs);
  void completePending();
  uint16_t nextSequence();
  uint32_t nextCorrelation();
  uint32_t createNonZeroRandom() const;
  uint32_t hashFrame(const Frame& frame) const;
  bool acceptSequence(const Frame& frame, bool& duplicate) const;
  void commitSequence(const Frame& frame);

  bool decodeHello(const Frame& frame, HelloReport& report) const;
  bool decodeAck(const Frame& frame, AckReport& report) const;
  bool decodeSensor(const Frame& frame, SensorReport& report) const;
  bool decodeState(const Frame& frame, StateReport& report) const;
  bool decodeEvent(const Frame& frame, EventReport& report) const;
  bool decodeAlert(const Frame& frame, AlertReport& report) const;
  bool decodeHealth(const Frame& frame, HealthReport& report) const;

  HardwareSerial& serial_;
  LinkObserver* observer_ = nullptr;
  LinkState state_ = LinkState::NoSession;
  Phase phase_ = Phase::NeedHello;
  PendingRequest pending_{};

  uint32_t espBootId_ = 0;
  uint32_t unoBootId_ = 0;
  uint32_t sessionId_ = 0;
  uint32_t capabilities_ = 0;
  uint32_t currentConfigVersion_ = 0;
  uint32_t currentStateVersion_ = 0;
  uint32_t snapshotConfigVersion_ = 0;
  uint32_t snapshotStateVersion_ = 0;
  uint32_t nextCorrelationId_ = 1;
  uint16_t nextTxSequence_ = 1;
  uint16_t lastRxSequence_ = 0;
  uint16_t lastIncomingSequence_ = 0;
  uint32_t lastIncomingHash_ = 0;
  uint8_t missedWindows_ = 0;
  uint32_t nextHelloAtMs_ = 0;
  uint32_t nextPollAtMs_ = 0;

  DeviceConfig cachedConfig_{};
  bool cachedConfigValid_ = false;
  bool configConflict_ = false;

  uint8_t rxEncoded_[protocol::kEncodedFrameCapacity] = {};
  size_t rxEncodedLength_ = 0;
  bool rxOverflow_ = false;
  uint32_t rxStartedAtMs_ = 0;
};

}  // namespace smartroom::esp32
