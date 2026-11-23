import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  auth,
  clearWorkspaceAccessToken,
  signInWithGoogleWorkspace,
  subscribeWorkspaceToken,
} from './lib/firebase';
import {
  ensureUserProfile,
  markSnapshotVerified,
  persistApiKey,
  persistBackupSnapshot,
  persistIntegrationAudit,
  persistSlackAlert,
  persistTeamMemberSecurity,
  revokeApiKeyInFirestore,
  saveClusterConfig,
  subscribeUserWorkspace,
  updateOperatorSecurityPosture,
} from './lib/firestoreStore';
import { translations } from './i18n/translations';
import {
  ApiKeyItem,
  BackupSnapshot,
  ClusterConfig,
  ClusterNode,
  IntegrationAuditEntry,
  Language,
  NavSection,
  PeriodicReport,
  SlackAlertEvent,
  SqlOptimizationCase,
  TeamMemberSecurity,
  TelemetryPoint,
} from './types/infra';
import {
  DEFAULT_CLUSTER_CONFIG,
  INITIAL_API_KEYS,
  INITIAL_BACKUPS,
  INITIAL_NODES,
  INITIAL_SLACK_ALERTS,
  INITIAL_TEAM_SECURITY,
  INITIAL_TELEMETRY,
  PERIODIC_REPORTS,
  SQL_OPTIMIZATION_CASES,
} from './data/mockInfraData';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { BlueprintsStudio } from './components/BlueprintsStudio';
import { SqlRedisOptimizer } from './components/SqlRedisOptimizer';
import { BackupsHaPanel } from './components/BackupsHaPanel';
import { Security2FAPanel } from './components/Security2FAPanel';
import { CicdApiPanel } from './components/CicdApiPanel';
import { IntegrationsHub } from './components/IntegrationsHub';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [lang, setLang] = useState<Language>('vi');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [integrationsTab, setIntegrationsTab] = useState<'gmail' | 'chat' | 'github'>('gmail');

  const [config, setConfig] = useState<ClusterConfig>(DEFAULT_CLUSTER_CONFIG);
  const [nodes, setNodes] = useState<ClusterNode[]>(INITIAL_NODES);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>(INITIAL_TELEMETRY);
  const [trafficSurge, setTrafficSurge] = useState(false);
  const [activeReplicas, setActiveReplicas] = useState(DEFAULT_CLUSTER_CONFIG.minReplicas);

  const [sqlCases, setSqlCases] = useState<SqlOptimizationCase[]>(SQL_OPTIMIZATION_CASES);
  const [failoverActive, setFailoverActive] = useState(false);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(INITIAL_BACKUPS);
  const [slackAlerts, setSlackAlerts] = useState<SlackAlertEvent[]>(INITIAL_SLACK_ALERTS);
  const [team, setTeam] = useState<TeamMemberSecurity[]>(INITIAL_TEAM_SECURITY);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(INITIAL_API_KEYS);
  const [e2eeKeyVersion, setE2eeKeyVersion] = useState<number>(4);
  const [twoFactorVerified, setTwoFactorVerified] = useState<boolean>(false);
  const [integrationAudits, setIntegrationAudits] = useState<IntegrationAuditEntry[]>([]);

  const t = translations[lang];

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    let unsubWorkspace: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);

      if (unsubWorkspace) {
        unsubWorkspace();
        unsubWorkspace = undefined;
      }

      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
          unsubWorkspace = subscribeUserWorkspace(nextUser.uid, {
            onProfileLoaded: ({ twoFactorVerified: verified, e2eeKeyVersion: keyVer }) => {
              setTwoFactorVerified(verified);
              setE2eeKeyVersion(keyVer);
            },
            onClusterLoaded: (loadedConfig, appliedSqlIds) => {
              setConfig(loadedConfig);
              setActiveReplicas(loadedConfig.minReplicas);
              setSqlCases((prev) =>
                prev.map((c) => ({ ...c, applied: appliedSqlIds.includes(c.id) })),
              );
            },
            onSnapshotsLoaded: (items) => setSnapshots(items),
            onApiKeysLoaded: (items) => setApiKeys(items),
            onAlertsLoaded: (items) => setSlackAlerts(items),
            onTeamLoaded: (overrides) => {
              setTeam((prev) =>
                prev.map((m) => {
                  const found = overrides.get(m.id);
                  return found
                    ? { ...m, twoFactorEnabled: found.twoFactorEnabled, lastActive: found.lastActive }
                    : m;
                }),
              );
            },
            onIntegrationAuditsLoaded: (items) => setIntegrationAudits(items),
          });
        } catch (err) {
          console.error('Failed to sync Firebase workspace:', err);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubWorkspace) unsubWorkspace();
    };
  }, []);

  useEffect(() => {
    return subscribeWorkspaceToken(setWorkspaceToken);
  }, []);

  const handleSignIn = async (forceConsent = false) => {
    setAuthError(null);
    try {
      await signInWithGoogleWorkspace(forceConsent);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
      throw err;
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    clearWorkspaceAccessToken();
    await signOut(auth);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const last = prev[prev.length - 1];
        const now = new Date();
        const hh = String(now.getUTCHours()).padStart(2, '0');
        const mm = String(now.getUTCMinutes()).padStart(2, '0');
        const ss = String(now.getUTCSeconds()).padStart(2, '0');
        const baseQps = trafficSurge ? 5400 : 2200;
        const deltaQps = Math.round((Math.random() - 0.5) * 260);
        const nextQps = Math.max(900, baseQps + deltaQps);
        const nextLatency = trafficSurge
          ? Math.max(22, Math.min(78, last.p95LatencyMs + (Math.random() - 0.45) * 8))
          : Math.max(9.5, Math.min(18.5, 14.2 + (Math.random() - 0.5) * 2.2));
        const nextHit = Math.max(91.0, Math.min(98.8, last.cacheHitRatio + (Math.random() - 0.48) * 0.4));
        const nextConns = trafficSurge ? 185 + Math.round(Math.random() * 25) : 88 + Math.round(Math.random() * 14);
        const nextCpu = trafficSurge ? 72 + Math.round(Math.random() * 12) : 33 + Math.round(Math.random() * 6);

        return [
          ...prev.slice(1),
          {
            timestamp: `${hh}:${mm}:${ss}`,
            qps: nextQps,
            p95LatencyMs: Number(nextLatency.toFixed(1)),
            cacheHitRatio: Number(nextHit.toFixed(1)),
            activeConnections: nextConns,
            cpuAvg: nextCpu,
          },
        ];
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [trafficSurge]);

  const appendSlackAlert = (
    severity: SlackAlertEvent['severity'],
    rule: string,
    messageVi: string,
    messageEn: string,
  ) => {
    const now = new Date();
    const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const evt: SlackAlertEvent = {
      id: `evt-${Date.now()}`,
      time,
      severity,
      rule,
      messageVi,
      messageEn,
      channel: config.slackChannel,
    };
    setSlackAlerts((prev) => [evt, ...prev]);
    if (user) {
      void persistSlackAlert(user.uid, evt);
    }
  };

  const handleUpdateConfig = (next: ClusterConfig) => {
    setConfig(next);
    setActiveReplicas(next.minReplicas);
    if (user) {
      const appliedSqlIds = sqlCases.filter((c) => c.applied).map((c) => c.id);
      void saveClusterConfig(user.uid, next, appliedSqlIds);
    }
  };

  const handleToggleSurge = () => {
    const nextSurge = !trafficSurge;
    setTrafficSurge(nextSurge);
    if (nextSurge) {
      setActiveReplicas(Math.min(config.maxReplicas, Math.max(config.minReplicas + 3, 5)));
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          cpuPercent: Math.min(89, n.cpuPercent + 41),
          status: n.role === 'primary' ? 'degraded' : 'healthy',
        })),
      );
      appendSlackAlert(
        'warning',
        'AutoScaleTriggered',
        `CPU vượt ngưỡng ${config.targetCpuPercent}%. Tự động mở rộng ocodejs-core lên ${Math.min(config.maxReplicas, 5)} container.`,
        `CPU crossed ${config.targetCpuPercent}%. Auto-scaled ocodejs-core replicas to ${Math.min(config.maxReplicas, 5)}.`,
      );
    } else {
      setActiveReplicas(config.minReplicas);
      setNodes(INITIAL_NODES);
      appendSlackAlert(
        'info',
        'TrafficNormalized',
        `Lưu lượng ổn định trở lại. Thu gọn cụm về ${config.minReplicas} container.`,
        `Traffic normalized. Scaled replicas back down to ${config.minReplicas}.`,
      );
    }
  };

  const handleToggleSqlCase = (id: string) => {
    setSqlCases((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, applied: !c.applied } : c));
      if (user) {
        const appliedSqlIds = updated.filter((c) => c.applied).map((c) => c.id);
        void saveClusterConfig(user.uid, config, appliedSqlIds);
      }
      return updated;
    });
  };

  const handleToggleFailover = () => {
    const next = !failoverActive;
    setFailoverActive(next);
    if (next) {
      appendSlackAlert(
        'critical',
        'PostgresAutoFailover',
        'Phát hiện Primary gián đoạn. Đã tự động bầu chọn ocodejs-pg-replica-02 lên làm Primary (RTO 3.8s, RPO 0B).',
        'Primary unreachable. Automatically promoted ocodejs-pg-replica-02 to Primary (RTO 3.8s, RPO 0B).',
      );
    } else {
      appendSlackAlert(
        'info',
        'PrimaryRestored',
        'Node Primary gốc đã đồng bộ WAL và quay lại cụm an toàn.',
        'Original Primary re-joined cluster cleanly with synced WAL.',
      );
    }
  };

  const handleRunBackup = () => {
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const newSnap: BackupSnapshot = {
      id: `snap-${stamp}`,
      createdAt: `${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      type: 'wal-incremental',
      sizeGb: 2.4,
      s3Path: `s3://${config.s3Bucket}/wal/${stamp}.sql.zst.gpg`,
      encryption: 'AES-256-GCM + SSE-S3',
      durationSec: 11,
      verified: false,
    };
    setSnapshots((prev) => [newSnap, ...prev]);
    if (user) {
      void persistBackupSnapshot(user.uid, newSnap);
    }
    appendSlackAlert(
      'info',
      'S3BackupCompleted',
      `Hoàn tất sao lưu thủ công ${newSnap.id} lên ${config.s3Bucket}.`,
      `Manual encrypted backup ${newSnap.id} uploaded to ${config.s3Bucket}.`,
    );
  };

  const handleVerifySnapshot = (id: string) => {
    setSnapshots((prev) => prev.map((s) => (s.id === id ? { ...s, verified: true } : s)));
    if (user) {
      void markSnapshotVerified(user.uid, id);
    }
  };

  const handleToggleMember2FA = (id: string) => {
    setTeam((prev) => {
      const updated = prev.map((m) =>
        m.id === id ? { ...m, twoFactorEnabled: !m.twoFactorEnabled, lastActive: 'just now' } : m,
      );
      if (user) {
        const target = updated.find((m) => m.id === id);
        if (target) {
          void persistTeamMemberSecurity(user.uid, target);
        }
      }
      return updated;
    });
  };

  const handleRotateKeys = () => {
    setE2eeKeyVersion((prev) => {
      const next = Math.min(10000, prev + 1);
      if (user) {
        void updateOperatorSecurityPosture(user.uid, { e2eeKeyVersion: next });
      }
      return next;
    });
  };

  const handleVerifyTotpSuccess = () => {
    setTwoFactorVerified(true);
    if (user) {
      void updateOperatorSecurityPosture(user.uid, { twoFactorVerified: true });
    }
  };

  const handleRecordIntegrationAudit = (
    entry: Omit<IntegrationAuditEntry, 'id' | 'createdAt'>,
  ) => {
    const fullEntry: IntegrationAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      createdAt: `${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
    };
    setIntegrationAudits((prev) => [fullEntry, ...prev]);
    if (user) {
      void persistIntegrationAudit(user.uid, fullEntry);
    }
  };

  const handleCreateApiKey = (name: string, scope: ApiKeyItem['scope']) => {
    const hex = Math.random().toString(16).slice(2, 8);
    const item: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name,
      prefix: `ocj_live_${hex}...`,
      scope,
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'just now',
      active: true,
    };
    setApiKeys((prev) => [item, ...prev]);
    if (user) {
      void persistApiKey(user.uid, item);
    }
  };

  const handleRevokeApiKey = (id: string) => {
    setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, active: false } : k)));
    if (user) {
      void revokeApiKeyInFirestore(user.uid, id);
    }
  };

  const handleDownloadReport = (report: PeriodicReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}-ocodejs-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        t={t}
        lang={lang}
        brandName={config.brandName}
        repoSlug={config.repoSlug}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        user={user}
        authLoading={authLoading}
        onSignIn={() => void handleSignIn(false)}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          t={t}
          lang={lang}
          onToggleLang={setLang}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((d) => !d)}
          onOpenExport={() => setExportModalOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {authError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 px-4 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {authError}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewDashboard
              t={t}
              lang={lang}
              config={config}
              nodes={nodes}
              telemetry={telemetry}
              activeReplicas={activeReplicas}
              trafficSurge={trafficSurge}
              onToggleSurge={handleToggleSurge}
              slackAlerts={slackAlerts}
              reports={PERIODIC_REPORTS}
              onDownloadReport={handleDownloadReport}
            />
          )}

          {activeSection === 'blueprints' && (
            <BlueprintsStudio
              t={t}
              lang={lang}
              config={config}
              onChangeConfig={handleUpdateConfig}
            />
          )}

          {activeSection === 'optimization' && (
            <SqlRedisOptimizer
              t={t}
              lang={lang}
              cases={sqlCases}
              onToggleApply={handleToggleSqlCase}
            />
          )}

          {activeSection === 'backups' && (
            <BackupsHaPanel
              t={t}
              lang={lang}
              config={config}
              failoverActive={failoverActive}
              onToggleFailover={handleToggleFailover}
              snapshots={snapshots}
              onRunBackup={handleRunBackup}
              onVerifySnapshot={handleVerifySnapshot}
            />
          )}

          {activeSection === 'security' && (
            <Security2FAPanel
              t={t}
              lang={lang}
              config={config}
              team={team}
              onToggleMember2FA={handleToggleMember2FA}
              keyVersion={e2eeKeyVersion}
              onRotateKeys={handleRotateKeys}
              twoFactorVerified={twoFactorVerified}
              onVerifyTotpSuccess={handleVerifyTotpSuccess}
            />
          )}

          {activeSection === 'cicd' && (
            <CicdApiPanel
              t={t}
              lang={lang}
              config={config}
              apiKeys={apiKeys}
              onCreateApiKey={handleCreateApiKey}
              onRevokeApiKey={handleRevokeApiKey}
              onOpenGitHubPlugin={() => {
                setIntegrationsTab('github');
                setActiveSection('integrations');
              }}
              onSendTestSlack={() =>
                appendSlackAlert(
                  'info',
                  'ManualSlackCheck',
                  `Kiểm tra kết nối Slack Webhook thành công tới ${config.slackChannel}.`,
                  `Slack Webhook test alert delivered to ${config.slackChannel}.`,
                )
              }
            />
          )}

          {activeSection === 'integrations' && (
            <IntegrationsHub
              lang={lang}
              config={config}
              latestTelemetry={telemetry[telemetry.length - 1]}
              activeReplicas={activeReplicas}
              latestSnapshot={snapshots[0]}
              user={user}
              workspaceToken={workspaceToken}
              onConnectWorkspace={handleSignIn}
              initialTab={integrationsTab}
              integrationAudits={integrationAudits}
              onRecordAudit={handleRecordIntegrationAudit}
            />
          )}
        </main>
      </div>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        t={t}
        lang={lang}
        config={config}
      />
    </div>
  );
}
