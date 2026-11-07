/** Client for the Python AI service. Returns null (never throws) when it is offline. */
const BASE = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
let downSince = 0;

export async function mlPost<T>(path: string, body: unknown, timeoutMs = 5000, skipIfDown = true): Promise<T | null> {
  if (skipIfDown && Date.now() - downSince < 20_000) return null;
  try {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`ML ${res.status}`);
    downSince = 0;
    return (await res.json()) as T;
  } catch {
    downSince = Date.now();
    return null;
  }
}
