import amqp from "amqplib";
import type { Channel } from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum AckType {
  Ack,
  NackDiscard,
  NackRequeue,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();

  const queue = await ch.assertQueue(queueName, {
    durable: queueType === SimpleQueueType.Durable,
    exclusive: queueType !== SimpleQueueType.Durable,
    autoDelete: queueType !== SimpleQueueType.Durable,
    arguments: {
      "x-dead-letter-exchange": "peril_dlx",
    },
  });

  await ch.bindQueue(queue.queue, exchange, key);

  return [ch, queue];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => AckType,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  ch.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
    if (msg === null) {
      return;
    }

    try {
      const raw = msg.content.toString("utf8");

      if (raw === "") {
        throw new Error("Empty message body");
      }
      const data = JSON.parse(raw);

      const result = handler(data);

      switch (result) {
        case AckType.Ack:
          ch.ack(msg);
          console.log("Message acknowledged");
          break;
        case AckType.NackRequeue:
          ch.nack(msg, false, true);
          console.log("Message nacked and requeued");
          break;
        case AckType.NackDiscard:
          ch.nack(msg, false, false);
          console.log("Message nacked and discarded");
          break;
        default:
          console.error("Unknown AckType received");
      }
    } catch (err) {
      console.error("Invalid JSON message:", err);
      ch.nack(msg, false, false);
    }
  });
}
