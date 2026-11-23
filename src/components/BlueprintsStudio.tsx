import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ShieldCheck, Activity } from 'lucide-react';
import { ClusterConfig, GeneratedFile, Language } from '../types/infra';
import { Translations } from '../i18n/translations';
import { generateInfraFiles } from '../utils/configGenerators';

interface BlueprintsStudioProps {
  t: Translations;
  lang: Language;
  config: ClusterConfig;
  onChangeConfig: (next: ClusterConfig) => void;
}

type CategoryFilter = 'all' | GeneratedFile['category'];

export const BlueprintsStudio: React.FC<BlueprintsStudioProps> = ({
  t,
  lang,
  config,
  onChangeConfig,
}) => {
  const files = useMemo(() => generateInfraFiles(config), [config]);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedFileId, setSelectedFileId] = useState<string>('docker-compose');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<'tls' | 'prometheus'>('tls');

  const filteredFiles =
    category === 'all' ? files : files.filter((f) => f.category === category);
  const activeFile =
    filteredFiles.find((f) => f.id === selectedFileId) || filteredFiles[0] || files[0];

  const handleCopy = async (file: GeneratedFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleDownloadFile = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() || 'config.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateField = <K extends keyof ClusterConfig>(key: K, value: ClusterConfig[K]) => {
    onChangeConfig({ ...config, [key]: value });
  };

  const categories: { id: CategoryFilter; labelVi: string; labelEn: string }[] = [
    { id: 'all', labelVi: 'Tất cả tệp', labelEn: 'All Files' },
    { id: 'docker', labelVi: 'Docker Compose', labelEn: 'Docker Compose' },
    { id: 'database', labelVi: 'PostgreSQL & TLS', labelEn: 'PostgreSQL & TLS' },
    { id: 'monitoring', labelVi: 'Prometheus & Grafana', labelEn: 'Prometheus & Grafana' },
    { id: 'cache', labelVi: 'Redis Cache', labelEn: 'Redis Cache' },
    { id: 'backup', labelVi: 'AWS S3 Backup', labelEn: 'AWS S3 Backup' },
    { id: 'cicd', labelVi: 'CI/CD', labelEn: 'CI/CD' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          {t.blueprints.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t.blueprints.subtitle}
        </p>
      </div>

      {/* Step-by-step Playbooks for TLS/SSL in Docker & Prometheus/Grafana */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {lang === 'vi'
              ? 'Hướng dẫn triển khai từng bước (Docker TLS & Prometheus + Grafana)'
              : 'Step-by-Step Deployment Playbooks (Docker TLS & Observability)'}
          </h2>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveGuide('tls')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeGuide === 'tls'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Cài đặt TLS/SSL & Node.js' : 'TLS/SSL & Node.js'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveGuide('prometheus')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeGuide === 'prometheus'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Prometheus & Grafana' : 'Prometheus & Grafana'}</span>
            </button>
          </div>
        </div>

        {activeGuide === 'tls' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '01. Tạo chứng chỉ CA & Server SSL' : '01. Generate CA & Server SSL'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Chạy script scripts/setup-tls.sh để tạo Root CA, server.crt (kèm SAN pg-primary, pg-replica, redis) và client.crt cho mTLS. Đặt quyền chmod 600 và chown 70:70 (UID postgres alpine) để PostgreSQL không từ chối đọc private key.'
                  : 'Run scripts/setup-tls.sh to generate Root CA, server.crt (with SAN for pg-primary, pg-replica, redis), and client.crt. Set chmod 600 and chown 70:70 for Alpine Postgres.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '02. Bật TLS 1.3 trên PostgreSQL Docker' : '02. Enable TLS 1.3 in PostgreSQL'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Mount thư mục ./certs vào /etc/postgresql/certs:ro. Bật ssl = on, ssl_min_protocol_version = TLSv1.3 trong postgresql.conf và dùng hostssl với scram-sha-256 trong pg_hba.conf để từ chối mọi kết nối không mã hóa.'
                  : 'Mount ./certs to /etc/postgresql/certs:ro. Enable ssl = on and TLSv1.3 in postgresql.conf, and enforce hostssl with scram-sha-256 in pg_hba.conf.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '03. Kết nối Node.js an toàn qua pg.Pool' : '03. Secure Node.js pg.Pool Client'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Sử dụng tệp src/db/pgTlsPool.ts với ssl: { rejectUnauthorized: true, ca, cert, key } trỏ qua PgBouncer cổng 6432. Kiểm tra kết nối bằng SELECT ssl_is_used(); trả về true.'
                  : 'Use src/db/pgTlsPool.ts with rejectUnauthorized: true and ca/cert/key buffers through PgBouncer on port 6432. Verify via SELECT ssl_is_used();.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '01. Thu thập Metrics từ Postgres & Node.js' : '01. Expose Postgres & Node.js Metrics'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Docker Compose chạy postgres-exporter (:9187) và redis-exporter (:9121) qua TLS. Trong ứng dụng Node.js ocodejs, gắn src/metrics/promMetrics.ts (prom-client) để mở endpoint GET /metrics trên cổng 3000.'
                  : 'Docker Compose runs postgres-exporter (:9187) and redis-exporter (:9121) over TLS. Mount src/metrics/promMetrics.ts in Node.js to expose GET /metrics.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '02. Cấu hình Scrape & Alertmanager Slack' : '02. Prometheus Scrape & Slack Rules'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Tệp monitoring/prometheus.yml quét mỗi 15 giây cả 3 job (postgres, redis, ocodejs-app). Nếu replication lag > 50ms hoặc P95 latency > 80ms, alert-rules.yml đẩy sự kiện tới Alertmanager để bắn tin nhắn Slack.'
                  : 'monitoring/prometheus.yml scrapes every 15s across postgres, redis, and ocodejs-app. Breaching 50ms lag or 80ms P95 latency routes directly to Slack via Alertmanager.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'vi' ? '03. Tự động nạp Dashboard trên Grafana' : '03. Auto-Provision Grafana Dashboards'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Grafana (cổng 3001) tự động nạp nguồn dữ liệu Prometheus qua monitoring/grafana-datasources.yml và hiển thị ngay 4 bảng: Kết nối hoạt động, Cache Hit Ratio, WAL Lag và Bộ nhớ Redis.'
                  : 'Grafana (:3001) auto-provisions Prometheus via monitoring/grafana-datasources.yml and mounts grafana-dashboard.json for instant live charts.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Blueprint Editor + Live File Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Parameter Form */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.blueprints.configPanelTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3.5 text-sm">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.blueprints.brandName}
              </span>
              <input
                type="text"
                value={config.brandName}
                onChange={(e) => updateField('brandName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.blueprints.repoSlug}
              </span>
              <input
                type="text"
                value={config.repoSlug}
                onChange={(e) => updateField('repoSlug', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.pgVersion}
                </span>
                <select
                  value={config.pgVersion}
                  onChange={(e) => updateField('pgVersion', e.target.value as '16' | '17')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="17">PostgreSQL 17</option>
                  <option value="16">PostgreSQL 16</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.tlsMode}
                </span>
                <select
                  value={config.tlsMode}
                  onChange={(e) =>
                    updateField('tlsMode', e.target.value as ClusterConfig['tlsMode'])
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="verify-full">verify-full (mTLS)</option>
                  <option value="verify-ca">verify-ca</option>
                  <option value="require">require</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.dbName}
                </span>
                <input
                  type="text"
                  value={config.dbName}
                  onChange={(e) => updateField('dbName', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.sharedBuffers}
                </span>
                <input
                  type="text"
                  value={config.sharedBuffers}
                  onChange={(e) => updateField('sharedBuffers', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.redisMaxMemory}
                </span>
                <input
                  type="text"
                  value={config.redisMaxMemory}
                  onChange={(e) => updateField('redisMaxMemory', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.redisEviction}
                </span>
                <select
                  value={config.redisEvictionPolicy}
                  onChange={(e) =>
                    updateField(
                      'redisEvictionPolicy',
                      e.target.value as ClusterConfig['redisEvictionPolicy'],
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="allkeys-lru">allkeys-lru</option>
                  <option value="allkeys-lfu">allkeys-lfu</option>
                  <option value="volatile-lru">volatile-lru</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.blueprints.s3Bucket}
              </span>
              <input
                type="text"
                value={config.s3Bucket}
                onChange={(e) => updateField('s3Bucket', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.backupCron}
                </span>
                <input
                  type="text"
                  value={config.backupCron}
                  onChange={(e) => updateField('backupCron', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.blueprints.slackChannel}
                </span>
                <input
                  type="text"
                  value={config.slackChannel}
                  onChange={(e) => updateField('slackChannel', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* File Explorer + Code Preview */}
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t.blueprints.filesTitle} ({filteredFiles.length})
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    const nextList =
                      cat.id === 'all' ? files : files.filter((f) => f.category === cat.id);
                    if (nextList.length > 0) setSelectedFileId(nextList[0].id);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    category === cat.id
                      ? 'bg-slate-900 text-white dark:bg-teal-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'vi' ? cat.labelVi : cat.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 max-h-[520px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFiles.map((file) => {
                const selected = file.id === activeFile.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selected
                        ? 'bg-teal-50/70 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <p className="font-mono text-xs font-semibold truncate">{file.path}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {lang === 'vi' ? file.descriptionVi : file.descriptionEn}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-8 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/40">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {activeFile.path}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {lang === 'vi' ? activeFile.descriptionVi : activeFile.descriptionEn}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(activeFile)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    {copiedId === activeFile.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.actions.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.actions.copy}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(activeFile)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-teal-600 text-white hover:bg-slate-800 dark:hover:bg-teal-700 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.actions.download}</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50/40 dark:bg-slate-950 overflow-x-auto max-h-[460px] overflow-y-auto">
                <code>{activeFile.content}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
