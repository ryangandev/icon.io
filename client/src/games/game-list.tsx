import { useSearchParams } from 'react-router';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { FilterChip } from '../ui';
import { GAME_KINDS, gamesOfKind, isGameKind, type GameKind } from './catalog';
import { GameCard } from './game-card';
import styles from './game-list.module.css';

/**
 * Every game, sorted by kind, with a filter for each kind: tiles four across
 * on a desktop, rows under a heading per kind on a phone. The filter is in the
 * address, so a refresh or a shared link keeps it.
 */
export function GameList() {
  const phone = useMediaQuery(PHONE);
  const [params, setParams] = useSearchParams();
  const param = params.get('kind');
  const selected: GameKind | null = isGameKind(param) ? param : null;
  const kinds = GAME_KINDS.filter(
    (entry) => selected === null || entry.kind === selected,
  );

  const select = (kind: GameKind | null) =>
    setParams(kind ? { kind } : {}, {
      replace: true,
      preventScrollReset: true,
    });
  const filters = (
    <div className={styles.filters} role="group" aria-label="Kind of game">
      <FilterChip selected={selected === null} onSelect={() => select(null)}>
        All
      </FilterChip>
      {GAME_KINDS.map((entry) => (
        <FilterChip
          key={entry.kind}
          selected={selected === entry.kind}
          onSelect={() => select(entry.kind)}
        >
          {entry.name}
        </FilterChip>
      ))}
    </div>
  );

  if (phone) {
    return (
      <div className={styles.list}>
        <div className={styles.strip}>{filters}</div>
        {kinds.map((entry) => (
          <section
            key={entry.kind}
            className={styles.kind}
            aria-labelledby={`kind-${entry.kind}`}
          >
            <div className={styles.kindHeading}>
              <h2 id={`kind-${entry.kind}`} className={styles.kindName}>
                {entry.name}
              </h2>
              <p className={styles.about}>{entry.about}</p>
            </div>
            {gamesOfKind(entry.kind).map((game) => (
              <GameCard key={game.type} game={game} layout="row" />
            ))}
          </section>
        ))}
      </div>
    );
  }
  return (
    <section className={styles.list} aria-labelledby="pick-a-game">
      <div className={styles.heading}>
        <h2 id="pick-a-game" className={styles.title}>
          Pick a game
        </h2>
        {filters}
      </div>
      <div className={styles.tiles}>
        {kinds.flatMap((entry) =>
          gamesOfKind(entry.kind).map((game) => (
            <GameCard key={game.type} game={game} layout="tile" />
          )),
        )}
      </div>
    </section>
  );
}
