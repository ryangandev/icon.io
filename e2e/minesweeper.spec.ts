import { createRoom, expect, joinRoom, test } from './fixtures';

const HIDDEN = /: hidden$/;

test('two players pick until the board is done', async ({ player }) => {
  test.setTimeout(180_000);
  const maya = await player('Maya');
  const leo = await player('Leo');
  await joinRoom(leo, await createRoom(maya, 'minesweeper'));
  await maya.getByRole('button', { name: 'Start game' }).click();

  // A pick locks in, and the other player sees that it did.
  await expect(maya.getByText('Pick a cell')).toBeVisible();
  await maya.getByRole('button', { name: HIDDEN }).first().click();
  await expect(
    leo.getByRole('region', { name: 'Players' }).getByText('Locked in'),
  ).toBeVisible();
  await leo.getByRole('button', { name: HIDDEN }).last().click();
  await expect(maya.getByText(/Round 1 results/).first()).toBeVisible();

  const over = maya.getByText('Game over', { exact: true });
  while (!(await over.isVisible())) {
    const open = maya.getByText('Pick a cell').or(over);
    await expect(open).toBeVisible();
    if (await over.isVisible()) break;
    // Both always pick, so no round waits out its clock; the last cell left
    // can take both picks, which split its points.
    await maya.getByRole('button', { name: HIDDEN }).first().click();
    await leo.getByRole('button', { name: HIDDEN }).last().click();
    await expect(maya.getByText('Pick a cell')).toBeHidden();
  }

  // The winner is celebrated with a burst of confetti that clears itself.
  const confetti = maya.locator('canvas[aria-hidden]');
  await expect(confetti).toBeVisible();
  await expect(confetti).toHaveCount(0, { timeout: 10_000 });

  await expect(
    maya.getByRole('list', { name: 'Standings' }).getByRole('listitem'),
  ).toHaveCount(2);
  await expect(maya.getByRole('button', { name: HIDDEN })).toHaveCount(0);
});
