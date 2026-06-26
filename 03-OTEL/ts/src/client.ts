import './telemetry'; // MUST be first — the client is the root of each trace

import { config } from './config';
import { SKUS } from './db';
import { log } from './logger';

// Drives traffic through the gateway. Each request's fetch starts a root span,
// so a full trace runs client → gateway → backend → pg/redis. Runs until killed.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(): Promise<void> {
  const sku = SKUS[Math.floor(Math.random() * SKUS.length)];
  const qty = 1 + Math.floor(Math.random() * 3);
  try {
    const r = await fetch(`${config.gateway.url}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku, qty }),
    });
    log.info({ sku, qty, status: r.status }, 'checkout sent');
  } catch (err) {
    log.error({ err: (err as Error).message }, 'request failed');
  }
}

async function worker(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await once();
    await sleep(config.load.intervalMs);
  }
}

log.info(
  `driving ${config.load.concurrency} workers at the gateway (${config.gateway.url})`,
);
Array.from({ length: config.load.concurrency }, () => worker());
