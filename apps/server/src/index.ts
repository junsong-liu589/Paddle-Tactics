import 'dotenv/config';
import { GAME_CORE_PACKAGE } from '@paddle-tactics/game-core';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const app = await createApp();
app.log.info({ gameCore: GAME_CORE_PACKAGE }, 'game-core package loaded');

try {
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
