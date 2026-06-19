// @ts-check
import { test, expect } from '@playwright/test';
import {
  SAVE_KEY,
  E2E_URL,
  clearSave,
  startNewGame,
  waitForGameRunning,
  waitForTestApi,
  movePlayer,
  flushSave,
  openPauseMenu,
  near,
} from '../support/helpers.js';

test.describe('Этап 1 — storage.js', () => {
  test.beforeEach(async ({ page }) => {
    await clearSave(page);
  });

  test('save, load, clear, hasSave', async ({ page }) => {
    const result = await page.goto(E2E_URL).then(() => page.evaluate(async () => {
      const { save, load, clear, hasSave } = await import('/js/storage.js');
      const { SAVE_VERSION } = await import('/js/config.js');

      clear();
      const wrote = save({
        player: { x: 12.5, y: 0, z: -8.25 },
        score: 42,
        npcs: [{ id: 'pol-1', type: 'police', x: 1, z: 2, state: 'idle' }],
      });
      if (!wrote || !hasSave()) return { ok: false, reason: 'save failed' };

      const loaded = load();
      clear();

      return {
        ok: loaded?.player?.x === 12.5
          && loaded?.player?.z === -8.25
          && loaded?.score === 42
          && loaded?.version === SAVE_VERSION
          && typeof loaded?.worldSeed === 'number'
          && !hasSave(),
      };
    }));

    expect(result.ok).toBe(true);
  });

  test('миграция старого формата без version и worldSeed', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({
        score: 10,
        cityHealth: 80,
        player: { x: 5, y: 0, z: 15 },
        npcs: [],
        timestamp: 987654321,
      }));
    }, SAVE_KEY);

    await page.goto(E2E_URL);
    await waitForGameRunning(page);

    const save = await page.evaluate(() => window.__CHELBLOX_TEST__.getLocalSave());
    expect(save.version).toBe(1);
    expect(save.worldSeed).toBe(987654321);
    expect(save.influence).toMatchObject({
      player: 0,
      firefighter: 0,
      police: 0,
      taxi: 0,
      military: 0,
    });
    expect(save.cityStats).toBeDefined();
  });
});

