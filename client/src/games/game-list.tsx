import { useSearchParams } from 'react-router';
import { useLocale, useMessages } from '../i18n';
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
  const m = useMessages();
  const { locale } = useLocale();
  const phone = useMediaQuery(PHONE);
  const [params, setParams] = useSearchParams();
  const param = params.get('kind');
  const selected: GameKind | null = isGameKind(param) ? param : null;
  const kinds = GAME_KINDS.filter(
    (kind) => selected === null || kind === selected,
  );

  const select = (kind: GameKind | null) =>
    setParams(kind ? { kind } : {}, {
      replace: true,
      preventScrollReset: true,
    });
  const filters = (
    <div
      className={styles.filters}
      role="group"
      aria-label={m.games.kindOfGame}
    >
      <FilterChip selected={selected === null} onSelect={() => select(null)}>
        {m.games.all}
      </FilterChip>
      {GAME_KINDS.map((kind) => (
        <FilterChip
          key={kind}
          selected={selected === kind}
          onSelect={() => select(kind)}
        >
          {m.games.kinds[kind].name}
        </FilterChip>
      ))}
    </div>
  );

  if (phone) {
    return (
      <div className={styles.list}>
        <div className={styles.strip}>{filters}</div>
        {kinds.map((kind) => (
          <section
            key={kind}
            className={styles.kind}
            aria-labelledby={`kind-${kind}`}
          >
            <div className={styles.kindHeading}>
              <h2 id={`kind-${kind}`} className={styles.kindName}>
                {m.games.kinds[kind].name}
              </h2>
              <p className={styles.about}>{m.games.kinds[kind].about}</p>
            </div>
            {gamesOfKind(kind, m, locale).map((game) => (
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
          {m.games.pickAGame}
        </h2>
        {filters}
      </div>
      <div className={styles.tiles}>
        {kinds.flatMap((kind) =>
          gamesOfKind(kind, m, locale).map((game) => (
            <GameCard key={game.type} game={game} layout="tile" />
          )),
        )}
      </div>
    </section>
  );
}
