import amqp from "amqplib";
import {
  clientWelcome,
  getInput,
  commandStatus,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic";
import {
  declareAndBind,
  SimpleQueueType,
  subscribeJSON,
} from "../internal/pubsub/consume";
import {
  ExchangePerilDirect,
  PauseKey,
  ArmyMovesPrefix,
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing";
import { GameState } from "../internal/gamelogic/gamestate";
import { commandSpawn } from "../internal/gamelogic/spawn";
import { commandMove } from "../internal/gamelogic/move";
import { handlerPause, handlerMove, handlerWar } from "./handlers";
import { publishJSON } from "../internal/pubsub/publish";

async function main() {
  const connStr = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(connStr);
  console.log("Peril game client connected to RabbitMQ!");
  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  const username = await clientWelcome();
  const gameState = new GameState(username);
  const publishCh = await conn.createConfirmChannel();
  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gameState),
  );
  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${username}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(gameState, publishCh),
  );
  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${WarRecognitionsPrefix}`,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gameState),
  );

  while (true) {
    const words = await getInput();
    if (words.length === 0) continue;

    const command = words[0];
    if (command === "spawn") {
      try {
        commandSpawn(gameState, words);
      } catch (err) {
        console.log((err as Error).message);
      }
    } else if (command === "move") {
      try {
        const move = commandMove(gameState, words);
        await publishJSON(
          publishCh,
          ExchangePerilTopic,
          `${ArmyMovesPrefix}.${username}`,
          move,
        );
        console.log("Move was published successfully");
      } catch (err) {
        console.log((err as Error).message);
      }
    } else if (command === "status") {
      await commandStatus(gameState);
    } else if (command === "help") {
      printClientHelp();
    } else if (command === "spam") {
      console.log("Spamming not allowed yet!");
    } else if (command === "quit") {
      printQuit();
      process.exit(0);
    } else {
      console.log("Unknown command");
      continue;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
