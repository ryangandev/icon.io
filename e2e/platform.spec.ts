import { createRoom, expect, joinRoom, test } from './fixtures';

test('a first visit asks for a name on the way into a game', async ({
  player,
}) => {
  const sam = await player('Sam', { named: false });
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Minesweeper' })
    .getByRole('link', { name: 'Find a room' })
    .click();

  const name = sam.getByRole('textbox', { name: 'Your name' });
  await sam.getByRole('button', { name: 'Let’s play' }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  await name.fill('Sam');
  await sam.getByRole('button', { name: 'Let’s play' }).click();
  await expect(sam).toHaveURL(/\/games\/minesweeper$/);
});

test('a player goes home and straight back into another game', async ({
  player,
}) => {
  const sam = await player('Sam');
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Draw & Guess' })
    .getByRole('link', { name: 'Find a room' })
    .click();
  await expect(sam).toHaveURL(/\/games\/draw-and-guess$/);

  await sam.getByRole('link', { name: 'Zumpo home' }).click();
  await sam
    .getByRole('group', { name: 'Kind of game' })
    .getByRole('button', { name: 'Puzzles' })
    .click();
  await expect(sam).toHaveURL(/\/\?kind=puzzles$/);
  await expect(sam.getByRole('region', { name: 'Draw & Guess' })).toHaveCount(
    0,
  );
  await sam
    .getByRole('region', { name: 'Make 24' })
    .getByRole('link', { name: 'Play solo' })
    .click();
  await expect(sam).toHaveURL(/\/games\/make-24\/solo$/);
});

test('a player changes their name from the header', async ({ player }) => {
  const sam = await player('Sam');
  await sam.goto('/games/minesweeper');
  await sam.getByRole('button', { name: 'Sam: your name' }).click();
  await sam.getByRole('button', { name: 'Change name' }).click();

  const name = sam.getByRole('textbox', { name: 'Your name' });
  await expect(name).toHaveValue('Sam');
  await name.fill('Samira');
  await sam.getByRole('button', { name: 'Let’s play' }).click();
  await expect(
    sam.getByRole('button', { name: 'Samira: your name' }),
  ).toBeVisible();
});

test('a friend joins from the invite link', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo');
  const link = await createRoom(maya, 'draw-and-guess');

  await maya.getByRole('button', { name: 'Invite friends' }).first().click();
  const invite = maya.getByRole('dialog', { name: 'Invite friends' });
  await expect(invite.getByRole('textbox', { name: 'Room link' })).toHaveValue(
    link,
  );
  await expect(invite.getByRole('button', { name: 'Copy' })).toBeFocused();
  await invite.getByRole('button', { name: 'Done' }).click();

  await joinRoom(leo, link);
  const players = maya.getByRole('region', { name: 'Players' });
  await expect(players.getByText('Leo')).toBeVisible();
  await expect(maya.getByRole('button', { name: 'Start game' })).toBeVisible();
});

test('a room keeps a player until they mean to leave', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo');
  const roomName = `Keep ${test.info().workerIndex}-${Date.now()}`;
  const link = await createRoom(maya, 'draw-and-guess', { name: roomName });
  // In from the lobby, so back is a step inside the app; a back to another
  // page load leaves the app, which no page can stop.
  await leo.goto('/games/draw-and-guess');
  await leo
    .getByRole('article', { name: roomName })
    .getByRole('button', { name: 'Join' })
    .click();
  await expect(leo).toHaveURL(link);

  await leo.getByRole('button', { name: 'How to play' }).click();
  const rules = leo.getByRole('dialog', { name: 'How to play Draw & Guess' });
  await expect(rules.getByText('2–8 players')).toBeVisible();
  await rules.getByRole('button', { name: 'Back to the game' }).click();
  await expect(rules).toBeHidden();
  await expect(leo).toHaveURL(link);

  // Between games, any way out but Leave room asks first.
  await leo.getByRole('link', { name: 'Zumpo home' }).click();
  const leave = leo.getByRole('dialog', { name: /^Leave .*\?$/ });
  await expect(leave.getByText('Your seat goes with you.')).toBeVisible();
  await leave.getByRole('button', { name: 'Stay' }).click();
  await expect(leo).toHaveURL(link);

  await leo.goBack();
  await leave.getByRole('button', { name: 'Leave room' }).click();
  await expect(leo).toHaveURL(/\/games\/draw-and-guess$/);
  await expect(
    maya.getByRole('region', { name: 'Players' }).getByText('Leo'),
  ).toBeHidden();
});

test('a private room asks for its password', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo');
  const link = await createRoom(maya, 'minesweeper', { password: 'otter' });

  await leo.goto(link);
  const password = leo.getByLabel('Room password');
  await password.fill('seal');
  await leo.getByRole('button', { name: 'Join room' }).click();
  await expect(
    leo.getByText('That password didn’t work. Try again.'),
  ).toBeVisible();
  await expect(password).toBeFocused();

  await password.fill('otter');
  await leo.getByRole('button', { name: 'Join room' }).click();
  await expect(leo.getByRole('button', { name: 'Leave room' })).toBeVisible();
});

test('a lobby shows a new room live, and joins it', async ({ player }) => {
  const sam = await player('Sam');
  const maya = await player('Maya');
  const roomName = `Lobby check ${test.info().workerIndex}-${Date.now()}`;

  await sam.goto('/games/draw-and-guess');
  await expect(sam.getByRole('heading', { level: 1 })).toBeVisible();
  await createRoom(maya, 'draw-and-guess', { name: roomName });

  const row = sam.getByRole('article', { name: roomName });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Join' }).click();
  await expect(sam.getByRole('button', { name: 'Leave room' })).toBeVisible();
});

test('a mangled room link says the room is gone', async ({ player }) => {
  const sam = await player('Sam');
  await sam.goto('/games/draw-and-guess/rooms/not-a-room');
  await expect(
    sam.getByRole('heading', { name: 'This room has packed up.' }),
  ).toBeVisible();
});

test('a game in progress turns a latecomer away', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo');
  const sam = await player('Sam');
  const link = await createRoom(maya, 'minesweeper');
  await joinRoom(leo, link);
  await maya.getByRole('button', { name: 'Start game' }).click();
  await expect(leo.getByText('Pick a cell')).toBeVisible();

  await sam.goto(link);
  await expect(
    sam.getByRole('heading', { name: 'That room moved on.' }),
  ).toBeVisible();
});
