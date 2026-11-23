import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  LogOut,
  Mail,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  BackupSnapshot,
  ClusterConfig,
  IntegrationAuditEntry,
  Language,
  TelemetryPoint,
} from '../types/infra';
import {
  CHAT_CONSOLE_CONFIG_URL,
  ChatMessageItem,
  ChatSpaceItem,
  getGmailMessageDetail,
  GmailMessageDetail,
  GmailMessageSummary,
  listChatMessages,
  listChatSpaces,
  listGmailMessages,
  postChatMessage,
  sendGmailIncidentReport,
  WorkspaceApiError,
} from '../lib/workspaceApi';
import { GoogleSignInButton } from './GoogleSignInButton';

type IntegrationTab = 'gmail' | 'chat' | 'github';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepoSummary {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
  pushedAt: string;
  openIssuesCount: number;
}

interface GitHubCommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  htmlUrl: string;
}

interface GitHubWorkflowItem {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface GitHubWorkflowRun {
  id: number;
  name: string;
  branch: string;
  sha: string;
  status: string;
  conclusion: string | null;
  event: string;
  updatedAt: string;
  htmlUrl: string;
}

interface GitHubRepoOverview {
  repository: {
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    htmlUrl: string;
    openIssuesCount: number;
    stars: number;
    pushedAt: string;
  };
  commits: GitHubCommitSummary[];
  workflows: GitHubWorkflowItem[];
  runs: GitHubWorkflowRun[];
}

interface IntegrationsHubProps {
  lang: Language;
  config: ClusterConfig;
  latestTelemetry: TelemetryPoint;
  activeReplicas: number;
  latestSnapshot?: BackupSnapshot;
  user: User | null;
  workspaceToken: string | null;
  onConnectWorkspace: (forceConsent?: boolean) => Promise<void>;
  initialTab?: IntegrationTab;
  integrationAudits: IntegrationAuditEntry[];
  onRecordAudit: (entry: Omit<IntegrationAuditEntry, 'id' | 'createdAt'>) => void;
}

const DEV_GITHUB_CALLBACK =
  'https://ais-dev-gbq4teszwhqrq67m4zfdyo-1013319684967.asia-east1.run.app/auth/github/callback';
const SHARED_GITHUB_CALLBACK =
  'https://ais-pre-gbq4teszwhqrq67m4zfdyo-1013319684967.asia-east1.run.app/auth/github/callback';

function isSafeHttpsUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const IntegrationsHub: React.FC<IntegrationsHubProps> = ({
  lang,
  config,
  latestTelemetry,
  activeReplicas,
  latestSnapshot,
  user,
  workspaceToken,
  onConnectWorkspace,
  initialTab = 'gmail',
  integrationAudits,
  onRecordAudit,
}) => {
  const [activeTab, setActiveTab] = useState<IntegrationTab>(initialTab);
  const [connectingWorkspace, setConnectingWorkspace] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | 'gmail' | 'google-chat' | 'github'>('all');

  // Gmail state
  const [gmailQuery, setGmailQuery] = useState('alert OR incident OR postgres OR ocodejs');
  const [gmailFilterMode, setGmailFilterMode] = useState<'alerts' | 'all'>('alerts');
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailNeedsReauth, setGmailNeedsReauth] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<GmailMessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [emailTo, setEmailTo] = useState(user?.email || '');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [confirmSendEmail, setConfirmSendEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentNotice, setEmailSentNotice] = useState<string | null>(null);

