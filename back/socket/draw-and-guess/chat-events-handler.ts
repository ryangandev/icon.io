import type { Socket } from 'socket.io';
import type { DrawAndGuessState } from '../../models/types.js';
import type { GameContext } from '../../libs/rooms/types.js';
import {
  broadcastToRoom,
  emitToRoom,
  emitToSocket,
  onClientEvent,
} from '../../libs/rooms/emit.js';
import { parseArgs } from '../../libs/validation.js';
import { guessRequest } from './validation.js';
import type { DrawAndGuessGameEngine } from './game-engine.js';

/**
 * The guess channel.
 *
 * It shares an input box with chat, which is why it used to share a handler
 * with it. It is not chat: a guess is checked against the live word, scored on
 * the clock, refused to the drawer and to anyone who has already got it, and it
 * can end the turn. Plain messages go through the room layer's `chat:send`.
 */
const guessEventsHandler = (
  socket: Socket,
  ctx: GameContext,
  gameEngine: DrawAndGuessGameEngine,
) => {
  const { io, sessions } = ctx;

  onClientEvent(socket, 'dg:guess', (...rawArgs: unknown[]) => {
    const validated = parseArgs(guessRequest, rawArgs, 'dg:guess');
    if (!validated) return;
    const [roomId, username, message] = validated;

    const room = ctx.rooms.ofType<DrawAndGuessState>(roomId, 'draw-and-guess');
    if (!room) return;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    const game = room.game;
    const currentPlayer = room.playerList[playerId];
    const currentDrawer = room.playerList[game.currentDrawer];

    /*
     * None of this was checked before. The UI disables the input for the
     * drawer and for anyone who has already scored, and only routes a
     * message here during the drawing phase — but a modified client is not
     * bound by any of that, and could have awarded itself points by
     * guessing its own word, or guessed during the reveal when the word is
     * on screen for everyone to read.
     */
    if (!currentPlayer) return; // not in this room
    if (!game.isDrawingPhase) return; // nothing to guess yet
    if (game.currentDrawer === playerId) return; // knows the answer
    if (game.scoredThisTurn.has(playerId)) return; // already scored
    if (game.currentWord === '') return;

    const isCorrect =
      message.toLowerCase().trim() === game.currentWord.toLowerCase().trim();

    if (isCorrect && currentDrawer) {
      // What a guess is worth depends on how much of the phase is left, which
      // is the engine's business — it owns the clock.
      const award = gameEngine.pointsForCorrectGuess(room);

      currentDrawer.points += award.drawer;
      currentPlayer.points += award.guesser;
      game.scoredThisTurn.add(playerId);

      emitToRoom(
        io,
        roomId,
        'dg:guess:correct',
        '📢 System',
        `${username} guessed the correct word! (+${award.guesser})`,
      );

      emitToRoom(io, roomId, 'dg:scores', {
        playerList: room.playerList,
        scoredThisTurn: [...game.scoredThisTurn],
      });

      // The engine decides what a scored guess means for the turn: if that
      // was the last player who could still guess, there is nothing left to
      // draw for and the phase ends here rather than running its clock out.
      gameEngine.handleCorrectGuess(room);
    } else {
      // A wrong guess is just chat. Echoing it back to the sender keeps
      // their own message in their log alongside everyone else's.
      broadcastToRoom(socket, roomId, 'chat:message', username, message);
      emitToSocket(socket, 'chat:message', `${username} (You)`, message);
    }
  });
};

export { guessEventsHandler };
