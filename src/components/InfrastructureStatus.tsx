import { useEffect, useState } from 'react';

type Readiness =
  | { status: 'checking' }
  | { status: 'unconfigured' }
  | { status: 'ready'; version: string }
  | { status: 'unavailable' };

export function InfrastructureStatus() {
  const [readiness, setReadiness] = useState<Readiness>({ status: 'checking' });

  useEffect(() => {
    const base = import.meta.env.VITE_CONTROL_PLANE_URL?.trim();
    if (!base) {
      setReadiness({ status: 'unconfigured' });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    fetch(`${base.replace(/\/+$/, '')}/readyz`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('not_ready');
        const body = await response.json();
        if (body?.status !== 'ready' || body?.database?.connected !== true) {
          throw new Error('not_ready');
        }
        setReadiness({ status: 'ready', version: String(body.database.version || 'PostgreSQL') });
      })
      .catch(() => setReadiness({ status: 'unavailable' }))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const label =
    readiness.status === 'ready'
      ? `POSTGRESQL CONNECTED · ${readiness.version}`
      : readiness.status === 'checking'
        ? 'CHECKING CONTROL PLANE…'
        : readiness.status === 'unavailable'
          ? 'CONTROL PLANE UNAVAILABLE · SAMPLE DATA ONLY'
          : 'CONTROL PLANE NOT CONFIGURED · SAMPLE DATA ONLY';

  const tone =
    readiness.status === 'ready'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : 'border-amber-500/40 text-amber-700 dark:text-amber-300';

  return (
    <div className={`mx-4 sm:mx-6 lg:mx-8 mt-4 border px-4 py-3 text-[11px] font-mono tracking-wide ${tone}`} role="status" aria-live="polite">
      <div className="font-semibold">{label}</div>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Metrics, replicas, backups and performance charts currently contain demo/sample values; they are not live infrastructure telemetry.
      </p>
    </div>
  );
}
