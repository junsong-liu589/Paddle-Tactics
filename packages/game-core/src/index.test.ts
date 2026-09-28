import { describe, expect, it } from 'vitest';
import { GAME_CORE_PACKAGE } from './index';

describe('game-core package boundary', () => {
  it('is importable without framework or I/O dependencies', () => {
    expect(GAME_CORE_PACKAGE).toBe('@paddle-tactics/game-core');
  });
});
