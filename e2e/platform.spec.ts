import { createRoom, expect, joinRoom, test } from './fixtures';

test('a first visit asks for a name on the way to the games', async ({
  player,
}) => {
  const sam = await player('Sam', { named: false });
  await sam.goto('/');
  await sam.getByRole('link', { name: 'Let’s play' }).click();

  const name = sam.getByRole('textbox', { name: 'Your name' });
  await sam.getByRole('button', { name: 'Let’s play' }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  await name.fill('Sam');
  await sam.getByRole('button', { name: 'Let’s play' }).click();
  await expect(
    sam.getByRole('heading', { name: 'What are we playing?' }),
  ).toBeVisible();

  await sam
    .getByRole('region', { name: 'Minesweeper' })
    .getByRole('link', { name: 'Find a room' })
    .click();
  await expect(sam).toHaveURL(/\/games\/minesweeper$/);
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
