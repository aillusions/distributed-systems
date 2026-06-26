# otel-lab-ts

Two-service demo emitting all three OTEL signals. See [../README.md](../README.md)
for the full picture and Grafana walkthrough.

```bash
pnpm install
pnpm start:backend   # :3002
pnpm start:gateway   # :3001
pnpm load            # drives traffic through the gateway
pnpm typecheck
```

| File | Role |
| --- | --- |
| `telemetry.ts` | OTEL SDK bootstrap (traces + metrics + logs). Imported first everywhere. |
| `gateway.ts` | Public HTTP entrypoint; forwards to the backend (context propagates). |
| `backend.ts` | Does the work: redis + pg, manual spans, custom histogram with exemplars. |
| `client.ts` | Load driver; each request is the root of a trace. |
| `logger.ts` | pino; auto-correlated to traces and shipped to Loki. |
| `db.ts` | pg pool + redis client + schema/stock seed. |
