import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ClusterConfig,
  ClusterNode,
  Language,
  PeriodicReport,
  SlackAlertEvent,
  TelemetryPoint,
} from '../types/infra';
import { Translations } from '../i18n/translations';
import { TelemetryChart } from './TelemetryChart';

interface OverviewDashboardProps {
  t: Translations;
  lang: Language;
  config: ClusterConfig;
  nodes: ClusterNode[];
  telemetry: TelemetryPoint[];
  activeReplicas: number;
  trafficSurge: boolean;
  onToggleSurge: () => void;
  slackAlerts: SlackAlertEvent[];
  reports: PeriodicReport[];
  onDownloadReport: (report: PeriodicReport) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  t,
  lang,
  config,
  nodes,
  telemetry,
  activeReplicas,
  trafficSurge,
  onToggleSurge,
  slackAlerts,
  reports,
  onDownloadReport,
}) => {
  const latest = telemetry[telemetry.length - 1];
  const timestamps = telemetry.map((p) => p.timestamp);

  const renderStatus = (status: ClusterNode['status']) => {
    if (status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t.statusLabels.healthy}</span>
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{t.statusLabels.degraded}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{t.statusLabels.offline}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            {t.overview.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            {t.overview.subtitle}
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
          PostgreSQL {config.pgVersion} · {config.tlsMode} · {config.s3Region}
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.overview.kpiQps}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {latest.qps.toLocaleString()} <span className="text-sm font-normal text-slate-500">req/s</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {latest.activeConnections} {lang === 'vi' ? 'kết nối PgBouncer' : 'pooled connections'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.overview.kpiLatency}
          </p>
          <p className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
            latest.p95LatencyMs > 50
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-white'
          }`}>
            {latest.p95LatencyMs.toFixed(1)} <span className="text-sm font-normal text-slate-500">ms</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Ngưỡng SLA cảnh báo Slack: 80ms' : 'Slack alert threshold: 80ms'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.overview.kpiCacheHit}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400">
            {latest.cacheHitRatio.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Redis 7.4 · {config.redisMaxMemory} · {config.redisEvictionPolicy}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.overview.kpiReplicas}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {activeReplicas} / {config.maxReplicas}{' '}
            <span className="text-sm font-normal text-slate-500">
              {lang === 'vi' ? 'container' : 'workers'}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            CPU {latest.cpuAvg}% · {lang === 'vi' ? 'Ngưỡng' : 'Target'} {config.targetCpuPercent}%
          </p>
        </div>
      </div>

      {/* Auto-scaling controller */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.overview.trafficTitle}
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t.overview.trafficSubtitle}
          </p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 pt-1">
            {t.overview.autoScaleLabel}{' '}
            <span className={trafficSurge ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-700 dark:text-emerald-400 font-semibold'}>
              {trafficSurge ? t.overview.autoScaleActive : t.overview.autoScaleNominal}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleSurge}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[42px] ${
            trafficSurge
              ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          <Zap className="w-4 h-4 shrink-0" />
          <span>{trafficSurge ? t.actions.normalizeTraffic : t.actions.simulateSurge}</span>
        </button>
      </div>

      {/* Real-time Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TelemetryChart
          title={t.overview.latencyChartTitle}
          timestamps={timestamps}
          primary={{
            label: 'QPS',
            color: '#0d9488',
            values: telemetry.map((p) => p.qps),
            unit: '',
          }}
          secondary={{
            label: 'P95',
            color: '#d97706',
            values: telemetry.map((p) => Number(p.p95LatencyMs.toFixed(1))),
            unit: 'ms',
          }}
        />
        <TelemetryChart
          title={t.overview.cacheChartTitle}
          timestamps={timestamps}
          primary={{
            label: 'Redis Hit',
            color: '#0284c7',
            values: telemetry.map((p) => Number(p.cacheHitRatio.toFixed(1))),
            unit: '%',
          }}
          secondary={{
            label: 'Conns',
            color: '#64748b',
            values: telemetry.map((p) => p.activeConnections),
            unit: '',
          }}
        />
      </div>

      {/* Cluster Nodes Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.overview.nodesTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.overview.nodesSubtitle}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">{t.overview.colNode}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.overview.colRole}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">{t.overview.colCpuMem}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">{t.overview.colStorage}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">{t.overview.colLag}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.overview.colTls}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.overview.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {node.name}
                    <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {node.region}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                    {node.role}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {node.cpuPercent}% / {node.memoryPercent}%
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {node.diskUsedGb} / {node.diskTotalGb} GB
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {node.replicationLagMs.toFixed(1)} ms
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {node.tlsStatus}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{renderStatus(node.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Periodic Performance Analysis Reports + Slack Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.overview.reportsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.overview.reportsSubtitle}
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((rep) => (
              <div key={rep.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {lang === 'vi' ? rep.periodVi : rep.periodEn}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                      Uptime {rep.uptimePercent}% · Avg {rep.avgQps} req/s · P95 {rep.p95LatencyMs}ms · S3 {rep.s3BackupSuccessRate}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownloadReport(rep)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'vi' ? rep.summaryVi : rep.summaryEn}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.overview.slackFeedTitle}
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {config.slackChannel}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {slackAlerts.slice(0, 5).map((evt) => (
              <div key={evt.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold font-mono ${
                    evt.severity === 'critical'
                      ? 'text-rose-600 dark:text-rose-400'
                      : evt.severity === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-teal-700 dark:text-teal-400'
                  }`}>
                    {evt.rule}
                  </span>
                  <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    {evt.time} UTC
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {lang === 'vi' ? evt.messageVi : evt.messageEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
