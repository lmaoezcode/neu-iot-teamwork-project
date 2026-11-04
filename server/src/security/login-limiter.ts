interface AttemptWindow {
  count: number;
  resetAt: number;
}

export class LoginLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(
    private readonly maximumAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly now: () => number = () => Date.now()
  ) {}

  canAttempt(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const current = this.attempts.get(key);
    const now = this.now();
    if (!current || current.resetAt <= now) {
      this.attempts.delete(key);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count < this.maximumAttempts) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  failure(key: string): void {
    const now = this.now();
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    current.count += 1;
  }

  success(key: string): void {
    this.attempts.delete(key);
  }
}

