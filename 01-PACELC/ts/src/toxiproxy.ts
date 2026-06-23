import { config } from './config.js';

const base = `${config.toxiproxy.url}/proxies/${config.toxiproxy.proxy}`;

// Toggle the replication-link proxy via the Toxiproxy admin API. Disabling it
// drops the live walsender connection and refuses new ones => primary and
// replica can no longer talk. This is our network partition.
export async function setEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error(`toxiproxy ${res.status}: ${await res.text()}`);
  }
}

// Remove every toxic on the proxy, leaving a clean pass-through link.
export async function clearToxics(): Promise<void> {
  const res = await fetch(`${base}/toxics`);
  if (!res.ok) return;
  const toxics = (await res.json()) as Array<{ name: string }>;
  await Promise.all(toxics.map((t) => fetch(`${base}/toxics/${t.name}`, { method: 'DELETE' })));
}

// Add a fixed latency (ms) in each direction, modelling a realistic, non-zero
// replication path instead of localhost's sub-ms link. Idempotent: clears any
// existing toxics first. Toxics live on the proxy, so they survive enable/disable.
export async function setLatency(ms: number): Promise<void> {
  await clearToxics();
  for (const stream of ['downstream', 'upstream'] as const) {
    const res = await fetch(`${base}/toxics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `lat_${stream}`, type: 'latency', stream, attributes: { latency: ms } }),
    });
    if (!res.ok) {
      throw new Error(`toxiproxy ${res.status}: ${await res.text()}`);
    }
  }
}
