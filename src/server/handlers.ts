import { writeLog } from "../internal/gamelogic/logs";
import type { GameLog } from "../internal/gamelogic/logs";
import { AckType } from "../internal/pubsub/consume";

export function handlerLog(): (gameLog: GameLog) => Promise<AckType> {
  return async (gameLog: GameLog): Promise<AckType> => {
    try {
      await writeLog(gameLog);
      process.stdout.write("> ");
      return AckType.Ack;
    } catch (err) {
      console.error("Error write log:", err);
      return AckType.NackDiscard;
    }
  };
}
