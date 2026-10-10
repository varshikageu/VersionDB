// Tiny in-process Prometheus-style metrics (no dependency). Exposed on GET /metrics.
const BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class Metrics {
  private counters = new Map<string, number>();
  private hist = new Map<string, { buckets: number[]; sum: number; count: number }>();
  private startedAt = Date.now();

  private key(name: string, labels: Record<string, string>): string {
    const l = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${v.replace(/["\\\n]/g, '_')}"`).join(',');
    return l ? `${name}{${l}}` : name;
  }
  inc(name: string, labels: Record<string, string> = {}, by = 1): void {
    const k = this.key(name, labels);
    this.counters.set(k, (this.counters.get(k) ?? 0) + by);
  }
  observe(name: string, labels: Record<string, string>, seconds: number): void {
    const k = this.key(name, labels);
    const h = this.hist.get(k) ?? { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 };
    BUCKETS.forEach((b, i) => { if (seconds <= b) h.buckets[i]! += 1; });
    h.sum += seconds;
    h.count += 1;
    this.hist.set(k, h);
  }
  render(): string {
    const out: string[] = [`versiondb_uptime_seconds ${Math.round((Date.now() - this.startedAt) / 1000)}`];
    for (const [k, v] of this.counters) out.push(`${k} ${v}`);
    for (const [k, h] of this.hist) {
      const brace = k.indexOf('{');
      const name = brace === -1 ? k : k.slice(0, brace);
      const labels = brace === -1 ? '' : k.slice(brace + 1, -1);
      BUCKETS.forEach((b, i) => out.push(`${name}_bucket{${labels}${labels ? ',' : ''}le="${b}"} ${h.buckets[i]}`));
      out.push(`${name}_bucket{${labels}${labels ? ',' : ''}le="+Inf"} ${h.count}`);
      out.push(`${name}_sum${labels ? `{${labels}}` : ''} ${h.sum}`);
      out.push(`${name}_count${labels ? `{${labels}}` : ''} ${h.count}`);
    }
    return out.join('\n') + '\n';
  }
}

export const metrics = new Metrics();
