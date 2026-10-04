import { createRoom, dropConnection, expect, joinRoom, test } from './fixtures';

test('a refresh keeps the seat and the score', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo');
  await joinRoom(leo, await createRoom(maya, 'minesweeper'));
  await maya.getByRole('button', { name: 'Start game' }).click();
  await expect(leo.getByText('Pick a cell')).toBeVisible();

  await leo.reload();
  await expect(leo.getByText('Pick a cell')).toBeVisible();
  const players = maya.getByRole('region', { name: 'Players' });
  await expect(players.getByText('Leo')).toBeVisible();
  await expect(players.getByText('Away')).toBeHidden();
});

test('a dropped connection comes back to the room', async ({ player }) => {
  const maya = await player('Maya');
  const leo = await player('Leo', { droppable: true });
  await joinRoom(leo, await createRoom(maya, 'draw-and-guess'));

  const restore = await dropConnection(leo);
  await expect(
    leo.getByRole('heading', { name: 'A little pause.' }),
  ).toBeVisible();
  await expect(
    maya.getByRole('region', { name: 'Players' }).getByText('Away'),
  ).toBeVisible();
  restore();
  await expect(leo.getByRole('heading', { name: 'Draw & Guess' })).toBeVisible({
    timeout: 20_000,
  });

  const chat = maya.getByRole('textbox', { name: 'Message' });
  await chat.fill('welcome back');
  await chat.press('Enter');
  await expect(leo.getByText('welcome back')).toBeVisible();
});

test('a lobby lists rooms again after a dropped connection', async ({
  player,
}) => {
  const sam = await player('Sam', { droppable: true });
  const maya = await player('Maya');
  const roomName = `After the drop ${test.info().workerIndex}-${Date.now()}`;
  await sam.goto('/games/minesweeper');
  await expect(sam.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(sam.getByText('Finding your people…')).toBeHidden();

  const restore = await dropConnection(sam);
  await expect(sam.getByText('Finding your people…')).toBeVisible();
  restore();
  await createRoom(maya, 'minesweeper', { name: roomName });
  await expect(sam.getByRole('article', { name: roomName })).toBeVisible({
    timeout: 20_000,
  });
});
