import React, { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { ClusterConfig, Language } from '../types/infra';
import { Translations } from '../i18n/translations';
import { generateInfraFiles } from '../utils/configGenerators';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  lang: Language;
  config: ClusterConfig;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  t,
  lang,
  config,
}) => {
  const files = useMemo(() => generateInfraFiles(config), [config]);

  if (!open) return null;

  const handleDownloadInstaller = () => {
    const sections = files
      .map((f) => {
        const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '.';
        return `mkdir -p "${dir}"\ncat <<'__OCODEJS_EOF__' > "${f.path}"\n${f.content}\n__OCODEJS_EOF__`;
      })
      .join('\n\n');

    const script = `#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping ${config.brandName} distributed PostgreSQL + Redis + Prometheus + Grafana stack..."
${sections}

chmod +x scripts/setup-tls.sh scripts/s3-backup.sh
./scripts/setup-tls.sh
echo "Done. Copy .env secrets and run: docker compose up -d"
`;

    const blob = new Blob([script], { type: 'text/x-shellscript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bootstrap-${config.brandName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 id="export-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {t.exportModal.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.actions.close}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {t.exportModal.subtitle}
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.exportModal.includedFiles} ({files.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {files.map((f) => (
                <div key={f.id} className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                  {f.path}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.exportModal.commandTitle}
            </p>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto">
              <code>{`chmod +x bootstrap-${config.brandName.toLowerCase()}.sh && ./bootstrap-${config.brandName.toLowerCase()}.sh\ndocker compose up -d`}</code>
            </pre>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.actions.close}
          </button>
          <button
            type="button"
            onClick={handleDownloadInstaller}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>
              {lang === 'vi' ? t.actions.downloadInstaller : t.actions.downloadInstaller}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
