import React, { useState } from 'react';
import { CheckCircle2, Database, Layers, Zap } from 'lucide-react';
import { Language, SqlOptimizationCase } from '../types/infra';
import { Translations } from '../i18n/translations';

interface SqlRedisOptimizerProps {
  t: Translations;
  lang: Language;
  cases: SqlOptimizationCase[];
  onToggleApply: (id: string) => void;
}

export const SqlRedisOptimizer: React.FC<SqlRedisOptimizerProps> = ({
  t,
  lang,
  cases,
  onToggleApply,
}) => {
  const [selectedId, setSelectedId] = useState<string>(cases[0]?.id || 'opt-1');
  const activeCase = cases.find((c) => c.id === selectedId) || cases[0];

  const reductionPct = Math.round(
    ((activeCase.beforeLatencyMs - activeCase.afterLatencyMs) / activeCase.beforeLatencyMs) * 100,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          {t.optimization.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t.optimization.subtitle}
        </p>
      </div>

      {/* Case Selector + Interactive Optimizer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.optimization.labTitle}
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {cases.map((item) => {
              const selected = item.id === activeCase.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                    selected
                      ? 'bg-teal-50/70 dark:bg-teal-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {item.table} · {item.frequencyPerMin}/min
                    </span>
                    {item.applied && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.actions.applied}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'vi' ? item.titleVi : item.titleEn}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {item.beforeLatencyMs}ms → {item.afterLatencyMs}ms
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? activeCase.titleVi : activeCase.titleEn}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span>
                  {t.optimization.beforeLabel}: <strong className="text-rose-600 dark:text-rose-400">{activeCase.beforeLatencyMs}ms</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.optimization.afterLabel}: <strong className="text-emerald-600 dark:text-emerald-400">{activeCase.afterLatencyMs}ms</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.optimization.reductionLabel}: <strong className="text-teal-600 dark:text-teal-400">-{reductionPct}%</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggleApply(activeCase.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeCase.applied
                  ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{activeCase.applied ? t.actions.revert : t.actions.apply}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.optimization.slowSqlLabel}
              </p>
              <pre className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                <code>{activeCase.slowSql}</code>
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.optimization.optimizedSqlLabel}
              </p>
              <pre className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                <code>{activeCase.optimizedSql}</code>
              </pre>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.optimization.indexDdlLabel}
            </p>
            <pre className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-teal-800 dark:text-teal-300 overflow-x-auto">
              <code>{activeCase.indexDdl}</code>
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.optimization.explainPlanLabel}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <pre className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                <code>{activeCase.explainBefore.join('\n')}</code>
              </pre>
              <pre className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                <code>{activeCase.explainAfter.join('\n')}</code>
              </pre>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              {t.optimization.redisPatternLabel}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {lang === 'vi' ? activeCase.redisStrategyVi : activeCase.redisStrategyEn}
            </p>
          </div>
        </div>
      </div>

      {/* Playbook Cards: PostgreSQL Tuning & Redis Docker Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.optimization.pgTuningGuideTitle}
            </h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed list-disc pl-4">
            <li>
              <strong className="text-slate-900 dark:text-slate-200">EXPLAIN (ANALYZE, BUFFERS):</strong>{' '}
              {lang === 'vi'
                ? 'Luôn kiểm tra Seq Scan trên bảng lớn (>10k dòng), Sort tràn đĩa (external merge) và số lần Heap Fetches trên Index Only Scan.'
                : 'Inspect large table Seq Scans, disk-spilling external Sort operations, and Heap Fetches on Index Only Scans.'}
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-200">Partial & Covering Indexes (INCLUDE):</strong>{' '}
              {lang === 'vi'
                ? 'Tạo chỉ mục có điều kiện WHERE deleted_at IS NULL và dùng CREATE INDEX CONCURRENTLY để không khóa bảng khi chạy sản xuất.'
                : 'Use partial indexes (WHERE deleted_at IS NULL) and CREATE INDEX CONCURRENTLY to avoid table write locks.'}
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-200">Keyset Pagination & PgBouncer:</strong>{' '}
              {lang === 'vi'
                ? 'Thay OFFSET lớn bằng cursor (created_at < $2) và đặt PgBouncer ở chế độ transaction để giữ kết nối PostgreSQL luôn gọn nhẹ.'
                : 'Replace deep OFFSET clauses with keyset cursors and run PgBouncer in transaction pooling mode.'}
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.optimization.redisGuideTitle}
            </h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed list-disc pl-4">
            <li>
              <strong className="text-slate-900 dark:text-slate-200">Redis 7 TLS + AOF trong Docker:</strong>{' '}
              {lang === 'vi'
                ? 'Tắt cổng không mã hóa (--port 0), chỉ mở --tls-port 6379, đặt --maxmemory-policy allkeys-lru và bật --appendonly yes.'
                : 'Disable plaintext port (--port 0), serve exclusively over --tls-port 6379 with allkeys-lru and AOF persistence.'}
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-200">Cache-Aside + TTL Jitter:</strong>{' '}
              {lang === 'vi'
                ? 'Dùng hàm getCachedOrQuery() trong src/cache/redisCache.ts kèm dao động TTL ±10% để tránh hiệu ứng Cache Stampede đồng loạt hết hạn.'
                : 'Use getCachedOrQuery() in src/cache/redisCache.ts with ±10% TTL jitter to prevent thundering-herd cache stampedes.'}
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-200">Invalidation theo sự kiện ghi:</strong>{' '}
              {lang === 'vi'
                ? 'Khi Node.js ghi dữ liệu mới vào PostgreSQL Primary, xóa hoặc cập nhật ngay key Redis tương ứng để đảm bảo dữ liệu nhất quán.'
                : 'Invalidate or update targeted Redis keys immediately after primary PostgreSQL writes commit.'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
