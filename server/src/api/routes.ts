import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ServerConfig } from '../config/env.js';
import type { EventStreamPort, RealtimeEvent } from '../realtime/event-stream.js';
import { LoginLimiter } from '../security/login-limiter.js';
import { verifyPassword } from '../security/password.js';
import { SessionStore, type WebSession } from '../security/session-store.js';
import { ServiceError } from '../services/errors.js';
import type { SmartRoomService } from '../services/smart-room-service.js';
import {
  commandInputSchema,
  desiredConfigRequestSchema,
  historyQuerySchema,
  loginRequestSchema,
  logsQuerySchema
} from '../validation/schemas.js';

export const routeCatalog = Object.freeze({
  login: 'POST /api/auth/login',
  logout: 'POST /api/auth/logout',
  session: 'GET /api/session',
  overview: 'GET /api/overview',
  config: 'GET /api/config',
  desiredConfig: 'PUT /api/config/desired',
  commands: 'POST /api/commands',
  commandStatus: 'GET /api/commands/{command_id}',
  history: 'GET /api/history',
  logs: 'GET /api/logs',
  stream: 'GET /api/events/stream',
  muteAlert: 'POST /api/alerts/{alert_id}/mute',
  acknowledgeAlert: 'POST /api/alerts/{alert_id}/ack'
} as const);

export type RouteName = keyof typeof routeCatalog;

interface ApiDependencies {
  config: ServerConfig;
  service: SmartRoomService;
  sessions: SessionStore;
  events: EventStreamPort;
}

function parseBody<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ServiceError(400, 'validation_error', 'Dữ liệu yêu cầu không hợp lệ.', {
      issues: result.error.issues
    });
  }
  return result.data;
}

function assertTrustedOrigin(request: FastifyRequest, config: ServerConfig): void {
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== config.webOrigin) {
    throw new ServiceError(403, 'origin_forbidden', 'Nguồn gửi yêu cầu không được phép.');
  }
}

async function readSession(request: FastifyRequest, dependencies: ApiDependencies): Promise<WebSession | null> {
  return dependencies.sessions.get(request.cookies[dependencies.config.sessionCookieName]);
}

async function requireSession(request: FastifyRequest, dependencies: ApiDependencies): Promise<WebSession> {
  const session = await readSession(request, dependencies);
  if (!session) throw new ServiceError(401, 'authentication_required', 'Cần đăng nhập chủ phòng.');
  return session;
}

async function requireMutationSession(request: FastifyRequest, dependencies: ApiDependencies): Promise<WebSession> {
  assertTrustedOrigin(request, dependencies.config);
  const session = await requireSession(request, dependencies);
  const csrf = typeof request.headers['x-csrf-token'] === 'string' ? request.headers['x-csrf-token'] : undefined;
  if (!dependencies.sessions.verifyCsrf(session, csrf)) {
    throw new ServiceError(403, 'csrf_invalid', 'Mã chống giả mạo yêu cầu không hợp lệ.');
  }
  return session;
}

