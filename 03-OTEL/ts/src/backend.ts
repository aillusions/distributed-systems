import './telemetry'; // MUST be first — starts the SDK before express/pg/redis load

import express from 'express';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { pool, redis, initSchema } from './db';
import { config } from './config';
import { log } from './logger';

const tracer = trace.getTracer('backend');
const meter = metrics.getMeter('backend');

// Custom histogram. Recorded inside the request's active span, so with the
// trace_based exemplar filter each sample carries a trace_id → the "Checkout
// latency" panel's exemplar dots link straight to the trace.
const checkoutMs = meter.createHistogram('checkout_duration_ms', {
  description: 'End-to-end backend processing time per checkout',
  unit: 'ms',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const app = express();
app.use(express.json());

// The work: reserve stock in redis, persist the order in pg. Each step is a
// manual child span so the trace tells the story; ~10% fail, ~10% run slow.
app.post('/process', async (req, res) => {
  const start = performance.now();
  const { sku = 'sku-0', qty = 1 } = req.body ?? {};
  let outcome = 'ok';

  try {
    await tracer.startActiveSpan('reserve-inventory', async (span) => {
      span.setAttribute('sku', sku);
      const left = await redis.decrby(`stock:${sku}`, qty);
      if (left < 0) {
        await redis.incrby(`stock:${sku}`, qty); // roll back the oversell
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'out of stock' });
        span.end();
        throw new Error('out of stock');
      }
      span.end();
    });

    if (Math.random() < 0.1) {
      // Inject tail latency so the latency panels and slow traces are visible.
      await tracer.startActiveSpan('slow-fraud-check', async (span) => {
        await sleep(400 + Math.floor(Math.random() * 600));
        span.end();
      });
      outcome = 'slow';
    }

    if (Math.random() < 0.1) throw new Error('payment declined');

    await tracer.startActiveSpan('persist-order', async (span) => {
      const r = await pool.query(
        'INSERT INTO orders (sku, qty) VALUES ($1, $2) RETURNING id',
        [sku, qty],
      );
      span.setAttribute('order.id', r.rows[0].id);
      span.end();
    });

    log.info({ sku, qty, outcome }, 'order processed');
    res.json({ status: 'ok', sku, qty });
  } catch (err) {
    outcome = 'error';
    const msg = (err as Error).message;
    // Mark the active server span errored so it's red in Tempo + counts toward
    // the spanmetrics error rate.
    trace.getActiveSpan()?.recordException(err as Error);
    trace.getActiveSpan()?.setStatus({ code: SpanStatusCode.ERROR, message: msg });
    log.error({ sku, qty, err: msg }, 'order failed');
    res.status(500).json({ status: 'error', error: msg });
  } finally {
    checkoutMs.record(performance.now() - start, { route: '/process', outcome });
  }
});

initSchema()
  .then(() => {
    app.listen(config.backend.port, () =>
      log.info(`backend listening on :${config.backend.port}`),
    );
  })
  .catch((err) => {
    log.error({ err: (err as Error).message }, 'backend failed to start');
    process.exit(1);
  });
