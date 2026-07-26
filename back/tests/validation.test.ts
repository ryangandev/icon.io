import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chatRequest,
  joinRoomRequest,
  roomCreateRequest,
  roomIdOnly,
  startDrawingRequest,
} from '../libs/validation.js';

const validRoomId = randomUUID();

const validCreateRequest = {
  roomName: 'A Room',
  ownerUsername: 'Owner',
  maxPlayers: 4,
  rounds: 2,
  password: '',
};

describe('roomCreateRequest', () => {
  it('accepts a request the UI could actually produce', () => {
    expect(roomCreateRequest.safeParse(validCreateRequest).success).toBe(true);
  });

  it('treats an absent password as an unlocked room', () => {
    const result = roomCreateRequest.safeParse({
      roomName: 'A Room',
      ownerUsername: 'Owner',
      maxPlayers: 4,
      rounds: 2,
    });

    expect(result.success).toBe(true);
    expect(result.data?.password).toBe('');
  });

  /*
   * The distinction this pins down is `.optional().default('')` versus
   * `.catch('')`. Both tolerate a missing password, but `.catch` also
   * substitutes the default when the value is *present and invalid* — which
   * silently turned a rejected 10KB password into an unlocked room that the
   * person creating it believed was locked.
   */
  it('rejects an over-long password rather than defaulting it to unlocked', () => {
    const result = roomCreateRequest.safeParse({
      ...validCreateRequest,
      password: 'x'.repeat(10_000),
    });

    expect(result.success).toBe(false);
    expect(result.data?.password).not.toBe('');
  });

  it('bounds the seat count so a room cannot be created with a billion seats', () => {
    for (const maxPlayers of [0, 1, 9, 1_000_000_000, 2.5, NaN]) {
      expect(
        roomCreateRequest.safeParse({ ...validCreateRequest, maxPlayers })
          .success,
      ).toBe(false);
    }
  });

  it('bounds the round count', () => {
    expect(
      roomCreateRequest.safeParse({ ...validCreateRequest, rounds: 0 }).success,
    ).toBe(false);
    expect(
      roomCreateRequest.safeParse({ ...validCreateRequest, rounds: 99 })
        .success,
    ).toBe(false);
  });

  it('rejects a room name longer than the input allows', () => {
    expect(
      roomCreateRequest.safeParse({
        ...validCreateRequest,
        roomName: 'x'.repeat(41),
      }).success,
    ).toBe(false);
  });

  it('rejects a name that is only whitespace', () => {
    expect(
      roomCreateRequest.safeParse({
        ...validCreateRequest,
        roomName: '     ',
      }).success,
    ).toBe(false);
  });

  it('rejects the wrong types outright', () => {
    expect(
      roomCreateRequest.safeParse({
        ...validCreateRequest,
        maxPlayers: '4',
      }).success,
    ).toBe(false);
    expect(roomCreateRequest.safeParse(null).success).toBe(false);
    expect(roomCreateRequest.safeParse('a string').success).toBe(false);
  });
});

describe('roomIdOnly', () => {
  it('accepts a generated room id', () => {
    expect(roomIdOnly.safeParse([validRoomId]).success).toBe(true);
  });

  it('rejects anything that is not a uuid, since no room could match it', () => {
    for (const candidate of ['', '../../etc/passwd', 'room-1', 42, null]) {
      expect(roomIdOnly.safeParse([candidate]).success).toBe(false);
    }
  });
});

describe('joinRoomRequest', () => {
  it('accepts a join with a password', () => {
    expect(
      joinRoomRequest.safeParse([validRoomId, 'Alice', 'secret']).success,
    ).toBe(true);
  });

  it('rejects a username longer than the landing page allows', () => {
    expect(
      joinRoomRequest.safeParse([validRoomId, 'x'.repeat(19), '']).success,
    ).toBe(false);
  });

  it('rejects extra positional arguments', () => {
    expect(
      joinRoomRequest.safeParse([validRoomId, 'Alice', '', 'extra']).success,
    ).toBe(false);
  });
});

describe('chatRequest', () => {
  it('bounds the message at the length of the chat input', () => {
    expect(
      chatRequest.safeParse([validRoomId, 'Alice', 'x'.repeat(40)]).success,
    ).toBe(true);
    expect(
      chatRequest.safeParse([validRoomId, 'Alice', 'x'.repeat(41)]).success,
    ).toBe(false);
  });

  it('rejects an empty message', () => {
    expect(chatRequest.safeParse([validRoomId, 'Alice', '   ']).success).toBe(
      false,
    );
  });
});

describe('startDrawingRequest', () => {
  const point = { x: 100, y: 100 };

  it('accepts a stroke the canvas could have produced', () => {
    expect(
      startDrawingRequest.safeParse([validRoomId, point, '#ff0000', 12])
        .success,
    ).toBe(true);
  });

  it('rejects a colour that is not a hex value', () => {
    for (const color of [
      'red',
      'javascript:alert(1)',
      '#',
      '#gggggg',
      'url(x)',
    ]) {
      expect(
        startDrawingRequest.safeParse([validRoomId, point, color, 12]).success,
      ).toBe(false);
    }
  });

  it('rejects coordinates far outside the canvas', () => {
    for (const coords of [
      { x: 1e9, y: 0 },
      { x: 0, y: -1000 },
      { x: Infinity, y: 0 },
      { x: NaN, y: 0 },
    ]) {
      expect(
        startDrawingRequest.safeParse([validRoomId, coords, '#000000', 12])
          .success,
      ).toBe(false);
    }
  });

  it('bounds the brush size', () => {
    expect(
      startDrawingRequest.safeParse([validRoomId, point, '#000000', 0]).success,
    ).toBe(false);
    expect(
      startDrawingRequest.safeParse([validRoomId, point, '#000000', 100_000])
        .success,
    ).toBe(false);
  });
});
