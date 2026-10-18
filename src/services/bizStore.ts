// Business settings kept in PostgreSQL (through /api/kv).
// Same methods as localStorage so old code keeps working.
const mem = new Map<string, string>();
const timers = new Map<string, any>();

function push(key: string, value: string) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => {
    fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    }).catch(() => {});
  }, 300));
}

export const bizStore = {
  getItem(key: string): string | null {
    return mem.has(key) ? mem.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    mem.set(key, value);
    push(key, value);
  },
  removeItem(key: string): void {
    mem.delete(key);
    fetch(`/api/kv/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {});
  },
  async hydrate(): Promise<void> {
    const res = await fetch('/api/kv');
    if (!res.ok) throw new Error('Could not load settings');
    const data = await res.json();
    mem.clear();
    Object.entries(data || {}).forEach(([k, v]) => mem.set(k, String(v)));
  },
  clear(): void {
    mem.clear();
  }
};
