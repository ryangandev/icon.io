import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { GameType } from '../../../shared/wire-types';
import { RoomBar, type TagTone } from '../ui';
import { gameInfo } from '../games/catalog';
import { RulesDialog } from '../room/dialogs';
import { Page, useViewer } from '../shell/page';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './solo-layout.module.css';

export interface SoloLayoutProps {
  gameType: GameType;
  /** The second tag, after "On your own": the board, the hand, "Board cleared". */
  phase: { tone: TagTone; label: string };
  /** The game: turn bar and board, or the result over the board. */
  stage: ReactNode;
  /** Cards beside the game on a wide screen; a phone shows only the game. */
  side?: ReactNode;
}

/**
 * A game on your own: a room bar with no room, the game, and its cards beside
 * it (MS02-MS05, T01-T05, PR01-PR04). There is no seat, so Leave just goes.
 */
export function SoloLayout({ gameType, phase, stage, side }: SoloLayoutProps) {
  const game = gameInfo(gameType);
  const phone = useMediaQuery(PHONE);
  const navigate = useNavigate();
  const { viewer, viewerMenu } = useViewer();
  const [rules, setRules] = useState(false);

  return (
    <Page
      header={
        <RoomBar
          layout={phone ? 'phone' : 'desktop'}
          game={game.name}
          room="On your own"
          phase={phase}
          onHowToPlay={() => setRules(true)}
          onLeave={() => navigate('/')}
          leaveLabel="Leave"
          viewer={viewer}
          viewerMenu={viewerMenu}
        />
      }
    >
      {phone || side == null ? (
        <div className={styles.stage}>{stage}</div>
      ) : (
        <div className={styles.solo}>
          <div className={styles.stage}>{stage}</div>
          <div className={styles.side}>{side}</div>
        </div>
      )}
      <RulesDialog open={rules} onOpenChange={setRules} game={game} solo />
    </Page>
  );
}
