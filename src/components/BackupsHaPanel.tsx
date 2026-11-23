import React from 'react';
import {
  CheckCircle2,
  CloudUpload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { BackupSnapshot, ClusterConfig, Language } from '../types/infra';
import { Translations } from '../i18n/translations';

interface BackupsHaPanelProps {
  t: Translations;
  lang: Language;
  config: ClusterConfig;
  failoverActive: boolean;
  onToggleFailover: () => void;
  snapshots: BackupSnapshot[];
  onRunBackup: () => void;
  onVerifySnapshot: (id: string) => void;
}

export const BackupsHaPanel: React.FC<BackupsHaPanelProps> = ({
  t,
  lang,
  config,
  failoverActive,
  onToggleFailover,
  snapshots,
  onRunBackup,
  onVerifySnapshot,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          {t.backups.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t.backups.subtitle}
        </p>
      </div>

      {/* HA Failover Simulator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.backups.haTitle}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              {t.backups.haDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleFailover}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              failoverActive
                ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>
              {failoverActive ? t.actions.restorePrimary : t.actions.triggerFailover}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'vi' ? 'Node Primary hiện tại' : 'Active Primary Node'}
            </p>
            <p className="mt-1 text-sm font-mono font-semibold text-slate-900 dark:text-white">
              {failoverActive ? 'ocodejs-pg-replica-02 (Promoted)' : 'ocodejs-pg-primary-01'}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium">
              {failoverActive ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đang chạy trên Standby' : 'Running on Promoted Standby'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Đồng bộ WAL trực tiếp' : 'Synchronous WAL Commit'}</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.backups.rpoLabel}</p>
            <p className="mt-1 text-xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
              0 bytes
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              synchronous_commit = remote_apply
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.backups.rtoLabel}</p>
            <p className="mt-1 text-xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
              3.8 sec
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              PgBouncer auto-drain + DNS switch
            </p>
          </div>
        </div>
      </div>

      {/* AWS S3 Backup Vault */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.backups.s3Title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.backups.s3Desc}
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
              s3://{config.s3Bucket} · {config.s3Region} · Cron: {config.backupCron} · {config.retentionDays}d
            </p>
          </div>

          <button
            type="button"
            onClick={onRunBackup}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <CloudUpload className="w-4 h-4" />
            <span>{t.actions.runBackupNow}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">{t.backups.colSnapshotId}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.backups.colTime}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.backups.colType}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">{t.backups.colSize}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.backups.colEncryption}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.backups.colStatus}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {snapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {snap.id}
                    <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {snap.s3Path}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {snap.createdAt}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {snap.type} ({snap.durationSec}s)
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {snap.sizeGb.toFixed(1)} GB
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {snap.encryption}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {snap.verified ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t.backups.verifiedLabel}</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        {t.backups.unverifiedLabel}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onVerifySnapshot(snap.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t.actions.verifyChecksum}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
