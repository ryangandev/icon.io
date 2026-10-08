import { Tag } from '../ui';
import { useMessages } from '../i18n';
import type { GameInfo } from './catalog';
import styles from './game-tags.module.css';

/**
 * Who can play a game, as paper tags: Solo when it has a game on your own,
 * then its player count. The card and the intro both carry them. With an
 * `id`, the tags are `${id}-solo` and `${id}-players`, for a control that is
 * described by them.
 */
export function GameTags({ game, id }: { game: GameInfo; id?: string }) {
  const m = useMessages();
  return (
    <span className={styles.tags}>
      {game.solo && (
        <Tag tone="paper" id={id && `${id}-solo`}>
          {m.games.solo}
        </Tag>
      )}
      <Tag tone="paper" id={id && `${id}-players`}>
        {m.games.of[game.type].facts}
      </Tag>
    </span>
  );
}

/** The ids `GameTags` gives its tags, in reading order. */
export function gameTagIds(game: GameInfo, id: string): string[] {
  return [...(game.solo ? [`${id}-solo`] : []), `${id}-players`];
}
