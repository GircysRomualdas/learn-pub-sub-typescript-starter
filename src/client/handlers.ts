import type { GameState, PlayingState } from "../internal/gamelogic/gamestate";
import { handlePause } from "../internal/gamelogic/pause";
import { handleMove } from "../internal/gamelogic/move";

export function handlerPause(gs: GameState): (ps: PlayingState) => void {
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
  };
}

export function handlerMove(gs: GameState): (ps: PlayingState) => void {
  return (move: ArmyMove) => {
    handleMove(gs, move);
    process.stdout.write("> ");
  };
}
