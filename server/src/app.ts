import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerApiRoutes } from './api/routes.js';
import type { ServerConfig } from './config/env.js';
import type { DataRepository } from './data/repository.js';
import { SQLiteRepository } from './data/sqlite-repository.js';
import { DisabledMqttClient, type MqttPort } from './mqtt/client.js';
import { MqttJsClient } from './mqtt/mqttjs-client.js';
import { EventHub } from './realtime/event-stream.js';
import { SessionStore } from './security/session-store.js';
import { ServiceError } from './services/errors.js';
import { SmartRoomService } from './services/smart-room-service.js';

export interface AppOverrides {
  repository?: DataRepository;
  mqtt?: MqttPort;
  now?: () => Date;
}

export async function createApp(config: ServerConfig, overrides: AppOverrides = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
    bodyLimit: 16 * 1024,
    requestIdHeader: false
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token', 'last-event-id']
  });

  const repository = overrides.repository ?? new SQLiteRepository({
    filename: config.dbFile,
    retentionDays: config.retentionDays,
    ...(overrides.now ? { now: overrides.now } : {})
  });
  const mqtt = overrides.mqtt ?? (config.mqttEnabled ? new MqttJsClient(config) : new DisabledMqttClient());
  const events = new EventHub(config.sseReplaySize);
  const sessions = new SessionStore(config.sessionSecret, config.sessionTtlSeconds, repository, overrides.now);
  const service = new SmartRoomService(config, repository, mqtt, events, overrides.now);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ServiceError) {
      reply.code(error.statusCode).send({
        error_code: error.errorCode,
        message: error.message,
        request_id: request.id,
        details: error.details
      });
      return;
    }
    request.log.error({ error }, 'Lỗi máy chủ chưa xử lý');
    reply.code(500).send({
      error_code: 'internal_error',
      message: 'Máy chủ gặp lỗi nội bộ.',
      request_id: request.id,
      details: {}
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error_code: 'route_not_found',
      message: 'Không tìm thấy đường dẫn yêu cầu.',
      request_id: request.id,
      details: { path: request.url }
    });
  });

  app.get('/health', async () => service.health());
  await registerApiRoutes(app, { config, service, sessions, events });
  await service.start();
  app.addHook('onClose', async () => service.stop());
  return app;
}
