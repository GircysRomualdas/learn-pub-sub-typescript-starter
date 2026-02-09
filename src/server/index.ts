import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";
import type { PlayingState } from "../internal/gamelogic/gamestate";

async function main() {
  const connStr = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(connStr);
  console.log("Peril game server connected to RabbitMQ!");

  const ch = await conn.createConfirmChannel();

  const playingState: PlayingState = {
    isPaused: true,
  };

  try {
    await publishJSON(ch, ExchangePerilDirect, PauseKey, playingState);
  } catch (err) {
    console.error("Error publishing message:", err);
  }

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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
