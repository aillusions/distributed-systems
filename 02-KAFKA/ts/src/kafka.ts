import { Kafka, logLevel } from 'kafkajs';
import { config } from './config.js';

export const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  // Quiet the per-connection chatter; drills log what matters themselves.
  logLevel: logLevel.NOTHING,
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
