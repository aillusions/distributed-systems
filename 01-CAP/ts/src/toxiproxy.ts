import { config } from './config.js';

// Toggle the replication-link proxy via the Toxiproxy admin API. Disabling it
// drops the live walsender connection and refuses new ones => primary and
// replica can no longer talk. This is our network partition.
async function setEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(`${config.toxiproxy.url}/proxies/${config.toxiproxy.proxy}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error(`toxiproxy ${res.status}: ${await res.text()}`);
  }
}

export const cut = () => setEnabled(false);
export const heal = () => setEnabled(true);
