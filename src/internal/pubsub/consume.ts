import amqp from "amqplib";
import type { Channel } from "amqplib";
import { decode } from "@msgpack/msgpack";

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
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  await subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer): T => {
      const raw = data.toString("utf8");

      if (raw === "") {
        throw new Error("Empty message body");
      }
      return JSON.parse(raw);
    },
  );
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  await subscribe(
    conn,
    exchange,
    queueName,
    key,
    queueType,
    handler,
    (data: Buffer): T => {
      return decode(data) as T;
    },
  );
}

async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  simpleQueueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    simpleQueueType,
  );
  await ch.prefetch(10);
  await ch.consume(queue.queue, async (msg: amqp.ConsumeMessage | null) => {
    if (!msg) return;

    try {
      if (!msg.content || msg.content.length === 0) {
        throw new Error("Empty message body");
      }
      const data = unmarshaller(msg.content);

      const result = await handler(data);

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
      console.error("Invalid message:", err);
      ch.nack(msg, false, false);
    }
  });
}
