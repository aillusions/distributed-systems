import { Kafka, type Producer } from 'kafkajs';
import { config } from './config.js';

const kafka = new Kafka({ clientId: 'numbers-lab', brokers: config.kafka.brokers });

export const producer: Producer = kafka.producer({ allowAutoTopicCreation: true });

export async function connectKafka(): Promise<void> {
  await producer.connect();
  // Create the topic with a fixed partition count so kafka and redpanda match
  // (redpanda auto-creates with 1). createTopics is a no-op if it exists.
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: config.kafka.topic, numPartitions: config.kafka.partitions }],
  });
  await admin.disconnect();
}

export async function closeKafka(): Promise<void> {
  await producer.disconnect();
}
