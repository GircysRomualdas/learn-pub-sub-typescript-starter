import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing";
import { printServerHelp, getInput } from "../internal/gamelogic/gamelogic";

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
  const publishCh = await conn.createConfirmChannel();

  printServerHelp();

  while (true) {
    const words = await getInput();

    if (words.length === 0) {
      continue;
    }

    switch (words[0]) {
      case "pause":
        console.log("Sending a pause message");
        try {
          await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
            isPaused: true,
          });
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "resume":
        console.log("Sending a resume message");
        try {
          await publishJSON(publishCh, ExchangePerilDirect, PauseKey, {
            isPaused: false,
          });
        } catch (err) {
          console.error("Error publishing message:", err);
        }
        break;
      case "quit":
        console.log("Exiting...");
        return;
      default:
        console.log(`unknown command: ${words[0]}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
