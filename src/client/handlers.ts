import type { GameState, PlayingState } from "../internal/gamelogic/gamestate";
import { handlePause } from "../internal/gamelogic/pause";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move";
import { AckType } from "../internal/pubsub/consume";
import type { ArmyMove } from "../internal/gamelogic/gamedata";
import { publishJSON } from "../internal/pubsub/publish";
import {
  ArmyMovesPrefix,
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing";
import type { RecognitionOfWar } from "../internal/gamelogic/gamedata";
import type { Channel } from "amqplib";
import { handleWar, WarOutcome } from "../internal/gamelogic/war";
import { publishGameLog } from "./index.ts";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return AckType.Ack;
  };
}

export function handlerMove(
  gs: GameState,
  ch: Channel,
): (move: ArmyMove) => Promise<AckType> {
  return async (move: ArmyMove): Promise<AckType> => {
    const moveOutcome = handleMove(gs, move);
    process.stdout.write("> ");

    switch (moveOutcome) {
      case MoveOutcome.Safe:
        return AckType.Ack;
      case MoveOutcome.MakeWar:
        const recognition: RecognitionOfWar = {
          attacker: move.player,
          defender: gs.getPlayerSnap(),
        };
        try {
          await publishJSON(
            ch,
            ExchangePerilTopic,
            `${WarRecognitionsPrefix}.${gs.getUsername()}`,
            recognition,
          );
          return AckType.Ack;
        } catch {
          return AckType.NackRequeue;
        }
      case MoveOutcome.SamePlayer:
        return AckType.NackDiscard;
      default:
        return AckType.NackDiscard;
    }
  };
}

export function handlerWar(
  gs: GameState,
  ch: Channel,
): (rw: RecognitionOfWar) => Promise<AckType> {
  return async (rw: RecognitionOfWar): Promise<AckType> => {
    const warResolution = handleWar(gs, rw);
    process.stdout.write("> ");

    let msg: string;

    switch (warResolution.result) {
      case WarOutcome.NotInvolved:
        return AckType.NackRequeue;
      case WarOutcome.NoUnits:
        return AckType.NackDiscard;
      case WarOutcome.YouWon:
      case WarOutcome.OpponentWon:
        msg = `${warResolution.winner} won a war against ${warResolution.loser}`;
        break;
      case WarOutcome.Draw:
        msg = `A war between ${warResolution.attacker} and ${warResolution.defender} resulted in a draw`;
        break;
      default:
        console.log(`Unknown war resolution: ${warResolution.result}`);
        return AckType.NackDiscard;
    }

    try {
      await publishGameLog(ch, gs.getUsername(), msg);
    } catch {
      return AckType.NackRequeue;
    }
    return AckType.Ack;
  };
}
