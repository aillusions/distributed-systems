import amqp from 'amqplib';
import { config } from './config.js';

// Inferred from the lib so this isn't tied to the Connection/ChannelModel
// type rename across amqplib versions.
let connection: Awaited<ReturnType<typeof amqp.connect>>;
let channel: Awaited<ReturnType<typeof connection.createConfirmChannel>>;

// Confirm channel so each publish can await a real broker ack — gives
// meaningful latency and natural backpressure, comparable to Kafka's acked send.
export async function connectRabbit(): Promise<void> {
  connection = await amqp.connect(config.rabbitmq.url);
  channel = await connection.createConfirmChannel();
  await channel.assertQueue(config.rabbitmq.queue, { durable: false });
}

// One acked publish to the configured queue.
export function publishRabbit(payload: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.sendToQueue(config.rabbitmq.queue, payload, {}, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

export async function closeRabbit(): Promise<void> {
  await channel?.close();
  await connection?.close();
}
