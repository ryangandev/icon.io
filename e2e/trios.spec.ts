import { createRoom, expect, joinRoom, test } from './fixtures';
import { pickMiss, pickTrio, readyToFind, tableOf, turnOf } from './play/trios';

test('two players race for trios until the game is over', async ({
  player,
}) => {
  test.setTimeout(120_000);
  const maya = await player('Maya');
  const leo = await player('Leo');
  await joinRoom(leo, await createRoom(maya, 'trios', { seats: 2, trios: 10 }));
  await maya.getByRole('button', { name: 'Start game' }).click();
  await expect(maya.getByText('0 of 10 trios')).toBeVisible();
  await readyToFind(leo);

  // A wrong claim locks Leo out on his own screen, and tells nobody else.
  await pickMiss(leo);
  await expect(turnOf(leo).getByText('Not a trio')).toBeVisible();
  await expect(leo.getByLabel(/, not a trio$/)).toHaveCount(3);
  await expect(
    leo.getByRole('group', { name: 'Table' }).getByRole('button'),
  ).toHaveCount(0);
  await expect(turnOf(maya).getByText('Find a trio')).toBeVisible();
  await expect(maya.getByLabel(/, not a trio$/)).toHaveCount(0);

  // Maya takes the first trio, and Leo sees who took it.
  await pickTrio(maya);
  await expect(turnOf(maya).getByText('You found a trio!')).toBeVisible();
  await expect(turnOf(leo).getByText('Maya found a trio')).toBeVisible();
  await expect(leo.getByText('1 of 10 trios')).toBeVisible();

  // Maya takes six in all and Leo four; the lockout is long over by then.
  for (let trio = 2; trio <= 10; trio++) {
    const finder = trio <= 6 ? maya : leo;
    await readyToFind(finder);
    await pickTrio(finder);
    if (trio === 10) break;
    // Both have seen it taken before either looks again.
    for (const page of [maya, leo]) {
      await expect(page.getByText(`${trio} of 10 trios`)).toBeVisible();
    }
  }

  for (const page of [maya, leo]) {
    await expect(page.getByText('Game over', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Maya wins with 6 trios.' }),
    ).toBeVisible();
  }
  await expect(
    maya.getByRole('list', { name: 'Standings' }).getByRole('listitem'),
  ).toHaveCount(2);
  // The finished table stays up, the last trio marked with who took it.
  expect(await tableOf(maya)).toHaveLength(12);
  await expect(maya.getByLabel(/, found, by Leo$/)).toHaveCount(3);
});

test('a player with no name finds ten trios on their own', async ({
  player,
}) => {
  test.setTimeout(120_000);
  const sam = await player('Sam', { named: false });
  let sockets = 0;
  sam.on('websocket', () => sockets++);
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Trios' })
    .getByRole('link', { name: 'Play solo' })
    .click();
  await sam.getByRole('button', { name: 'Start' }).click();

  const turn = turnOf(sam);
  await expect(turn.getByText('Trio 1 of 10')).toBeVisible();
  // A wrong pick costs five seconds, never a trio.
  await pickMiss(sam);
  await expect(turn.getByText('Not a trio, +5 s')).toBeVisible();
  await expect(
    sam.getByRole('region', { name: 'This run' }).getByText('1, +0:05'),
  ).toBeVisible();

  for (let trio = 1; trio <= 10; trio++) {
    await expect(turn.getByText(`Trio ${trio} of 10`)).toBeVisible();
    await readyToFind(sam);
    await pickTrio(sam);
    // The last trio ends the run at once.
    if (trio < 10) await expect(turn.getByText('A trio!')).toBeVisible();
  }

  await expect(
    sam.getByRole('heading', { name: /^10 trios in \d+:\d\d\.$/ }),
  ).toBeVisible();
  await expect(sam.getByText('Run complete', { exact: true })).toBeVisible();
  await expect(
    sam.getByRole('button', { name: 'Challenge a friend' }).first(),
  ).toBeVisible();
  expect(sockets).toBe(0);
});