  // Google Chat state
  const [chatSpaces, setChatSpaces] = useState<ChatSpaceItem[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSetupConsoleUrl, setChatSetupConsoleUrl] = useState<string | null>(null);
  const [chatNeedsReauth, setChatNeedsReauth] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [confirmSendChat, setConfirmSendChat] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatSentNotice, setChatSentNotice] = useState<string | null>(null);

  // GitHub OAuth Plugin state (session token strictly in React memory)
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [githubSessionToken, setGithubSessionToken] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepoSummary[]>([]);
  const [selectedRepoSlug, setSelectedRepoSlug] = useState<string>('');
  const [repoOverview, setRepoOverview] = useState<GitHubRepoOverview | null>(null);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [copiedUrlKey, setCopiedUrlKey] = useState<string | null>(null);

  const [dispatchTargetWorkflow, setDispatchTargetWorkflow] = useState<GitHubWorkflowItem | null>(null);
  const [dispatchRef, setDispatchRef] = useState('main');
  const [dispatchNote, setDispatchNote] = useState('ocodejs control-plane rollout');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user?.email && !emailTo) {
      setEmailTo(user.email);
    }
  }, [user?.email, emailTo]);

  const handleWorkspaceConnect = async (forceConsent = false) => {
    setConnectingWorkspace(true);
    setGmailError(null);
    setChatError(null);
    try {
      await onConnectWorkspace(forceConsent);
      setGmailNeedsReauth(false);
      setChatNeedsReauth(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setGmailError(msg);
      setChatError(msg);
    } finally {
      setConnectingWorkspace(false);
    }
  };

  const loadGmail = useCallback(async () => {
    if (!workspaceToken) return;
    setGmailLoading(true);
    setGmailError(null);
    setGmailNeedsReauth(false);
    try {
      const effectiveQuery = gmailFilterMode === 'alerts' ? gmailQuery : '';
      const list = await listGmailMessages(workspaceToken, effectiveQuery, 12);
      setGmailMessages(list);
      if (list.length > 0 && !list.some((m) => m.id === selectedMessageId)) {
        setSelectedMessageId(list[0].id);
      } else if (list.length === 0) {
        setSelectedMessageId(null);
        setSelectedDetail(null);
      }
    } catch (err) {
      if (err instanceof WorkspaceApiError && err.code === 'AUTH_EXPIRED') {
        setGmailNeedsReauth(true);
      }
      setGmailError(err instanceof Error ? err.message : 'Failed to load Gmail alerts');
    } finally {
      setGmailLoading(false);
    }
  }, [workspaceToken, gmailFilterMode, gmailQuery, selectedMessageId]);

  useEffect(() => {
    if (activeTab === 'gmail' && workspaceToken) {
      void loadGmail();
    }
  }, [activeTab, workspaceToken, loadGmail]);

  useEffect(() => {
    if (!workspaceToken || !selectedMessageId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getGmailMessageDetail(workspaceToken, selectedMessageId)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail);
      })
      .catch((err) => {
        if (!cancelled) {
          setGmailError(err instanceof Error ? err.message : 'Unable to read email body');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceToken, selectedMessageId]);

  const prefillIncidentReport = () => {
    setEmailSubject(
      lang === 'vi'
        ? `[${config.brandName}] Báo cáo sự cố & hiệu năng cụm PostgreSQL`
        : `[${config.brandName}] PostgreSQL Cluster Incident & Telemetry Report`,
    );
    setEmailBody(
      [
        `Cluster: ${config.brandName} (${config.repoSlug})`,
        `PostgreSQL: v${config.pgVersion} | TLS: ${config.tlsMode}`,
        `Timestamp: ${latestTelemetry.timestamp} UTC`,
        `Throughput: ${latestTelemetry.qps} QPS | P95 Latency: ${latestTelemetry.p95LatencyMs} ms`,
        `Redis Hit Ratio: ${latestTelemetry.cacheHitRatio}% | Active Replicas: ${activeReplicas}/${config.maxReplicas}`,
        `Latest S3 Backup: ${latestSnapshot ? `${latestSnapshot.id} (${latestSnapshot.s3Path})` : 'N/A'}`,
        '',
        lang === 'vi'
          ? 'Ghi chú vận hành: Vui lòng kiểm tra nhật ký WAL và xác nhận trạng thái replica.'
          : 'Operator Notes: Please review streaming WAL health and confirm standby replica sync.',
      ].join('\n'),
    );
  };

  const handleConfirmSendEmail = async () => {
    if (!workspaceToken) return;
    setSendingEmail(true);
    setGmailError(null);
    setEmailSentNotice(null);
    try {
      await sendGmailIncidentReport(workspaceToken, {
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      });
      setConfirmSendEmail(false);
      setEmailSentNotice(
        lang === 'vi'
          ? `Đã gửi báo cáo sự cố qua Gmail tới ${emailTo.trim()}.`
          : `Incident report sent via Gmail to ${emailTo.trim()}.`,
      );
      onRecordAudit({
        channel: 'gmail',
        action: 'incident-email',
        target: emailTo.trim(),
        summary: emailSubject.trim(),
        status: 'success',
      });
      void loadGmail();
    } catch (err) {
      setConfirmSendEmail(false);
      onRecordAudit({
        channel: 'gmail',
        action: 'incident-email',
        target: emailTo.trim(),
        summary: err instanceof Error ? err.message : emailSubject.trim(),
        status: 'failed',
      });
      if (err instanceof WorkspaceApiError && err.code === 'AUTH_EXPIRED') {
        setGmailNeedsReauth(true);
      }
      setGmailError(err instanceof Error ? err.message : 'Failed to send incident report');
    } finally {
      setSendingEmail(false);
    }
  };

  const loadChatSpaces = useCallback(async () => {
    if (!workspaceToken) return;
    setChatLoading(true);
    setChatError(null);
    setChatSetupConsoleUrl(null);
    setChatNeedsReauth(false);
    try {
      const spaces = await listChatSpaces(workspaceToken);
      setChatSpaces(spaces);
      if (spaces.length > 0 && !spaces.some((s) => s.name === selectedSpace)) {
        setSelectedSpace(spaces[0].name);
      }
    } catch (err) {
      if (err instanceof WorkspaceApiError) {
        if (err.code === 'AUTH_EXPIRED') {
          setChatNeedsReauth(true);
        } else if (err.code === 'CHAT_APP_NOT_CONFIGURED') {
          setChatSetupConsoleUrl(err.consoleUrl || CHAT_CONSOLE_CONFIG_URL);
        }
      }
      setChatError(err instanceof Error ? err.message : 'Failed to load Google Chat spaces');
    } finally {
      setChatLoading(false);
    }
  }, [workspaceToken, selectedSpace]);

  const loadChatMessages = useCallback(async () => {
    if (!workspaceToken || !selectedSpace) {
      setChatMessages([]);
      return;
    }
    setChatMessagesLoading(true);
    setChatError(null);
    try {
      const items = await listChatMessages(workspaceToken, selectedSpace);
      setChatMessages(items);
    } catch (err) {
      if (err instanceof WorkspaceApiError && err.code === 'CHAT_APP_NOT_CONFIGURED') {
        setChatSetupConsoleUrl(err.consoleUrl || CHAT_CONSOLE_CONFIG_URL);
      }
      setChatError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setChatMessagesLoading(false);
    }
  }, [workspaceToken, selectedSpace]);

  useEffect(() => {
    if (activeTab === 'chat' && workspaceToken) {
      void loadChatSpaces();
    }
  }, [activeTab, workspaceToken, loadChatSpaces]);

  useEffect(() => {
    if (activeTab === 'chat' && workspaceToken && selectedSpace) {
      void loadChatMessages();
    }
  }, [activeTab, workspaceToken, selectedSpace, loadChatMessages]);

  const handleConfirmSendChat = async () => {
    if (!workspaceToken || !selectedSpace || !chatDraft.trim()) return;
    setSendingChat(true);
    setChatError(null);
    setChatSentNotice(null);
    try {
      const posted = await postChatMessage(workspaceToken, selectedSpace, chatDraft.trim());
      setChatMessages((prev) => [posted, ...prev]);
      setChatDraft('');
      setConfirmSendChat(false);
      setChatSentNotice(
        lang === 'vi'
          ? 'Đã đăng cảnh báo cụm lên Google Chat.'
          : 'Cluster alert posted to Google Chat space.',
      );
      onRecordAudit({
        channel: 'google-chat',
        action: 'cluster-alert',
        target: activeSpaceMeta?.displayName || selectedSpace,
        summary: chatDraft.trim(),
        status: 'success',
      });
    } catch (err) {
      setConfirmSendChat(false);
      onRecordAudit({
        channel: 'google-chat',
        action: 'cluster-alert',
        target: activeSpaceMeta?.displayName || selectedSpace,
        summary: err instanceof Error ? err.message : chatDraft.trim(),
        status: 'failed',
      });
      if (err instanceof WorkspaceApiError && err.code === 'CHAT_APP_NOT_CONFIGURED') {
        setChatSetupConsoleUrl(err.consoleUrl || CHAT_CONSOLE_CONFIG_URL);
      }
      setChatError(err instanceof Error ? err.message : 'Failed to post Google Chat alert');
    } finally {
      setSendingChat(false);
    }
  };

  // GitHub config check & OAuth popup listener
  useEffect(() => {
    fetch('/api/github/config')
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        setGithubConfigured(Boolean(data.configured));
      })
      .catch(() => {
        setGithubConfigured(false);
      });
  }, []);

  const loadGitHubRepos = useCallback(async (token: string) => {
    setGithubLoading(true);
    setGithubError(null);
    try {
      const res = await fetch('/api/github/repos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load GitHub repositories');
      }
      const data = (await res.json()) as { repos: GitHubRepoSummary[] };
      setGithubRepos(data.repos);
      if (data.repos.length > 0) {
        const preferred = data.repos.find(
          (r) => r.fullName.toLowerCase() === config.repoSlug.toLowerCase(),
        );
        setSelectedRepoSlug((prev) =>
          prev && data.repos.some((r) => r.fullName === prev)
            ? prev
            : (preferred || data.repos[0]).fullName,
        );
      }
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Unable to fetch repositories');
    } finally {
      setGithubLoading(false);
    }
  }, [config.repoSlug]);

  const loadRepoOverview = useCallback(async (token: string, fullName: string) => {
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) return;
    setGithubLoading(true);
    setGithubError(null);
    try {
      const res = await fetch(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/overview`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to inspect repository');
      }
      const data = (await res.json()) as GitHubRepoOverview;
      setRepoOverview(data);
      setDispatchRef(data.repository.defaultBranch || 'main');
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to load repository details');
    } finally {
      setGithubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (githubSessionToken && selectedRepoSlug) {
      void loadRepoOverview(githubSessionToken, selectedRepoSlug);
    }
  }, [githubSessionToken, selectedRepoSlug, loadRepoOverview]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const parsedOrigin = new URL(event.origin);
        const validHost =
          parsedOrigin.hostname.endsWith('.run.app') ||
          parsedOrigin.hostname === 'localhost' ||
          parsedOrigin.hostname === '127.0.0.1';
        if (!validHost) return;
      } catch {
        return;
      }

      const payload = event.data as
        | { type?: string; sessionToken?: string; user?: GitHubUser; error?: string }
        | undefined;
      if (!payload?.type) return;

      if (payload.type === 'GITHUB_OAUTH_SUCCESS' && payload.sessionToken && payload.user) {
        setGithubError(null);
        setGithubSessionToken(payload.sessionToken);
        setGithubUser(payload.user);
        void loadGitHubRepos(payload.sessionToken);
      } else if (payload.type === 'GITHUB_OAUTH_ERROR') {
        setGithubError(payload.error || 'GitHub authorization failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadGitHubRepos]);

  const handleConnectGitHub = async () => {
    setGithubError(null);
    setDispatchNotice(null);
    try {
      const res = await fetch('/api/auth/github/url');
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.message || data.error || 'Unable to start GitHub OAuth');
      }
      const popup = window.open(data.url, 'ocodejs_github_oauth', 'width=640,height=720');
      if (!popup) {
        setGithubError(
          lang === 'vi'
            ? 'Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép popup để kết nối GitHub.'
            : 'Popup blocked by browser. Please allow popups for this site to connect GitHub.',
        );
      }
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'GitHub authorization could not be started');
    }
  };

  const handleDisconnectGitHub = async () => {
    if (githubSessionToken) {
      await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      }).catch(() => {});
    }
    setGithubSessionToken(null);
    setGithubUser(null);
    setGithubRepos([]);
    setSelectedRepoSlug('');
    setRepoOverview(null);
    setDispatchNotice(null);
  };

  const handleConfirmDispatch = async () => {
    if (!githubSessionToken || !selectedRepoSlug || !dispatchTargetWorkflow) return;
    const [owner, repo] = selectedRepoSlug.split('/');
    if (!owner || !repo) return;

    setDispatching(true);
    setGithubError(null);
    setDispatchNotice(null);
    try {
      const res = await fetch(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/workflows/${encodeURIComponent(String(dispatchTargetWorkflow.id))}/dispatch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubSessionToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: dispatchRef.trim(),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Workflow dispatch rejected by GitHub');
      }
      setDispatchNotice(
        lang === 'vi'
          ? `Đã kích hoạt workflow "${dispatchTargetWorkflow.name}" trên nhánh ${dispatchRef.trim()}.`
          : `Triggered workflow "${dispatchTargetWorkflow.name}" on branch ${dispatchRef.trim()}.`,
      );
      onRecordAudit({
        channel: 'github',
        action: 'workflow-dispatch',
        target: `${selectedRepoSlug}@${dispatchRef.trim()}`,
        summary: dispatchTargetWorkflow.name,
        status: 'success',
      });
      setDispatchTargetWorkflow(null);
      setTimeout(() => {
        if (githubSessionToken && selectedRepoSlug) {
          void loadRepoOverview(githubSessionToken, selectedRepoSlug);
        }
      }, 1500);
    } catch (err) {
      onRecordAudit({
        channel: 'github',
        action: 'workflow-dispatch',
        target: `${selectedRepoSlug}@${dispatchRef.trim()}`,
        summary: err instanceof Error ? err.message : dispatchTargetWorkflow.name,
        status: 'failed',
      });
      setDispatchTargetWorkflow(null);
      setGithubError(err instanceof Error ? err.message : 'Failed to trigger workflow');
    } finally {
      setDispatching(false);
    }
  };

  const handleCopyText = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedUrlKey(key);
    setTimeout(() => setCopiedUrlKey(null), 1800);
  };

  const activeSpaceMeta = useMemo(
    () => chatSpaces.find((s) => s.name === selectedSpace),
    [chatSpaces, selectedSpace],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            {lang === 'vi'
              ? 'Trung tâm Tích hợp Gmail, Google Chat & GitHub'
              : 'Gmail, Google Chat & GitHub Plugin Hub'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            {lang === 'vi'
              ? 'Đọc cảnh báo sự cố qua Gmail, gửi thông báo cụm tới không gian Google Chat và ủy quyền GitHub OAuth để theo dõi & chạy workflow trực tiếp.'
              : 'Triage Gmail alert digests, broadcast cluster alerts to Google Chat spaces, and authorize GitHub repositories to inspect status and trigger workflows.'}
          </p>
        </div>

        <div className="inline-flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('gmail')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'gmail'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Google Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'github'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>GitHub Plugin</span>
          </button>
        </div>
      </div>

      {/* GMAIL PANEL */}
      {activeTab === 'gmail' && (
        <div className="space-y-6">
          {!workspaceToken ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-xs font-semibold">
                  <Mail className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Kết nối Gmail Workspace' : 'Connect Gmail Workspace'}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {lang === 'vi'
                    ? 'Đọc cảnh báo hộp thư & gửi báo cáo sự cố'
                    : 'Read alert digests & send incident reports'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {user
                    ? lang === 'vi'
                      ? 'Phiên làm việc cần cấp lại quyền truy cập bộ nhớ tạm cho Gmail & Google Chat sau khi tải lại trang. Mã truy cập chỉ lưu trong RAM và tự xóa khi đăng xuất.'
                      : 'Grant temporary in-memory access to read Gmail alert messages and send incident reports. Tokens stay in memory only and clear on sign-out.'
                    : lang === 'vi'
                    ? 'Đăng nhập bằng Google để đọc email cảnh báo hệ thống và gửi báo cáo sự cố cụm trực tiếp từ bảng điều khiển.'
                    : 'Sign in with Google to inspect incoming system alerts and dispatch cluster incident reports directly from the control plane.'}
                </p>
              </div>
              <div className="shrink-0">
                <GoogleSignInButton
                  onClick={() => void handleWorkspaceConnect(Boolean(user))}
                  disabled={connectingWorkspace}
                  label={
                    lang === 'vi'
                      ? 'Đăng nhập bằng Google'
                      : 'Sign in with Google'
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Inbox & Reader */}
              <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {lang === 'vi' ? 'Hộp thư cảnh báo Gmail' : 'Gmail Alert Inbox'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGmailFilterMode('alerts')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          gmailFilterMode === 'alerts'
                            ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {lang === 'vi' ? 'Lọc cảnh báo' : 'Alerts Filter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGmailFilterMode('all')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          gmailFilterMode === 'all'
                            ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {lang === 'vi' ? 'Tất cả thư' : 'All Mail'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadGmail()}
                        disabled={gmailLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${gmailLoading ? 'animate-spin' : ''}`} />
                        <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                      </button>
                    </div>
                  </div>

                  {gmailFilterMode === 'alerts' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void loadGmail();
                      }}
                      className="flex gap-2"
                    >
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={gmailQuery}
                          onChange={(e) => setGmailQuery(e.target.value)}
                          placeholder="alert OR postgres OR ocodejs"
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 transition-colors"
                      >
                        {lang === 'vi' ? 'Tìm' : 'Search'}
                      </button>
                    </form>
                  )}

                  {gmailError && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                      <span>{gmailError}</span>
                      {gmailNeedsReauth && (
                        <button
                          type="button"
                          onClick={() => void handleWorkspaceConnect(true)}
                          className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold whitespace-nowrap"
                        >
                          {lang === 'vi' ? 'Cấp quyền lại' : 'Re-authorize'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {gmailLoading ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-10 rounded bg-slate-100 dark:bg-slate-800/60" />
                    ))}
                  </div>
                ) : gmailMessages.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {lang === 'vi'
                        ? 'Không tìm thấy email khớp bộ lọc hiện tại.'
                        : 'No Gmail messages match the current query.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setGmailFilterMode('all')}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {lang === 'vi' ? 'Xem toàn bộ hộp thư' : 'Show all mailbox messages'}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                    {gmailMessages.map((msg) => {
                      const active = msg.id === selectedMessageId;
                      return (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => setSelectedMessageId(msg.id)}
                          className={`w-full text-left px-4 py-2.5 transition-colors flex items-start justify-between gap-3 ${
                            active
                              ? 'bg-teal-50/70 dark:bg-teal-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs truncate ${msg.unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                              {msg.subject}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {msg.from} — {msg.snippet}
                            </p>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                            {msg.date.slice(0, 16)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedDetail && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-950/40 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedDetail.subject}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {selectedDetail.from} · <span className="font-mono tabular-nums">{selectedDetail.date}</span>
                        </p>
                      </div>
                    </div>
                    {detailLoading ? (
                      <div className="h-16 rounded bg-slate-200/70 dark:bg-slate-800/60" />
                    ) : (
                      <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                        {selectedDetail.bodyText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Incident Report Composer */}
              <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {lang === 'vi' ? 'Gửi báo cáo sự cố qua Gmail' : 'Send Incident Report via Gmail'}
                  </h2>
                  <button
                    type="button"
                    onClick={prefillIncidentReport}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors whitespace-nowrap"
                  >
                    {lang === 'vi' ? 'Điền số liệu cụm' : 'Pre-fill Telemetry'}
                  </button>
                </div>

                {emailSentNotice && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{emailSentNotice}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
                    setConfirmSendEmail(true);
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'vi' ? 'Người nhận (To)' : 'Recipient (To)'}
                    </label>
                    <input
                      type="email"
                      required
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="oncall@ocodejs.dev"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'vi' ? 'Tiêu đề' : 'Subject'}
                    </label>
                    <input
                      type="text"
                      required
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="[ocodejs] PostgreSQL Incident Report"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'vi' ? 'Nội dung báo cáo' : 'Report Body'}
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder={
                        lang === 'vi'
                          ? 'Mô tả sự cố, nhật ký WAL và hành động khắc phục...'
                          : 'Describe incident timeline, metrics, and remediation...'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Xem lại & Gửi Email' : 'Review & Send Email'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GOOGLE CHAT PANEL */}
      {activeTab === 'chat' && (
        <div className="space-y-6">
          {!workspaceToken ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-xs font-semibold">
                  <MessageSquare className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Kết nối Google Chat Workspace' : 'Connect Google Chat Workspace'}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {lang === 'vi'
                    ? 'Liệt kê không gian Chat & đăng cảnh báo cụm'
                    : 'List Workspace spaces & post cluster alerts'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'vi'
                    ? 'Lưu ý: Google Chat API yêu cầu tài khoản Google Workspace Business hoặc Enterprise (không hỗ trợ @gmail.com cá nhân) và cấu hình Chat App một lần trong Google Cloud Console.'
                    : 'Note: Google Chat API requires a Business or Enterprise Google Workspace account (consumer @gmail.com accounts are unsupported) and one-time Chat App registration in Google Cloud Console.'}
                </p>
              </div>
              <div className="shrink-0">
                <GoogleSignInButton
                  onClick={() => void handleWorkspaceConnect(Boolean(user))}
                  disabled={connectingWorkspace}
                  label={lang === 'vi' ? 'Đăng nhập bằng Google' : 'Sign in with Google'}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {chatSetupConsoleUrl && isSafeHttpsUrl(chatSetupConsoleUrl) && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'vi'
                          ? 'Cần cấu hình Google Chat App trong Cloud Console'
                          : 'Google Chat App configuration required in Cloud Console'}
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
                      {chatError} —{' '}
                      {lang === 'vi'
                        ? 'Vui lòng điền App name, Avatar URL và Description trên trang Google Chat API > Configuration (cần tài khoản Google Workspace Business/Enterprise).'
                        : 'Set App name, Avatar URL, and Description on the Google Chat API > Configuration page (requires a Business/Enterprise Workspace account).'}
                    </p>
                  </div>
                  <a
                    href={chatSetupConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap shrink-0"
                  >
                    <span>{lang === 'vi' ? 'Mở Cloud Console' : 'Open Cloud Console'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {chatError && !chatSetupConsoleUrl && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                  <span>{chatError}</span>
                  {chatNeedsReauth && (
                    <button
                      type="button"
                      onClick={() => void handleWorkspaceConnect(true)}
                      className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-semibold whitespace-nowrap"
                    >
                      {lang === 'vi' ? 'Cấp quyền lại' : 'Re-authorize'}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Spaces & Feed */}
                <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {lang === 'vi' ? 'Không gian Chat:' : 'Chat Space:'}
                      </label>
                      <select
                        value={selectedSpace}
                        onChange={(e) => setSelectedSpace(e.target.value)}
                        disabled={chatLoading || chatSpaces.length === 0}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {chatSpaces.length === 0 ? (
                          <option value="">
                            {chatLoading
                              ? lang === 'vi'
                                ? 'Đang tải...'
                                : 'Loading...'
                              : lang === 'vi'
                              ? 'Không có không gian nào'
                              : 'No spaces available'}
                          </option>
                        ) : (
                          chatSpaces.map((sp) => (
                            <option key={sp.name} value={sp.name}>
                              {sp.displayName} ({sp.spaceType})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void loadChatSpaces();
                        if (selectedSpace) void loadChatMessages();
                      }}
                      disabled={chatLoading || chatMessagesLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${chatLoading || chatMessagesLoading ? 'animate-spin' : ''}`} />
                      <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                    </button>
                  </div>

                  {chatLoading || chatMessagesLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-11 rounded bg-slate-100 dark:bg-slate-800/60" />
                      ))}
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'vi'
                        ? 'Chưa có tin nhắn nào được hiển thị trong không gian này.'
                        : 'No messages loaded for this Google Chat space yet.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                      {chatMessages.map((msg) => (
                        <div key={msg.name} className="px-4 py-3 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {msg.senderName}
                            </span>
                            <span className="font-mono tabular-nums text-slate-400">
                              {msg.createTime ? msg.createTime.replace('T', ' ').slice(0, 19) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Alert Poster */}
                <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {lang === 'vi' ? 'Đăng cảnh báo cụm lên Google Chat' : 'Post Cluster Alert to Space'}
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        setChatDraft(
                          `[${config.brandName}] Cluster Alert | QPS: ${latestTelemetry.qps} | P95: ${latestTelemetry.p95LatencyMs}ms | Redis Hit: ${latestTelemetry.cacheHitRatio}% | Replicas: ${activeReplicas}/${config.maxReplicas}`,
                        )
                      }
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
                    >
                      {lang === 'vi' ? 'Chèn số liệu' : 'Insert Telemetry'}
                    </button>
                  </div>

                  {chatSentNotice && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{chatSentNotice}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!selectedSpace || !chatDraft.trim()) return;
                      setConfirmSendChat(true);
                    }}
                    className="space-y-3"
                  >
                    <textarea
                      required
                      rows={5}
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder={
                        lang === 'vi'
                          ? 'Nhập thông báo sự cố PostgreSQL, Redis hoặc S3 backup...'
                          : 'Enter PostgreSQL, Redis, or S3 backup alert message...'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={!selectedSpace || !chatDraft.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Xem lại & Gửi lên Chat' : 'Review & Post Alert'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GITHUB OAUTH API PLUGIN PANEL */}
      {activeTab === 'github' && (
        <div className="space-y-6">
          {/* OAuth Callback Configuration Guide */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {lang === 'vi'
                    ? 'Cấu hình GitHub OAuth App & Callback URL'
                    : 'GitHub OAuth App & Callback Configuration'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'vi'
                    ? 'Đăng ký Authorization Callback URL dưới đây tại GitHub Developer Settings và cấu hình GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET trong AI Studio Secrets.'
                    : 'Register these Authorization Callback URLs in GitHub Developer Settings and set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in AI Studio Secrets.'}
                </p>
              </div>
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <span>GitHub Developer Settings</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[
                { key: 'dev', label: 'Development Callback URL', url: DEV_GITHUB_CALLBACK },
                { key: 'shared', label: 'Shared App Callback URL', url: SHARED_GITHUB_CALLBACK },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                      {item.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(item.key, item.url)}
                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 shrink-0"
                    aria-label="Copy callback URL"
                  >
                    {copiedUrlKey === item.key ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {githubConfigured === false && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'vi'
                    ? 'Chưa phát hiện GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET trên máy chủ. Hãy thêm 2 biến môi trường này trong AI Studio Secrets trước khi nhấn Kết nối.'
                    : 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not configured on the server yet. Add them in AI Studio Secrets before connecting.'}
                </span>
              </div>
            )}
          </div>

          {githubError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {githubError}
            </div>
          )}

          {dispatchNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{dispatchNotice}</span>
            </div>
          )}

          {!githubSessionToken || !githubUser ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-xs font-semibold">
                  <GitBranch className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Quy trình Ủy quyền API GitHub Plugin' : 'GitHub OAuth API Auth Plugin'}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {lang === 'vi'
                    ? 'Kết nối kho lưu trữ, xem trạng thái & chạy Workflow'
                    : 'Connect repositories, inspect status & trigger workflows'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'vi'
                    ? 'Ủy quyền qua cửa sổ GitHub OAuth chính thức (quyền read:user, repo, workflow). Token GitHub được giữ an toàn trên máy chủ và không bao giờ lưu xuống trình duyệt.'
                    : 'Authorize via GitHub popup OAuth (read:user, repo, workflow). GitHub access tokens remain strictly on the server and are never exposed to browser storage.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleConnectGitHub()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                <span>{lang === 'vi' ? 'Kết nối kho lưu trữ GitHub' : 'Connect GitHub Repository'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connected User & Repo Selector */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {isSafeHttpsUrl(githubUser.avatar_url) && (
                    <img
                      src={githubUser.avatar_url}
                      alt={githubUser.login}
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {githubUser.name || githubUser.login}
                    </p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                      @{githubUser.login} · {githubRepos.length} {lang === 'vi' ? 'kho lưu trữ' : 'repositories'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedRepoSlug}
                    onChange={(e) => setSelectedRepoSlug(e.target.value)}
                    disabled={githubRepos.length === 0}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {githubRepos.map((repo) => (
                      <option key={repo.id} value={repo.fullName}>
                        {repo.fullName} ({repo.isPrivate ? 'private' : 'public'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      githubSessionToken &&
                      selectedRepoSlug &&
                      void loadRepoOverview(githubSessionToken, selectedRepoSlug)
                    }
                    disabled={githubLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${githubLoading ? 'animate-spin' : ''}`} />
                    <span>{lang === 'vi' ? 'Đồng bộ' : 'Sync'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectGitHub()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Ngắt kết nối' : 'Disconnect'}</span>
                  </button>
                </div>
              </div>

              {repoOverview && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* Workflows & Dispatch */}
                  <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {lang === 'vi' ? 'GitHub Actions Workflows' : 'GitHub Actions Workflows'}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          branch: {repoOverview.repository.defaultBranch} · issues: {repoOverview.repository.openIssuesCount}
                        </p>
                      </div>
                      {isSafeHttpsUrl(repoOverview.repository.htmlUrl) && (
                        <a
                          href={repoOverview.repository.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Open repository on GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {repoOverview.workflows.length === 0 ? (
                      <div className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                        {lang === 'vi'
                          ? 'Kho lưu trữ này chưa có tệp workflow trong .github/workflows.'
                          : 'No GitHub Actions workflows found in this repository.'}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {repoOverview.workflows.map((wf) => (
                          <div
                            key={wf.id}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {wf.name}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                {wf.path} · {wf.state}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDispatchTargetWorkflow(wf)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap shrink-0"
                            >
                              <Play className="w-3 h-3" />
                              <span>{lang === 'vi' ? 'Chạy' : 'Trigger'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Latest Commits */}
                    <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-2.5 bg-slate-50/60 dark:bg-slate-950/40">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {lang === 'vi' ? 'Commit gần nhất' : 'Recent Commits'}
                      </h4>
                      {repoOverview.commits.map((c) => (
                        <div key={c.sha} className="flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0 flex items-start gap-2">
                            <GitCommit className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-slate-800 dark:text-slate-200 truncate">{c.message}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.author}</p>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                            {c.sha}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workflow Runs Table */}
                  <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {lang === 'vi' ? 'Lịch sử chạy Workflow gần đây' : 'Recent Workflow Runs'}
                      </h3>
                    </div>
                    {repoOverview.runs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        {lang === 'vi' ? 'Chưa có lượt chạy workflow nào.' : 'No workflow runs recorded yet.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                              <th className="py-2.5 px-4 whitespace-nowrap">Workflow</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Branch</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Commit</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                              <th className="py-2.5 px-4 whitespace-nowrap text-right">Updated</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {repoOverview.runs.map((run) => {
                              const ok = run.conclusion === 'success';
                              const failed = run.conclusion === 'failure' || run.conclusion === 'cancelled';
                              return (
                                <tr key={run.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                    {isSafeHttpsUrl(run.htmlUrl) ? (
                                      <a
                                        href={run.htmlUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-teal-600 dark:hover:text-teal-400"
                                      >
                                        {run.name}
                                      </a>
                                    ) : (
                                      run.name
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {run.branch}
                                  </td>
                                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {run.sha}
                                  </td>
                                  <td className="py-2.5 px-4 whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center gap-1.5 font-medium ${
                                        ok
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : failed
                                          ? 'text-rose-700 dark:text-rose-400'
                                          : 'text-amber-700 dark:text-amber-400'
                                      }`}
                                    >
                                      {ok ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : failed ? (
                                        <XCircle className="w-3.5 h-3.5" />
                                      ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                      )}
                                      <span>{run.conclusion || run.status}</span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {run.updatedAt.replace('T', ' ').slice(0, 16)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FIRESTORE INTEGRATION & WORKFLOW AUDIT LOG */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {lang === 'vi'
                ? 'Nhật ký kiểm toán tích hợp & Workflow (Firestore)'
                : 'Integration & Workflow Dispatch Audit Log (Firestore)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {user
                ? lang === 'vi'
                  ? 'Lưu trữ metadata các email sự cố Gmail, cảnh báo Google Chat và lệnh chạy GitHub Actions theo từng phiên.'
                  : 'Persists sanitized metadata for Gmail incident emails, Google Chat alerts, and GitHub workflow triggers.'
                : lang === 'vi'
                ? 'Đăng nhập Google ở thanh bên để đồng bộ nhật ký kiểm toán vào Firestore.'
                : 'Sign in with Google in the sidebar to persist this audit log into Firestore.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(['all', 'gmail', 'google-chat', 'github'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setAuditFilter(ch)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  auditFilter === ch
                    ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {ch === 'all' ? (lang === 'vi' ? 'Tất cả' : 'All') : ch}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const filtered =
            auditFilter === 'all'
              ? integrationAudits
              : integrationAudits.filter((a) => a.channel === auditFilter);

          if (filtered.length === 0) {
            return (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'vi'
                  ? 'Chưa có lượt gửi Gmail, Google Chat hoặc chạy GitHub Workflow nào được ghi nhận.'
                  : 'No Gmail dispatches, Google Chat alerts, or GitHub workflow triggers logged yet.'}
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-4 whitespace-nowrap">{lang === 'vi' ? 'Kênh' : 'Channel'}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">{lang === 'vi' ? 'Hành động' : 'Action'}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">{lang === 'vi' ? 'Đích' : 'Target'}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">{lang === 'vi' ? 'Tóm tắt' : 'Summary'}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">{lang === 'vi' ? 'Kết quả' : 'Status'}</th>
                    <th className="py-2.5 px-4 whitespace-nowrap text-right">{lang === 'vi' ? 'Thời gian' : 'Created'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.channel}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.action}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                        {item.target}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 max-w-[280px] truncate">
                        {item.summary}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            item.status === 'success'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {item.status === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{item.status}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {item.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* CONFIRM SEND GMAIL MODAL */}
      {confirmSendEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {lang === 'vi' ? 'Xác nhận gửi Email qua Gmail' : 'Confirm Gmail Incident Email'}
            </h3>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <p><strong className="text-slate-900 dark:text-white">To:</strong> {emailTo}</p>
              <p><strong className="text-slate-900 dark:text-white">Subject:</strong> {emailSubject}</p>
              <p className="whitespace-pre-wrap line-clamp-4">{emailBody}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSendEmail(false)}
                disabled={sendingEmail}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSendEmail()}
                disabled={sendingEmail}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {sendingEmail
                  ? lang === 'vi'
                    ? 'Đang gửi...'
                    : 'Sending...'
                  : lang === 'vi'
                  ? 'Xác nhận gửi'
                  : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM SEND GOOGLE CHAT MODAL */}
      {confirmSendChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {lang === 'vi' ? 'Xác nhận đăng cảnh báo Google Chat' : 'Confirm Google Chat Alert'}
            </h3>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <p>
                <strong className="text-slate-900 dark:text-white">Space:</strong>{' '}
                {activeSpaceMeta?.displayName || selectedSpace}
              </p>
              <p className="whitespace-pre-wrap">{chatDraft}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSendChat(false)}
                disabled={sendingChat}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSendChat()}
                disabled={sendingChat}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {sendingChat
                  ? lang === 'vi'
                    ? 'Đang gửi...'
                    : 'Posting...'
                  : lang === 'vi'
                  ? 'Xác nhận đăng'
                  : 'Confirm & Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM GITHUB WORKFLOW DISPATCH MODAL */}
      {dispatchTargetWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {lang === 'vi' ? 'Xác nhận chạy GitHub Workflow' : 'Confirm GitHub Workflow Trigger'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedRepoSlug} · <span className="font-semibold text-slate-900 dark:text-white">{dispatchTargetWorkflow.name}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'vi' ? 'Nhánh / Tag (git ref)' : 'Branch / Tag (git ref)'}
                </label>
                <input
                  type="text"
                  value={dispatchRef}
                  onChange={(e) => setDispatchRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'vi' ? 'Ghi chú triển khai (tùy chọn)' : 'Deployment note (optional)'}
                </label>
                <input
                  type="text"
                  value={dispatchNote}
                  onChange={(e) => setDispatchNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchTargetWorkflow(null)}
                disabled={dispatching}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDispatch()}
                disabled={dispatching || !dispatchRef.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60"
              >
                {dispatching
                  ? lang === 'vi'
                    ? 'Đang kích hoạt...'
                    : 'Triggering...'
                  : lang === 'vi'
                  ? 'Chạy Workflow'
                  : 'Run Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
