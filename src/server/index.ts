import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish";
import {
  ExchangePerilDirect,
  PauseKey,
  ExchangePerilTopic,
  GameLogSlug,
} from "../internal/routing/routing";
import { printServerHelp, getInput } from "../internal/gamelogic/gamelogic";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume";
import { subscribeMsgPack } from "../internal/pubsub/consume";
import { handlerLog } from "./handlers";

async function main() {
  const connStr = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(connStr);
  console.log("Peril game server connected to RabbitMQ!");
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
  await declareAndBind(
    conn,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
  );
  const publishCh = await conn.createConfirmChannel();

  await subscribeMsgPack(
    conn,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
    handlerLog(),
  );

  printServerHelp();

  while (true) {
    const words = await getInput();
    if (words.length === 0) continue;

    const command = words[0];
    if (command === "pause") {
      console.log("Publishing paused game state");
      try {
        await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
          isPaused: true,
        });
      } catch (err) {
        console.error("Error publishing pause message:", err);
      }
    } else if (command === "resume") {
      console.log("Publishing resumed game state");
      try {
        await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
          isPaused: false,
        });
      } catch (err) {
        console.error("Error publishing resume message:", err);
      }
    } else if (command === "quit") {
      console.log("Goodbye!");
      process.exit(0);
    } else {
      console.log("Unknown command");
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
