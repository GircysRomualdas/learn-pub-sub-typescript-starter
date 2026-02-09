import amqp from "amqplib";
import { clientWelcome } from "../internal/gamelogic/gamelogic";
import { declareAndBind } from "../internal/pubsub/bind";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";

async function main() {
  const connStr = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(connStr);
  console.log("Peril game client connected to RabbitMQ!");

  const username = await clientWelcome();

  const [ch, queue] = await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    "transient",
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