function writeSse(reply: FastifyReply, event: RealtimeEvent): void {
  reply.raw.write(`id: ${event.id}\n`);
  reply.raw.write(`event: ${event.name}\n`);
  reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

export async function registerApiRoutes(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  const limiter = new LoginLimiter();

  app.post('/api/auth/login', async (request, reply) => {
    assertTrustedOrigin(request, dependencies.config);
    const body = parseBody(loginRequestSchema, request.body);
    const key = request.ip;
    const allowance = limiter.canAttempt(key);
    if (!allowance.allowed) {
      reply.header('retry-after', allowance.retryAfterSeconds);
      throw new ServiceError(429, 'login_rate_limited', 'Đăng nhập tạm khóa do quá nhiều lần thử.', {
        retry_after_seconds: allowance.retryAfterSeconds
      });
    }
    const credential = await dependencies.service.getUserCredential(body.username);
    const passwordOk = await verifyPassword(body.password, credential?.passwordHash ?? dependencies.config.ownerPasswordHash);
    const valid = credential?.active === true && passwordOk;
    await dependencies.service.recordAuthLog(valid, request.id, request.ip);
    if (!valid) {
      limiter.failure(key);
      throw new ServiceError(401, 'invalid_credentials', 'Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    limiter.success(key);
    await dependencies.service.recordSuccessfulLogin(credential!.userId);
    const created = await dependencies.sessions.create(credential!.username);
    reply.setCookie(dependencies.config.sessionCookieName, created.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: dependencies.config.cookieSecure,
      maxAge: dependencies.config.sessionTtlSeconds
    });
    return {
      authenticated: true,
      user: { id: created.session.userId, username: created.session.username, role: 'owner' },
      csrf_token: created.session.csrfToken,
      expires_at: created.session.expiresAt
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await requireMutationSession(request, dependencies);
    const token = request.cookies[dependencies.config.sessionCookieName];
    await dependencies.sessions.revoke(token);
    reply.clearCookie(dependencies.config.sessionCookieName, { path: '/' });
    reply.code(204).send();
  });

  app.get('/api/session', async (request) => {
    const session = await readSession(request, dependencies);
    if (!session) return { authenticated: false };
    return {
      authenticated: true,
      user: { id: session.userId, username: session.username, role: 'owner' },
      csrf_token: session.csrfToken,
      expires_at: session.expiresAt
    };
  });

  app.get('/api/overview', async (request) => {
    await requireSession(request, dependencies);
    return {
      server_time: new Date().toISOString(),
      stale_after_seconds: 15,
      overview: await dependencies.service.getOverview()
    };
  });

  app.get('/api/config', async (request) => {
    await requireSession(request, dependencies);
    return dependencies.service.getConfig();
  });

  app.put('/api/config/desired', async (request, reply) => {
    const session = await requireMutationSession(request, dependencies);
    const body = parseBody(desiredConfigRequestSchema, request.body);
    const desired = await dependencies.service.updateDesiredConfig(body.base_config_version, body.settings, session.userId);
    reply.code(202);
    return { accepted: true, applied: false, desired };
  });

  app.post('/api/commands', async (request, reply) => {
    const session = await requireMutationSession(request, dependencies);
    const body = parseBody(commandInputSchema, request.body);
    const command = await dependencies.service.submitCommand(body, session.userId);
    reply.code(202);
    return { accepted: true, applied: false, command };
  });

  app.get<{ Params: { command_id: string } }>('/api/commands/:command_id', async (request) => {
    await requireSession(request, dependencies);
    return { command: await dependencies.service.getCommand(request.params.command_id) };
  });

  app.post<{ Params: { alert_id: string } }>('/api/alerts/:alert_id/mute', async (request, reply) => {
    const session = await requireMutationSession(request, dependencies);
    const command = await dependencies.service.submitAlertAction(request.params.alert_id, 'mute', session.userId);
    reply.code(202);
    return { accepted: true, applied: false, command };
  });

  app.post<{ Params: { alert_id: string } }>('/api/alerts/:alert_id/ack', async (request, reply) => {
    const session = await requireMutationSession(request, dependencies);
    const command = await dependencies.service.submitAlertAction(request.params.alert_id, 'acknowledge', session.userId);
    reply.code(202);
    return { accepted: true, applied: false, command };
  });

  app.get('/api/history', async (request) => {
    await requireSession(request, dependencies);
    const query = parseBody(historyQuerySchema, request.query);
    return {
      metric: query.metric,
      from: query.from,
      to: query.to,
      gap_policy: 'missing_buckets_omitted',
      storage_mode: dependencies.service.health().storage,
      points: await dependencies.service.getLightHistory(query.from, query.to)
    };
  });

  app.get('/api/logs', async (request) => {
    await requireSession(request, dependencies);
    const query = parseBody(logsQuerySchema, request.query);
    return dependencies.service.getLogs(query);
  });

  app.get('/api/events/stream', async (request, reply) => {
    await requireSession(request, dependencies);
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    reply.raw.write('retry: 3000\n\n');

    const lastEventId = typeof request.headers['last-event-id'] === 'string' ? request.headers['last-event-id'] : undefined;
    const replay = dependencies.events.replayAfter(lastEventId);
    if (!replay.cursorFound) {
      const snapshot = await dependencies.service.getOverview();
      const event: RealtimeEvent = {
        id: replay.latestId ?? 'stream-0000000000',
        name: 'state.updated',
        data: { snapshot: true, overview: snapshot, reason: 'replay_window_missed' }
      };
      writeSse(reply, event);
    } else {
      for (const event of replay.events) writeSse(reply, event);
    }

    const unsubscribe = dependencies.events.subscribe((event) => writeSse(reply, event));
    const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
    heartbeat.unref();
    request.raw.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      reply.raw.end();
    });
  });
}
