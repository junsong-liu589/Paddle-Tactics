import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import type { HealthResponse } from '@paddle-tactics/shared-types';

export async function createApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  app.get<{ Reply: HealthResponse }>('/health', async () => ({ status: 'ok', service: 'paddle-tactics-server' }));
  const io = new SocketServer(app.server, { cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' } });
  io.of('/game');
  app.addHook('onClose', async () => io.close());
  return app;
}
