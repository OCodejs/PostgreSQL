export type Language = 'vi' | 'en';

export type NavSection =
  | 'overview'
  | 'blueprints'
  | 'optimization'
  | 'backups'
  | 'security'
  | 'cicd'
  | 'integrations';

export interface ClusterConfig {
  brandName: string;
  repoSlug: string;
  pgVersion: '16' | '17';
  dbName: string;
  dbUser: string;
  tlsMode: 'verify-full' | 'verify-ca' | 'require';
  sharedBuffers: string;
  maxConnections: number;
  redisMaxMemory: string;
  redisEvictionPolicy: 'allkeys-lru' | 'volatile-lru' | 'allkeys-lfu';
  s3Bucket: string;
  s3Region: string;
  backupCron: string;
  retentionDays: number;
  slackChannel: string;
  minReplicas: number;
  maxReplicas: number;
  targetCpuPercent: number;
  enableE2EE: boolean;
  enforce2FA: boolean;
}

export interface ClusterNode {
  id: string;
  name: string;
  role: 'primary' | 'replica' | 'redis' | 'storage-shard';
  region: string;
  cpuPercent: number;
  memoryPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  replicationLagMs: number;
  tlsStatus: string;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface TelemetryPoint {
  timestamp: string;
  qps: number;
  p95LatencyMs: number;
  cacheHitRatio: number;
  activeConnections: number;
  cpuAvg: number;
}

export interface SqlOptimizationCase {
  id: string;
  titleVi: string;
  titleEn: string;
  table: string;
  frequencyPerMin: number;
  beforeLatencyMs: number;
  afterLatencyMs: number;
  slowSql: string;
  optimizedSql: string;
  indexDdl: string;
  redisStrategyVi: string;
  redisStrategyEn: string;
  explainBefore: string[];
  explainAfter: string[];
  applied: boolean;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  type: 'full' | 'wal-incremental';
  sizeGb: number;
  s3Path: string;
  encryption: string;
  durationSec: number;
  verified: boolean;
}

export interface SlackAlertEvent {
  id: string;
  time: string;
  severity: 'info' | 'warning' | 'critical';
  rule: string;
  messageVi: string;
  messageEn: string;
  channel: string;
}

export interface PeriodicReport {
  id: string;
  periodVi: string;
  periodEn: string;
  avgQps: number;
  p95LatencyMs: number;
  uptimePercent: number;
  cacheHitPercent: number;
  s3BackupSuccessRate: number;
  summaryVi: string;
  summaryEn: string;
}

export interface TeamMemberSecurity {
  id: string;
  email: string;
  role: 'Owner' | 'SRE Admin' | 'Developer';
  twoFactorEnabled: boolean;
  keyFingerprint: string;
  lastActive: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scope: 'read:metrics' | 'write:storage' | 'admin:cluster';
  createdAt: string;
  lastUsed: string;
  active: boolean;
}

export interface GeneratedFile {
  id: string;
  path: string;
  category: 'docker' | 'database' | 'monitoring' | 'backup' | 'cicd' | 'cache';
  language: 'yaml' | 'conf' | 'bash' | 'json' | 'typescript';
  descriptionVi: string;
  descriptionEn: string;
  content: string;
}

export interface IntegrationAuditEntry {
  id: string;
  channel: 'gmail' | 'google-chat' | 'github';
  action: 'incident-email' | 'cluster-alert' | 'workflow-dispatch';
  target: string;
  summary: string;
  status: 'success' | 'failed';
  createdAt: string;
}
