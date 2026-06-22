import { Kafka, type Producer } from 'kafkajs';
import { config } from './config.js';

// Redpanda speaks the Kafka protocol, so it's the same kafkajs client pointed
// at a different broker — kept separate so it shows as its own metric series.
const redpanda = new Kafka({ clientId: 'numbers-lab', brokers: config.redpanda.brokers });

export const redpandaProducer: Producer = redpanda.producer({ allowAutoTopicCreation: true });

export async function connectRedpanda(): Promise<void> {
  await redpandaProducer.connect();
  // Match kafka's partition count for a fair comparison (redpanda defaults to 1).
  const admin = redpanda.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: config.redpanda.topic, numPartitions: config.redpanda.partitions }],
  });
  await admin.disconnect();
}

export async function closeRedpanda(): Promise<void> {
  await redpandaProducer.disconnect();
}
