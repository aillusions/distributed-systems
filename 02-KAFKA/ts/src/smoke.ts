// Scaffold smoke test: create a replicated topic, produce a handful of records
// with acks=all, consume them back, and confirm nothing was lost. Proves the
// cluster, the host listeners, and the KafkaJS client all line up before any
// drill builds on them.
import { kafka, sleep } from './kafka.js';

const TOPIC = 'smoke';
const COUNT = 10;

async function main(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  // createTopics returns false (no throw) if the topic already exists. We skip
  // waitForLeaders — right after creation in KRaft the broker we query can
  // briefly return UNKNOWN_TOPIC_OR_PARTITION before metadata propagates — and
  // poll metadata ourselves until every partition has a leader.
  await admin.createTopics({
    topics: [{ topic: TOPIC, numPartitions: 3, replicationFactor: 3 }],
  });
  for (let tries = 0; ; tries++) {
    const [md] = (await admin.fetchTopicMetadata({ topics: [TOPIC] })).topics;
    if (md && md.partitions.every((p) => p.leader >= 0)) break;
    if (tries > 50) throw new Error(`topic "${TOPIC}" never got leaders`);
    await sleep(200);
  }
  console.log(`topic "${TOPIC}" ready (3 partitions, RF=3)`);
  await admin.disconnect();

  const producer = kafka.producer({ allowAutoTopicCreation: false });
  await producer.connect();
  for (let i = 0; i < COUNT; i++) {
    await producer.send({
      topic: TOPIC,
      acks: -1, // -1 = all in-sync replicas must ack
      messages: [{ key: `k${i % 3}`, value: `msg-${i}` }],
    });
  }
  console.log(`produced ${COUNT} records (acks=all)`);
  await producer.disconnect();

  const received: string[] = [];
  const consumer = kafka.consumer({ groupId: 'smoke-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      received.push(message.value!.toString());
    },
  });

  // Give the consumer a moment to drain, then report.
  while (received.length < COUNT) await sleep(200);
  await consumer.disconnect();

  console.log(`consumed ${received.length}/${COUNT} records`);
  console.log(received.length === COUNT ? 'smoke: OK' : 'smoke: MISSING RECORDS');
  process.exitCode = received.length === COUNT ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