test.describe('Этап 1 — world.js', () => {
  test('getRandomSpawn возвращает безопасную точку вне коллайдеров', async ({ page }) => {
    await page.goto(E2E_URL);
    const result = await page.evaluate(async () => {
      const { initSpawnSystem, getRandomSpawn, isPositionSafe } = await import('/js/world.js');
      const colliders = [
        { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
        { minX: 30, maxX: 50, minZ: 30, maxZ: 50 },
      ];
      initSpawnSystem(colliders, {
        worldSize: 100,
        blockSize: 36,
        roadWidth: 10,
        playerRadius: 1.1,
      });

      const samples = Array.from({ length: 20 }, () => getRandomSpawn());
      return samples.every((p) => isPositionSafe(p.x, p.z, 1.1));
    });

    expect(result).toBe(true);
  });

  test('игрок и NPC после старта не внутри зданий', async ({ page }) => {
    await clearSave(page);
    await startNewGame(page);

    const safety = await page.evaluate(() => {
      const api = window.__CHELBLOX_TEST__;
      const player = api.getPlayerPosition();
      const npcs = api.getNpcs();
      return {
        playerSafe: api.isPositionSafe(player.x, player.z, 1.1),
        npcsSafe: npcs.every((n) => api.isPositionSafe(n.x, n.z, 0.9)),
        totalNpcs: npcs.length,
      };
    });

    expect(safety.playerSafe).toBe(true);
    expect(safety.npcsSafe).toBe(true);
    expect(safety.totalNpcs).toBeGreaterThan(0);
  });
});

test.describe('Этап 1 — старт игры', () => {
  test.beforeEach(async ({ page }) => {
    await clearSave(page);
  });

  test('без сохранения показывается экран «Играть»', async ({ page }) => {
    await page.goto(E2E_URL);
    await waitForTestApi(page);

    await expect(page.getByTestId('overlay-start')).toBeVisible();
    await expect(page.getByTestId('btn-play')).toBeVisible();
    expect(await page.evaluate(() => window.__CHELBLOX_TEST__.isRunning())).toBe(false);
  });

  test('новая игра: случайное количество NPC в пределах SPAWN_CONFIG', async ({ page }) => {
    await startNewGame(page);

    const { counts, config } = await page.evaluate(() => ({
      counts: window.__CHELBLOX_TEST__.getNpcCounts(),
      config: window.__CHELBLOX_TEST__.getSpawnConfig(),
    }));

    for (const [type, cfg] of Object.entries(config)) {
      expect(counts[type] ?? 0).toBeGreaterThanOrEqual(cfg.min);
      expect(counts[type] ?? 0).toBeLessThanOrEqual(cfg.max);
    }
  });

  test('с сохранением: загрузка без кнопки «Играть», сессия восстанавливается', async ({ page }) => {
    await startNewGame(page);
    await movePlayer(page, 2500);
    await flushSave(page);

    const before = await page.evaluate(() => ({
      save: window.__CHELBLOX_TEST__.getLocalSave(),
      pos: window.__CHELBLOX_TEST__.getPlayerPosition(),
      seed: window.__CHELBLOX_TEST__.getWorldSeed(),
      npcs: window.__CHELBLOX_TEST__.getNpcs(),
    }));

    expect(before.save).not.toBeNull();
    expect(before.npcs.length).toBeGreaterThan(0);

    await page.reload();
    await waitForGameRunning(page);

    await expect(page.getByTestId('btn-play')).toBeHidden();
    await expect(page.getByText('Сессия восстановлена')).toBeVisible();

    const after = await page.evaluate(() => ({
      pos: window.__CHELBLOX_TEST__.getPlayerPosition(),
      seed: window.__CHELBLOX_TEST__.getWorldSeed(),
      npcs: window.__CHELBLOX_TEST__.getNpcs(),
    }));

    expect(near(after.pos.x, before.pos.x)).toBe(true);
    expect(near(after.pos.z, before.pos.z)).toBe(true);
    expect(after.seed).toBe(before.seed);
    expect(after.npcs.length).toBe(before.npcs.length);

    for (const savedNpc of before.npcs) {
      const restored = after.npcs.find((n) => n.id === savedNpc.id);
      expect(restored).toBeDefined();
      expect(near(restored.x, savedNpc.x)).toBe(true);
      expect(near(restored.z, savedNpc.z)).toBe(true);
    }
  });
});

test.describe('Этап 1 — сохранение позиции', () => {
  test.beforeEach(async ({ page }) => {
    await clearSave(page);
  });

  test('перезагрузка страницы восстанавливает позицию игрока из localStorage', async ({ page }) => {
    await startNewGame(page);
    await movePlayer(page, 3000);
    await flushSave(page);

    const saved = await page.evaluate(() => window.__CHELBLOX_TEST__.getLocalSave());
    expect(saved?.player?.x).toBeDefined();
    expect(saved?.player?.z).toBeDefined();

    await page.reload();
    await waitForGameRunning(page);

    const pos = await page.evaluate(() => window.__CHELBLOX_TEST__.getPlayerPosition());
    expect(near(pos.x, saved.player.x)).toBe(true);
    expect(near(pos.z, saved.player.z)).toBe(true);
  });

  test('worldSeed одинаковый при повторной загрузке', async ({ page }) => {
    await startNewGame(page);
    await flushSave(page);

    const seed1 = await page.evaluate(() => window.__CHELBLOX_TEST__.getWorldSeed());
    await page.reload();
    await waitForGameRunning(page);
    const seed2 = await page.evaluate(() => window.__CHELBLOX_TEST__.getWorldSeed());

    expect(seed2).toBe(seed1);
  });
});

test.describe('Этап 1 — «Начать игру сначала»', () => {
  test('сброс удаляет save и даёт новый мир', async ({ page }) => {
    await clearSave(page);
    await startNewGame(page);
    await movePlayer(page, 2000);
    await flushSave(page);

    const before = await page.evaluate(() => ({
      save: window.__CHELBLOX_TEST__.getLocalSave(),
      pos: window.__CHELBLOX_TEST__.getPlayerPosition(),
      seed: window.__CHELBLOX_TEST__.getWorldSeed(),
      score: window.__CHELBLOX_TEST__.getScore(),
    }));

    expect(before.save).not.toBeNull();
    expect(before.score).toBe(0);

    await openPauseMenu(page);
    await expect(page.getByTestId('overlay-pause')).toBeVisible();

    await Promise.all([
      page.waitForLoadState('load'),
      page.getByTestId('btn-restart').click(),
    ]);

    await waitForTestApi(page);
    const hasSave = await page.evaluate((key) => localStorage.getItem(key) !== null, SAVE_KEY);
    expect(hasSave).toBe(false);

    await expect(page.getByTestId('overlay-start')).toBeVisible();
    await page.getByTestId('btn-play').click();
    await waitForGameRunning(page);

    const after = await page.evaluate(() => ({
      pos: window.__CHELBLOX_TEST__.getPlayerPosition(),
      seed: window.__CHELBLOX_TEST__.getWorldSeed(),
      score: window.__CHELBLOX_TEST__.getScore(),
      influence: window.__CHELBLOX_TEST__.getInfluence(),
    }));

    expect(after.score).toBe(0);
    expect(Object.values(after.influence).every((v) => v === 0)).toBe(true);
    expect(after.seed).not.toBe(before.seed);

    const moved = !near(after.pos.x, before.pos.x, 1) || !near(after.pos.z, before.pos.z, 1);
    expect(moved || after.seed !== before.seed).toBe(true);
  });
});
