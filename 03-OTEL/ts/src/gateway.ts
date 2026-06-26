import './telemetry'; // MUST be first

import express from 'express';
import { trace } from '@opentelemetry/api';
import { config } from './config';
import { log } from './logger';

const tracer = trace.getTracer('gateway');

const app = express();
app.use(express.json());

// Public entrypoint. Does a bit of its own work (a manual "validate-cart"
// span), then calls the backend over HTTP. The fetch is auto-instrumented, so
// the W3C traceparent header is propagated and the backend's spans land in the
// SAME trace — one tree spanning both services.
app.post('/checkout', async (req, res) => {
  await tracer.startActiveSpan('validate-cart', async (span) => {
    const { sku, qty } = req.body ?? {};
    span.setAttribute('sku', String(sku));
    span.end();
  });

  try {
    const r = await fetch(`${config.backend.url}/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
    });
    const body = await r.json();
    log.info({ status: r.status }, 'checkout forwarded');
    res.status(r.status).json(body);
  } catch (err) {
    const msg = (err as Error).message;
    log.error({ err: msg }, 'backend unreachable');
    res.status(502).json({ status: 'error', error: msg });
  }
});

app.listen(config.gateway.port, () =>
  log.info(`gateway listening on :${config.gateway.port}`),
);
