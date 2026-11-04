import type { AlertRecord } from './types';

export interface NotificationPort {
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  show(title: string, options: NotificationOptions): void;
}

function browserPort(): NotificationPort | null {
  if (typeof Notification === 'undefined') return null;
  return {
    get permission() { return Notification.permission; },
    requestPermission: () => Notification.requestPermission(),
    show: (title, options) => { void new Notification(title, options); }
  };
}

export class NotificationManager {
  private readonly shown = new Set<string>();

  constructor(private readonly port: NotificationPort | null = browserPort()) {}

  permission(): NotificationPermission | 'unsupported' {
    return this.port?.permission ?? 'unsupported';
  }

  async request(): Promise<NotificationPermission | 'unsupported'> {
    return this.port ? this.port.requestPermission() : 'unsupported';
  }

  notifyNewActive(alerts: AlertRecord[]): number {
    if (!this.port || this.port.permission !== 'granted') return 0;
    let count = 0;
    for (const alert of alerts) {
      if (!alert.active || this.shown.has(alert.alertId)) continue;
      this.shown.add(alert.alertId);
      const type = alert.type === 'safety' ? 'an toàn' : alert.type === 'security' ? 'an ninh' : 'hệ thống';
      this.port.show(`Cảnh báo ${type}`, {
        body: `${alert.source}: ${alert.reasonCode.replaceAll('_', ' ')}`,
        tag: `smartroom-${alert.alertId}`
      });
      count += 1;
    }
    return count;
  }
}
