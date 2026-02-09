import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";

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

  await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
