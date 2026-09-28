import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app';

describe('health endpoint', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });

  it('returns service health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'paddle-tactics-server' });
  });
});
