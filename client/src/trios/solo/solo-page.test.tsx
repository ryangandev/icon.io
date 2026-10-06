import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardName, findTrios, isTrio } from '../../../../shared/trios';
import { onPhone } from '../../tests/phone';
import { renderApp } from '../../tests/render-app';
import {
  afterFlash,
  FLASH_MS,
  newRun,
  pick,
  RUN_TRIOS,
  type SoloRun,
} from './run';

const SEED = 'k3f9x2';

const turn = () => within(screen.getByRole('region', { name: 'Turn' }));
const table = () => within(screen.getByRole('group', { name: 'Table' }));
/** The cards on the table, in their places. */
const places = () => table().getAllByRole('button');

let user: ReturnType<typeof userEvent.setup>;
/** The run as the page plays it, to know where the trios are. */
let model: SoloRun;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  model = newRun(SEED, 0);
});

afterEach(() => {
  vi.useRealTimers();
});

const pause = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Picks the cards at `chosen`, on the page and in the model. */
async function pickPlaces(chosen: readonly number[]) {
  for (const place of chosen) {
    await user.click(places()[place]);
    model = pick(model, place, 0);
  }
}

/** Finds the first trio on the table, and waits for the next cards. */
async function findTrio() {
  await pickPlaces(findTrios(model.deal.table)[0]);
  await pause(FLASH_MS);
  model = afterFlash(model, 0);
}

/** Starts the run `SEED` deals. */
async function startRun() {
  const view = await renderApp(`/games/trios/solo?seed=${SEED}`);
  await user.click(screen.getByRole('button', { name: 'Start' }));
  return view;
}

describe('Trios on your own', () => {
  it('is offered from the games page', async () => {
    await renderApp('/games');
    const trios = screen.getByRole('heading', { name: 'Trios' }).parentElement!;
    expect(
      within(trios).getByRole('link', { name: 'Play solo' }),
    ).toHaveAttribute('href', '/games/trios/solo');
  });

  it('deals on a first visit when asked', async () => {
    const { router } = await renderApp('/games/trios/solo', {
      firstVisit: true,
    });
    expect(router.state.location.pathname).toBe('/games/trios/solo');
    expect(screen.getByText('Ten trios, one clock.')).toBeInTheDocument();
    expect(screen.getByText('Not yet')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Table' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(turn().getByText('Trio 1 of 10')).toBeInTheDocument();
    expect(turn().getByText('Find a trio')).toBeInTheDocument();
    expect(places()).toHaveLength(12);
  });

  it('plays a challenge’s own deal', async () => {
    await renderApp(`/games/trios/solo?seed=${SEED}`);
    expect(
      screen.getByText(/^A friend sent you this deal\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(places().map((card) => card.getAttribute('aria-label'))).toEqual(
      model.deal.table.map(cardName),
    );
  });

  it('says why three cards are not a trio, and adds 5 seconds', async () => {
    await startRun();
    const t = model.deal.table;
    const third = t.findIndex((_, c) => c > 1 && !isTrio(t[0], t[1], t[c]));
    await pickPlaces([0, 1]);
    expect(turn().getByText('Pick a third card')).toBeInTheDocument();
    await pickPlaces([third]);

    expect(turn().getByText('Not a trio, +5 s')).toBeInTheDocument();
    expect(turn().getByText(/^Two (are|have) /)).toBeInTheDocument();
    expect(turn().getByRole('timer')).toHaveTextContent(/^00:0[5-6]/);
    expect(
      table().getByRole('img', { name: `${cardName(t[0])}, not a trio` }),
    ).toBeInTheDocument();

    await pause(FLASH_MS);
    expect(turn().getByText('Find a trio')).toBeInTheDocument();
    expect(screen.getByText('1, +0:05')).toBeInTheDocument();
  });

  it('marks a card of a trio for 10 seconds, twice at most', async () => {
    await startRun();
    await user.click(screen.getByRole('button', { name: 'Hint, +10 s' }));
    expect(table().getAllByRole('button', { name: /, hint$/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Hint, +10 s' }));
    expect(table().getAllByRole('button', { name: /, hint$/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Hint, +10 s' })).toBeNull();
    expect(turn().getByRole('timer')).toHaveTextContent(/^00:2[0-1]/);
  });

  it('ends after ten trios with every one, keeps the best and copies a challenge', async () => {
    await startRun();
    await pickPlaces(findTrios(model.deal.table)[0]);
    expect(turn().getByText('A trio!')).toBeInTheDocument();
    expect(turn().getByText(/^Found in 0:0\d$/)).toBeInTheDocument();
    await pause(FLASH_MS);
    model = afterFlash(model, 0);
    expect(turn().getByText('Trio 2 of 10')).toBeInTheDocument();
    for (let trio = 1; trio < RUN_TRIOS; trio++) await findTrio();

    expect(
      screen.getByRole('heading', { name: /^10 trios in 0:0\d\.$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your first run on this device.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Run complete')).toBeInTheDocument();

    const trios = within(
      screen.getByRole('region', { name: 'Every trio' }),
    ).getAllByRole('listitem');
    expect(trios).toHaveLength(RUN_TRIOS);
    expect(
      within(trios[0])
        .getAllByRole('img')
        .map((c) => c.getAttribute('aria-label')),
    ).toEqual(model.results[0].cards.map(cardName));
    expect(localStorage.getItem('zumpo:solo:best:trios:ten-trios')).toMatch(
      /^\d+$/,
    );
    expect(screen.getByText('Today')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Challenge a friend' }),
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/games/trios/solo?seed=${SEED}`,
    );

    // Play again is a new run, not the challenge again.
    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(turn().getByText('Trio 1 of 10')).toBeInTheDocument();
  });

  it('keeps to the table on a phone', async () => {
    onPhone();
    await startRun();
    expect(places()).toHaveLength(12);
    expect(screen.queryByText('This run')).toBeNull();
  });
});
