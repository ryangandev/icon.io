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

test('a player with no name plays a board on their own', async ({ player }) => {
  const sam = await player('Sam', { named: false });
  let sockets = 0;
  sam.on('websocket', () => sockets++);
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Minesweeper' })
    .getByRole('link', { name: 'Play solo' })
    .click();
  await sam.getByRole('radio', { name: /Small/ }).click();
  await sam.getByRole('button', { name: 'Start' }).click();
  await expect(sam).toHaveURL(/\/games\/minesweeper\/solo\?board=Small$/);

  // The first click opens an area; a right-click flags.
  const turn = sam.getByRole('region', { name: 'Turn' });
  await sam.getByRole('button', { name: /^Row 5, column 5: hidden$/ }).click();
  await expect(sam.getByRole('gridcell', { name: /: empty$/ })).not.toHaveCount(
    0,
  );
  await sam.getByRole('button', { name: HIDDEN }).first().click({
    button: 'right',
  });
  await expect(turn.getByText('9 mines left')).toBeVisible();

  // Open cells until the board is cleared or a mine goes off.
  const over = turn
    .getByText('You hit a mine')
    .or(sam.getByRole('heading', { name: /^Cleared in / }));
  while (!(await over.isVisible())) {
    await sam.getByRole('button', { name: HIDDEN }).last().click();
  }
  await expect(
    sam.getByRole('button', { name: /^(Try|Play) again$/ }).first(),
  ).toBeVisible();
  expect(sockets).toBe(0);
});
