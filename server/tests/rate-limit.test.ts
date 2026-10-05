import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RULES, createRateLimiter } from '../libs/rate-limit.js';
import {
  SLOW_DRAWING,
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  request,
  settle,
  startGame,
  startTestServer,
  waitForDrawState,
  type TestServer,
} from './helpers/test-server.js';

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

describe('the rate limiter', () => {
  it('lets a whole burst through at once', () => {
    const limiter = createRateLimiter(() => 0);

    for (let i = 0; i < RULES.chat.burst; i++) {
      expect(limiter.allow('chat:send')).toBe(true);
    }
    expect(limiter.allow('chat:send')).toBe(false);
  });

  it('refills at the sustained rate', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter(clock.now);
    for (let i = 0; i < RULES.chat.burst; i++) limiter.allow('chat:send');

    // Not yet.
    clock.advance(100);
    expect(limiter.allow('chat:send')).toBe(false);

    // A second's worth of tokens is `ratePerSecond` of them.
    clock.advance(1000);
    for (let i = 0; i < RULES.chat.ratePerSecond; i++) {
      expect(limiter.allow('chat:send')).toBe(true);
    }
    expect(limiter.allow('chat:send')).toBe(false);
  });

  it('never banks more than one burst', () => {
    const clock = fakeClock();
    const limiter = createRateLimiter(clock.now);

    // An hour of silence does not buy an hour of shouting.
    clock.advance(3_600_000);
    for (let i = 0; i < RULES.chat.burst; i++) {
      expect(limiter.allow('chat:send')).toBe(true);
    }
    expect(limiter.allow('chat:send')).toBe(false);
  });

  /*
   * A drawing phase is a stream of hundreds of coordinates; joining a room is a
   * click. One budget for both would either throttle the pencil or wave the
   * clicks through.
   */
  it('spends each kind of event from its own budget', () => {
    const limiter = createRateLimiter(() => 0);

    for (let i = 0; i < RULES.chat.burst; i++) limiter.allow('chat:send');
    expect(limiter.allow('chat:send')).toBe(false);

    expect(limiter.allow('dg:draw:start')).toBe(true);
    expect(limiter.allow('lobby:subscribe')).toBe(true);
    expect(limiter.allow('dg:draw:undo')).toBe(true);
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

    // A hundred and forty-four points a second for ten seconds: a hand on a
    // 144Hz display, dragging without pause.
    for (let second = 0; second < 10; second++) {
      for (let point = 0; point < 144; point++) {
        expect(limiter.allow('dg:draw:move')).toBe(true);
        clock.advance(1000 / 144);
      }
    }
  });
});

describe('a throttled socket', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer(SLOW_DRAWING);
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('stops relaying a canvas command emitted in a loop', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const relayed = collect(guesser, 'dg:canvas:clear');
    for (let i = 0; i < 200; i++) drawer.emit('dg:draw:clear', roomId);
    await settle(300);

    expect(relayed.length).toBeGreaterThan(0);
    expect(relayed.length).toBeLessThanOrEqual(RULES.canvasCommand.burst + 2);
    // Dropped, not disconnected: an honest client that hits the limit by
    // accident should recover, not lose its seat.
    expect(drawer.connected).toBe(true);
  });

  it('leaves the other traffic alone while it throttles one kind', async () => {
    const { drawer, guesser, roomId, word } = await playToDrawingPhase(harness);

    for (let i = 0; i < 200; i++) drawer.emit('dg:draw:clear', roomId);

    // The chat path has its own budget and has spent none of it.
    const scored = waitForDrawState(drawer, (state) =>
      state.scoredThisTurn.includes(guesser.playerId),
    );
    guesser.emit('chat:send', roomId, word);

    expect((await scored).playerList[guesser.playerId]?.points).toBeGreaterThan(
      0,
    );
  });

  /*
   * A request the client is awaiting must be answered even when it is
   * dropped, or the page that sent it waits forever for its acknowledgement.
   */
  it('answers a throttled request instead of leaving it hanging', async () => {
    const client = await harness.connect();
    const roomId = await createRoom(client);

    const answers = await Promise.all(
      Array.from({ length: RULES.room.burst + 5 }, () =>
        request(client, 'room:sync', roomId),
      ),
    );

    const refused = answers.filter((answer) => !answer.ok);
    expect(refused.length).toBeGreaterThan(0);
    for (const answer of refused) {
      expect(answer.error).toEqual({
        type: 'invalidRequest',
        message: 'Too many requests. Try again in a moment.',
      });
    }
    expect(client.connected).toBe(true);
  });

  it('does not stop an ordinary game from being played', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { username: 'Owner' });
    await joinRoom(guest, roomId, 'Guest');

    await startGame(owner, roomId);

    expect(harness.server.rooms.get(roomId)?.isGameStarted).toBe(true);
  });
});
