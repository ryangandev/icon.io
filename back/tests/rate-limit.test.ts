import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RULES, createRateLimiter } from '../libs/rate-limit.js';
import type { PlayerInfo } from '../models/types.js';
import {
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';

describe('the rate limiter', () => {
  /** A clock the test moves by hand, so no real seconds are spent waiting. */
  const fakeClock = () => {
    let currentMs = 0;
    return {
      now: () => currentMs,
      advance: (ms: number) => {
        currentMs += ms;
      },
    };
  };

  it('lets a whole burst through at once', () => {
    const limiter = createRateLimiter(() => 0);

    for (let i = 0; i < RULES.chat.burst; i++) {
      expect(limiter.allow('sendMessage')).toBe(true);
    }
    expect(limiter.allow('sendMessage')).toBe(false);
  });

  it('refills at the sustained rate', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter(clock.now);
    for (let i = 0; i < RULES.chat.burst; i++) limiter.allow('sendMessage');

    // Not yet.
    clock.advance(100);
    expect(limiter.allow('sendMessage')).toBe(false);

    // A second's worth of tokens is `ratePerSecond` of them.
    clock.advance(1000);
    for (let i = 0; i < RULES.chat.ratePerSecond; i++) {
      expect(limiter.allow('sendMessage')).toBe(true);
    }
    expect(limiter.allow('sendMessage')).toBe(false);
  });

  it('never banks more than one burst', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter(clock.now);

    // An hour of silence does not buy an hour of shouting.
    clock.advance(3_600_000);
    for (let i = 0; i < RULES.chat.burst; i++) {
      expect(limiter.allow('sendMessage')).toBe(true);
    }
    expect(limiter.allow('sendMessage')).toBe(false);
  });

  /*
   * A drawing phase is a stream of hundreds of coordinates; joining a room is a
   * click. One budget for both would either throttle the pencil or wave the
   * clicks through.
   */
  it('spends each kind of event from its own budget', () => {
    const limiter = createRateLimiter(() => 0);

    for (let i = 0; i < RULES.chat.burst; i++) limiter.allow('sendMessage');
    expect(limiter.allow('sendMessage')).toBe(false);

    expect(limiter.allow('startDrawing')).toBe(true);
    expect(limiter.allow('clientJoinDrawAndGuessLobby')).toBe(true);
    expect(limiter.allow('undo')).toBe(true);
  });

  it('gives an unknown event a budget too', () => {
    const limiter = createRateLimiter(() => 0);

    for (let i = 0; i < RULES.room.burst; i++) {
      expect(limiter.allow('someEventNobodyHandles')).toBe(true);
    }
    expect(limiter.allow('someEventNobodyHandles')).toBe(false);
  });

  it('gives a drawer room to draw', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter(clock.now);

    // A hundred and forty-four points a second for ten seconds — a hand on a
    // 144Hz display, dragging without pause.
    for (let second = 0; second < 10; second++) {
      for (let point = 0; point < 144; point++) {
        expect(limiter.allow('continueDrawing')).toBe(true);
        clock.advance(1000 / 144);
      }
    }
  });
});

describe('a throttled socket', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('stops relaying a canvas command emitted in a loop', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const relayed = collect(guesser, 'drawerClear');
    for (let i = 0; i < 200; i++) drawer.emit('clear', roomId);
    await settle(300);

    expect(relayed.length).toBeGreaterThan(0);
    expect(relayed.length).toBeLessThanOrEqual(RULES.canvasCommand.burst + 2);
    // Dropped, not disconnected: an honest client that hits the limit by
    // accident should recover, not lose its seat.
    expect(drawer.connected).toBe(true);
  });

  it('leaves the other traffic alone while it throttles one kind', async () => {
    const { drawer, guesser, guesserName, roomId, word } =
      await playToDrawingPhase(harness);

    for (let i = 0; i < 200; i++) drawer.emit('clear', roomId);

    // The guess path has its own budget and has spent none of it.
    const scored = waitFor<Record<string, PlayerInfo>>(
      drawer,
      'playersReceivedPointsFromCorrectGuess',
    );
    guesser.emit('takingAGuess', roomId, guesserName, word);

    expect((await scored)[guesser.playerId]?.points).toBeGreaterThan(0);
  });

  it('does not stop an ordinary game from being played', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Owner' });
    await joinRoom(owner, roomId, 'Owner');
    await joinRoom(guest, roomId, 'Guest');

    const started = waitFor(owner, 'startDrawAndGuessGameSuccess');
    owner.emit('startDrawAndGuessGame', roomId);
    await started;

    expect(harness.server.rooms[roomId]?.isGameStarted).toBe(true);
  });
});
