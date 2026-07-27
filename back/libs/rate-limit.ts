/**
 * How often a client may say something.
 *
 * Every inbound event has had its *shape* checked since the validation pass —
 * a room name cannot be a megabyte long, a coordinate cannot be a billion — but
 * nothing bounded how many of them arrived. A client could emit `dg:draw:start`
 * in a loop, or `room:create` a thousand times a second, and the only limit was
 * its own bandwidth. This is the other half of that check.
 *
 * One bucket per kind of event rather than one for the whole socket, because
 * the kinds are nothing like each other: a drawing phase is a stream of
 * hundreds of coordinates a minute, while joining a room is a click. A single
 * budget would either throttle the pencil or wave the clicks through.
 *
 * Buckets are per socket, so nobody can exhaust anybody else's budget, and they
 * are collected with the connection.
 */

interface BucketRule {
  /** Sustained events per second, once the burst is spent. */
  ratePerSecond: number;
  /** How many may arrive at once before the rate starts to matter. */
  burst: number;
}

type BucketName = 'drawing' | 'canvasCommand' | 'chat' | 'room';

const RULES: Record<BucketName, BucketRule> = {
  // A mouse drag is a stream. Browsers coalesce `mousemove` to somewhere
  // around the refresh rate, so 200 a second is well clear of a human hand on
  // a 144Hz display and nowhere near a `for` loop.
  drawing: { ratePerSecond: 200, burst: 400 },
  // Undo and clear are button presses. A dozen in a row is an impatient
  // player; a hundred is not a player.
  canvasCommand: { ratePerSecond: 4, burst: 12 },
  // The chat box caps at 40 characters and needs a keystroke to send.
  chat: { ratePerSecond: 4, burst: 8 },
  // Joining, leaving, creating, starting: all clicks.
  room: { ratePerSecond: 4, burst: 10 },
};

const BUCKET_FOR_EVENT: Record<string, BucketName> = {
  'dg:draw:start': 'drawing',
  'dg:draw:move': 'drawing',
  'dg:draw:end': 'drawing',

  'dg:draw:undo': 'canvasCommand',
  'dg:draw:clear': 'canvasCommand',

  'chat:send': 'chat',
  'dg:guess': 'chat',

  identifyPlayer: 'room',
  'lobby:subscribe': 'room',
  'lobby:unsubscribe': 'room',
  'room:create': 'room',
  'room:join': 'room',
  'room:leave': 'room',
  'room:sync': 'room',
  'game:start': 'room',
  'dg:select-word': 'room',
  // One pick per player per round, and the engine ignores the rest.
  'ms:pick': 'room',
};

/**
 * Anything not listed above has no handler, so it costs nothing to process —
 * but it still costs a packet to receive, and a flood of them should be as
 * bounded as a flood of real ones.
 */
const DEFAULT_BUCKET: BucketName = 'room';

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

/**
 * One socket's budget. `now` is injectable so a test can exercise the refill
 * without spending real seconds waiting for it.
 */
const createRateLimiter = (now: () => number = Date.now) => {
  const buckets = new Map<BucketName, TokenBucket>();

  const allow = (eventName: string): boolean => {
    const name = BUCKET_FOR_EVENT[eventName] ?? DEFAULT_BUCKET;
    const rule = RULES[name];
    const currentMs = now();

    let bucket = buckets.get(name);
    if (!bucket) {
      bucket = { tokens: rule.burst, lastRefillMs: currentMs };
      buckets.set(name, bucket);
    }

    const elapsedSeconds = Math.max(
      0,
      (currentMs - bucket.lastRefillMs) / 1000,
    );
    bucket.tokens = Math.min(
      rule.burst,
      bucket.tokens + elapsedSeconds * rule.ratePerSecond,
    );
    bucket.lastRefillMs = currentMs;

    if (bucket.tokens < 1) return false;

    bucket.tokens -= 1;
    return true;
  };

  return { allow };
};

type RateLimiter = ReturnType<typeof createRateLimiter>;

export { createRateLimiter, RULES, BUCKET_FOR_EVENT };
export type { BucketName, BucketRule, RateLimiter };
