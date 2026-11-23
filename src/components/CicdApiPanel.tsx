import React, { useState } from 'react';
import { BellRing, CheckCircle2, Key, Play, Plus } from 'lucide-react';
import { ApiKeyItem, ClusterConfig, Language } from '../types/infra';
import { Translations } from '../i18n/translations';

interface CicdApiPanelProps {
  t: Translations;
  lang: Language;
  config: ClusterConfig;
  apiKeys: ApiKeyItem[];
  onCreateApiKey: (name: string, scope: ApiKeyItem['scope']) => void;
  onRevokeApiKey: (id: string) => void;
  onSendTestSlack: () => void;
  onOpenGitHubPlugin?: () => void;
}

export const CicdApiPanel: React.FC<CicdApiPanelProps> = ({
  t,
  lang,
  config,
  apiKeys,
  onCreateApiKey,
  onRevokeApiKey,
  onSendTestSlack,
  onOpenGitHubPlugin,
}) => {
  const [pipelineStep, setPipelineStep] = useState<number>(4);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyItem['scope']>('read:metrics');
  const [slackTestSent, setSlackTestSent] = useState(false);

  const stages = [
    { id: 0, name: 'Lint & SQL Migration Check', duration: '18s' },
    { id: 1, name: 'Docker Multi-Arch Build', duration: '42s' },
    { id: 2, name: 'Trivy CVE Scan', duration: '14s' },
    { id: 3, name: 'Zero-Downtime Rolling Deploy', duration: '26s' },
    { id: 4, name: 'Slack Release Notification', duration: '2s' },
  ];

  const handleRunPipeline = () => {
    if (runningPipeline) return;
    setRunningPipeline(true);
    setPipelineStep(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setPipelineStep(step);
      if (step >= 4) {
        clearInterval(timer);
        setRunningPipeline(false);
      }
    }, 450);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    onCreateApiKey(newKeyName.trim(), newKeyScope);
    setNewKeyName('');
  };

  const handleTestSlack = () => {
    onSendTestSlack();
    setSlackTestSent(true);
    setTimeout(() => setSlackTestSent(false), 2500);
  };

  const sdkSnippet = `// ${config.brandName} REST API & HMAC-SHA256 Webhook Consumer
const res = await fetch('https://api.${config.brandName.toLowerCase()}.local/v1/storage/metrics', {
  headers: {
    Authorization: \`Bearer \${process.env.OCODEJS_API_KEY}\`,
    'X-Ocodejs-Signature': hmacSha256(payload, process.env.WEBHOOK_SECRET),
  },
});
const { qps, p95LatencyMs, cacheHitRatio } = await res.json();`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          {t.cicd.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t.cicd.subtitle}
        </p>
      </div>

      {/* CI/CD Pipeline + Slack Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t.cicd.pipelineTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.cicd.pipelineDesc}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenGitHubPlugin && (
                <button
                  type="button"
                  onClick={onOpenGitHubPlugin}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{lang === 'vi' ? 'Mở GitHub OAuth Plugin' : 'Open GitHub OAuth Plugin'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRunPipeline}
                disabled={runningPipeline}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-teal-600 text-white hover:bg-slate-800 dark:hover:bg-teal-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{t.actions.triggerPipeline}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {stages.map((st, idx) => {
              const done = idx <= pipelineStep;
              return (
                <div
                  key={st.id}
                  className={`p-3 rounded-lg border text-xs transition-colors ${
                    done
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <span>0{idx + 1}</span>
                    <span>{st.duration}</span>
                  </div>
                  <p className="mt-1.5 font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {st.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t.cicd.slackTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.cicd.slackDesc}
            </p>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 pt-1">
              Channel: {config.slackChannel}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTestSlack}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{t.actions.sendTestAlert}</span>
            </button>
            {slackTestSent && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'vi'
                    ? 'Đã đẩy cảnh báo thử vào nhật ký Slack.'
                    : 'Test alert dispatched to Slack feed.'}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Third-Party API Keys & SDK Snippet */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t.cicd.apiTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.cicd.apiDesc}
              </p>
            </div>

            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t.cicd.keyNamePlaceholder}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <select
                value={newKeyScope}
                onChange={(e) => setNewKeyScope(e.target.value as ApiKeyItem['scope'])}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="read:metrics">read:metrics</option>
                <option value="write:storage">write:storage</option>
                <option value="admin:cluster">admin:cluster</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-teal-600 text-white hover:bg-slate-800 dark:hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.actions.createApiKey}</span>
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">{t.cicd.colKeyName}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.cicd.colPrefix}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t.cicd.colScope}</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-slate-400" />
                        <span>{k.name}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {k.prefix}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {k.scope}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {k.active ? (
                        <button
                          type="button"
                          onClick={() => onRevokeApiKey(k.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          {t.actions.revoke}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono">revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.cicd.sdkSnippetTitle}
          </h2>
          <pre className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed">
            <code>{sdkSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
