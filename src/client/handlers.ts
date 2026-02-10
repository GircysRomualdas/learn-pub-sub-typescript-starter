import type { GameState, PlayingState } from "../internal/gamelogic/gamestate";
import { handlePause } from "../internal/gamelogic/pause";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move";
import { AckType } from "../internal/pubsub/consume";
import type { ArmyMove } from "../internal/gamelogic/gamedata";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return AckType.Ack;
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
  return (move: ArmyMove): AckType => {
    const moveOutcome = handleMove(gs, move);
    process.stdout.write("> ");

    switch (moveOutcome) {
      case MoveOutcome.Safe:
      case MoveOutcome.MakeWar:
        return AckType.Ack;
      case MoveOutcome.SamePlayer:
        return AckType.NackDiscard;
      default:
        return AckType.NackDiscard;
    }
  };
}
