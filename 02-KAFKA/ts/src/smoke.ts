// Scaffold smoke test: create a replicated topic, produce a handful of records
// with acks=all, consume them back, and confirm nothing was lost. Proves the
// cluster, the host listeners, and the KafkaJS client all line up before any
// drill builds on them.
//
// It also demonstrates consumer-side retries + a dead-letter queue. Kafka has
// no built-in consumer retry, so we roll our own: the main consumer forwards a
// failed message to a separate retry topic; a retry consumer reprocesses it
// with backoff, and once it has been retried MAX_RETRIES times it lands in a
// DLQ topic to be investigated later. Retries live on their own topics so a
// poison message never blocks the main consumer.
import { kafka, sleep } from './kafka.js';

const TOPIC = 'smoke';
const RETRY_TOPIC = 'smoke.retry';
const DLQ_TOPIC = 'smoke.dlq';
const COUNT = 10;
const MAX_RETRIES = 3;

// Stand-in for real processing. Two records misbehave so we exercise both
// paths: 'msg-3' is poison (never succeeds → ends in the DLQ); 'msg-7' is
// flaky (fails until its 2nd retry, then succeeds).
function handle(value: string, attempt: number): void {
  if (value === 'msg-3') throw new Error('poison: always fails');
  if (value === 'msg-7' && attempt < 2) throw new Error('transient failure');
}

async function main(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  const topics = [TOPIC, RETRY_TOPIC, DLQ_TOPIC];
  // Start from a clean slate so the run is repeatable: drop our topics (and the
  // committed offsets that go with them) and recreate. Deletion is async in
  // KRaft, so poll listTopics until they're really gone before recreating.
  const existing = (await admin.listTopics()).filter((t) => topics.includes(t));
  if (existing.length) await admin.deleteTopics({ topics: existing });
  for (let tries = 0; tries <= 50; tries++) {
    if (!(await admin.listTopics()).some((t) => topics.includes(t))) break;
    if (tries === 50) throw new Error('old topics never finished deleting');
    await sleep(200);
  }
  // We skip waitForLeaders — right after creation in KRaft the broker we query
  // can briefly return UNKNOWN_TOPIC_OR_PARTITION before metadata propagates —
  // and poll metadata ourselves until every partition has a leader.
  await admin.createTopics({
    topics: topics.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 3 })),
  });
  for (let tries = 0; ; tries++) {
    const md = (await admin.fetchTopicMetadata({ topics })).topics;
    const ready = md.length === topics.length &&
      md.every((t) => t.partitions.every((p) => p.leader >= 0));
    if (ready) break;
    if (tries > 50) throw new Error('topics never got leaders');
    await sleep(200);
  }
  console.log(`topics ready: ${topics.join(', ')} (3 partitions, RF=3)`);
  await admin.disconnect();

  const producer = kafka.producer({
    allowAutoTopicCreation: false,
    idempotent: true, // exactly-once-per-partition appends; forces acks=all
    retry: {
      retries: 5,
      initialRetryTime: 100,
    },
  });
  await producer.connect();
  for (let i = 0; i < COUNT; i++) {
    await producer.send({
      topic: TOPIC,
      acks: -1, // -1 = all in-sync replicas must ack
      messages: [{ key: `k${i % 3}`, value: `msg-${i}` }],
    });
  }
  console.log(`produced ${COUNT} records (acks=all)`);

  let succeeded = 0;
  let deadLettered = 0;

  // Forward a record onto another topic, carrying the attempt count in a header.
  const forward = (topic: string, key: Buffer | null, value: Buffer | null, attempt: number) =>
    producer.send({
      topic,
      acks: -1,
      messages: [{ key, value, headers: { attempts: String(attempt) } }],
    });

  // Main consumer: process or hand off to the retry topic on failure.
  const mainConsumer = kafka.consumer({ groupId: 'smoke-main' });
  await mainConsumer.connect();
  await mainConsumer.subscribe({ topic: TOPIC, fromBeginning: true });
  await mainConsumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value!.toString();
      try {
        handle(value, 0);
        succeeded++;
      } catch (err) {
        console.log(`  main: "${value}" failed (${(err as Error).message}) → retry`);
        await forward(RETRY_TOPIC, message.key, message.value, 1);
      }
    },
  });

  // Retry consumer: backoff, reprocess, and either recover, retry again, or DLQ.
  const retryConsumer = kafka.consumer({ groupId: 'smoke-retry' });
  await retryConsumer.connect();
  await retryConsumer.subscribe({ topic: RETRY_TOPIC, fromBeginning: true });
  await retryConsumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value!.toString();
      const attempt = Number(message.headers?.attempts?.toString() ?? '1');
      await sleep(100 * attempt); // simple linear backoff
      try {
        handle(value, attempt);
        console.log(`  retry: "${value}" recovered on attempt ${attempt}`);
        succeeded++;
      } catch {
        if (attempt >= MAX_RETRIES) {
          console.log(`  retry: "${value}" exhausted ${attempt} attempts → DLQ`);
          await forward(DLQ_TOPIC, message.key, message.value, attempt);
        } else {
          await forward(RETRY_TOPIC, message.key, message.value, attempt + 1);
        }
      }
    },
  });

  // DLQ consumer: just records dead letters so they can be inspected later.
  const dlqConsumer = kafka.consumer({ groupId: 'smoke-dlq' });
  await dlqConsumer.connect();
  await dlqConsumer.subscribe({ topic: DLQ_TOPIC, fromBeginning: true });
  await dlqConsumer.run({
    eachMessage: async ({ message }) => {
      console.log(`  DLQ: "${message.value!.toString()}" parked for investigation`);
      deadLettered++;
    },
  });

  // Every record ends up either succeeded or dead-lettered.
  for (let tries = 0; succeeded + deadLettered < COUNT; tries++) {
    if (tries > 100) break;
    await sleep(200);
  }
  await Promise.all([
    mainConsumer.disconnect(),
    retryConsumer.disconnect(),
    dlqConsumer.disconnect(),
    producer.disconnect(),
  ]);

  const accounted = succeeded + deadLettered;
  console.log(`processed ${succeeded}, dead-lettered ${deadLettered} (${accounted}/${COUNT} accounted)`);
  console.log(accounted === COUNT ? 'smoke: OK' : 'smoke: RECORDS UNACCOUNTED');
  process.exitCode = accounted === COUNT ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
