import amqp from "amqplib";
import type { Channel } from "amqplib";

export type SimpleQueueType = "durable" | "transient";

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const ch = await conn.createChannel();
  const queue = await ch.assertQueue(queueName, {
    durable: queueType === "durable",
    autoDelete: queueType === "transient",
    exclusive: queueType === "transient",
  });

  await ch.bindQueue(queue.queue, exchange, key);

  return [ch, queue];
}
