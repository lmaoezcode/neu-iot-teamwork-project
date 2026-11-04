import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { DataRepository } from '../data/repository.js';

export interface WebSession {
  userId: 'owner';
  username: string;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

export interface CreatedSession {
  token: string;
  session: WebSession;
}

export class SessionStore {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
    private readonly persistence: Pick<
      DataRepository,
      'saveSession' | 'getSession' | 'touchSession' | 'revokeSession' | 'deleteExpiredSessions'
    >,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(username: string): Promise<CreatedSession> {
    await this.removeExpired();
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const createdAt = this.now();
    const session: WebSession = {
      userId: 'owner',
      username,
      csrfToken,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + this.ttlSeconds * 1000).toISOString(),
      lastSeenAt: createdAt.toISOString()
    };
    await this.persistence.saveSession({
      sessionDigest: this.digest(token),
      userId: session.userId,
      username: session.username,
      csrfToken: session.csrfToken,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      revokedAt: null
    });
    return { token, session };
  }

  async get(token: string | undefined): Promise<WebSession | null> {
    if (!token) return null;
    const key = this.digest(token);
    const stored = await this.persistence.getSession(key);
    if (!stored || stored.revokedAt !== null || stored.userId !== 'owner') return null;
    const now = this.now();
    if (Date.parse(stored.expiresAt) <= now.getTime()) {
      await this.persistence.revokeSession(key, now.toISOString());
      return null;
    }
    await this.persistence.touchSession(key, now.toISOString());
    return {
      userId: 'owner',
      username: stored.username,
      csrfToken: stored.csrfToken,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
      lastSeenAt: now.toISOString()
    };
  }

  async revoke(token: string | undefined): Promise<void> {
    if (token) await this.persistence.revokeSession(this.digest(token), this.now().toISOString());
  }

  verifyCsrf(session: WebSession, supplied: string | undefined): boolean {
    if (!supplied) return false;
    const expected = Buffer.from(session.csrfToken);
    const actual = Buffer.from(supplied);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private digest(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('base64url');
  }

  private async removeExpired(): Promise<void> {
    await this.persistence.deleteExpiredSessions(this.now().toISOString());
  }
}
