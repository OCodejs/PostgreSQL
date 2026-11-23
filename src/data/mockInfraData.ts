import {
  ApiKeyItem,
  BackupSnapshot,
  ClusterConfig,
  ClusterNode,
  PeriodicReport,
  SlackAlertEvent,
  SqlOptimizationCase,
  TeamMemberSecurity,
  TelemetryPoint,
} from '../types/infra';

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  brandName: 'ocodejs',
  repoSlug: 'ocodejs/ocodejs',
  pgVersion: '17',
  dbName: 'ocodejs_prod',
  dbUser: 'ocodejs_admin',
  tlsMode: 'verify-full',
  sharedBuffers: '2GB',
  maxConnections: 250,
  redisMaxMemory: '1024mb',
  redisEvictionPolicy: 'allkeys-lru',
  s3Bucket: 'ocodejs-pg-backups-prod',
  s3Region: 'ap-southeast-1',
  backupCron: '0 2 * * *',
  retentionDays: 30,
  slackChannel: '#ocodejs-infra-alerts',
  minReplicas: 2,
  maxReplicas: 8,
  targetCpuPercent: 70,
  enableE2EE: true,
  enforce2FA: true,
};

export const INITIAL_NODES: ClusterNode[] = [
  {
    id: 'node-pg-1',
    name: 'ocodejs-pg-primary-01',
    role: 'primary',
    region: 'ap-southeast-1a',
    cpuPercent: 34,
    memoryPercent: 58,
    diskUsedGb: 142,
    diskTotalGb: 500,
    replicationLagMs: 0,
    tlsStatus: 'TLS 1.3 · verify-full',
    status: 'healthy',
  },
  {
    id: 'node-pg-2',
    name: 'ocodejs-pg-replica-02',
    role: 'replica',
    region: 'ap-southeast-1b',
    cpuPercent: 21,
    memoryPercent: 49,
    diskUsedGb: 142,
    diskTotalGb: 500,
    replicationLagMs: 3.4,
    tlsStatus: 'TLS 1.3 · verify-full',
    status: 'healthy',
  },
  {
    id: 'node-redis-1',
    name: 'ocodejs-redis-cache-01',
    role: 'redis',
    region: 'ap-southeast-1a',
    cpuPercent: 18,
    memoryPercent: 62,
    diskUsedGb: 14,
    diskTotalGb: 64,
    replicationLagMs: 0.8,
    tlsStatus: 'TLS 1.3 · mTLS',
    status: 'healthy',
  },
  {
    id: 'node-shard-3',
    name: 'ocodejs-storage-shard-03',
    role: 'storage-shard',
    region: 'ap-southeast-1c',
    cpuPercent: 28,
    memoryPercent: 53,
    diskUsedGb: 318,
    diskTotalGb: 1000,
    replicationLagMs: 4.1,
    tlsStatus: 'TLS 1.3 · E2EE',
    status: 'healthy',
  },
];

export const INITIAL_TELEMETRY: TelemetryPoint[] = [
  { timestamp: '05:50', qps: 1840, p95LatencyMs: 14.2, cacheHitRatio: 94.1, activeConnections: 82, cpuAvg: 31 },
  { timestamp: '05:54', qps: 1960, p95LatencyMs: 15.1, cacheHitRatio: 94.6, activeConnections: 88, cpuAvg: 33 },
  { timestamp: '05:58', qps: 2110, p95LatencyMs: 15.8, cacheHitRatio: 95.0, activeConnections: 91, cpuAvg: 35 },
  { timestamp: '06:02', qps: 2040, p95LatencyMs: 14.9, cacheHitRatio: 95.3, activeConnections: 86, cpuAvg: 34 },
  { timestamp: '06:06', qps: 2290, p95LatencyMs: 16.4, cacheHitRatio: 95.8, activeConnections: 97, cpuAvg: 37 },
  { timestamp: '06:10', qps: 2180, p95LatencyMs: 14.5, cacheHitRatio: 96.2, activeConnections: 92, cpuAvg: 34 },
  { timestamp: '06:12', qps: 2245, p95LatencyMs: 14.1, cacheHitRatio: 96.4, activeConnections: 94, cpuAvg: 35 },
];

export const SQL_OPTIMIZATION_CASES: SqlOptimizationCase[] = [
  {
    id: 'opt-1',
    titleVi: 'Truy vấn phân trang nhật ký phân mảnh theo workspace_id',
    titleEn: 'Workspace storage shard timeline pagination query',
    table: 'storage_objects',
    frequencyPerMin: 420,
    beforeLatencyMs: 184.6,
    afterLatencyMs: 2.3,
    slowSql: `SELECT id, object_key, size_bytes, created_at
FROM storage_objects
WHERE workspace_id = 'ws_9481' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 2000;`,
    optimizedSql: `SELECT id, object_key, size_bytes, created_at
FROM storage_objects
WHERE workspace_id = $1
  AND deleted_at IS NULL
  AND created_at < $2
ORDER BY created_at DESC
LIMIT 50;`,
    indexDdl: `CREATE INDEX CONCURRENTLY idx_storage_objects_ws_active_created
ON storage_objects (workspace_id, created_at DESC)
WHERE deleted_at IS NULL;`,
    redisStrategyVi: 'Lưu trang đầu tiên (page 1) vào Redis Hash với khóa `ws:{id}:objects:latest`, TTL 45s và tự xóa cache khi có sự kiện upload/delete.',
    redisStrategyEn: 'Cache page-1 slice in Redis under `ws:{id}:objects:latest` with 45s TTL and invalidate on write webhook.',
    explainBefore: [
      'Limit (cost=14280.12..14281.40 rows=50 width=72) (actual time=181.2..184.6ms)',
      '  -> Sort (cost=14120.00..14245.50 rows=50200) (Method: external merge Disk: 4120kB)',
      '        -> Seq Scan on storage_objects (Filter: workspace_id = ws_9481 AND deleted_at IS NULL)',
    ],
    explainAfter: [
      'Limit (cost=0.43..18.92 rows=50 width=72) (actual time=0.28..2.31ms)',
      '  -> Index Only Scan using idx_storage_objects_ws_active_created on storage_objects',
      '        Index Cond: (workspace_id = $1 AND created_at < $2) · Heap Fetches: 0',
    ],
    applied: false,
  },
  {
    id: 'opt-2',
    titleVi: 'Kiểm tra quyền & khóa E2EE theo JSONB metadata',
    titleEn: 'E2EE key metadata & ACL lookup via JSONB containment',
    table: 'object_acl_keys',
    frequencyPerMin: 890,
    beforeLatencyMs: 92.4,
    afterLatencyMs: 1.4,
    slowSql: `SELECT key_envelope, role
FROM object_acl_keys
WHERE metadata->>'tenant_tier' = 'enterprise'
  AND user_id = 'usr_3301';`,
    optimizedSql: `SELECT key_envelope, role
FROM object_acl_keys
WHERE user_id = $1
  AND metadata @> '{"tenant_tier":"enterprise"}'::jsonb;`,
    indexDdl: `CREATE INDEX CONCURRENTLY idx_acl_user_meta_gin
ON object_acl_keys USING GIN (metadata jsonb_path_ops)
INCLUDE (key_envelope); -- hoặc B-Tree (user_id) + GIN`,
    redisStrategyVi: 'Đưa ACL envelope đã giải mã metadata vào Redis với TTL 300s + Jitter (±10%), giảm 88% tải đọc trực tiếp xuống PostgreSQL Primary.',
    redisStrategyEn: 'Cache verified ACL key envelopes in Redis with 300s + 10% jitter TTL, offloading 88% of reads from Primary.',
    explainBefore: [
      'Seq Scan on object_acl_keys (actual time=88.9..92.4ms)',
      "  Filter: ((metadata ->> 'tenant_tier') = 'enterprise' AND user_id = 'usr_3301')",
      '  Rows Removed by Filter: 184,920',
    ],
    explainAfter: [
      'Bitmap Heap Scan on object_acl_keys (actual time=0.41..1.42ms)',
      '  Recheck Cond: (user_id = $1 AND metadata @> \'{"tenant_tier":"enterprise"}\')',
      '  -> Bitmap Index Scan on idx_acl_user_meta_gin · Buffers: shared hit=4',
    ],
    applied: false,
  },
  {
    id: 'opt-3',
    titleVi: 'Tổng hợp dung lượng cụm lưu trữ theo thời gian thực',
    titleEn: 'Real-time storage quota aggregation per organization',
    table: 'shard_usage_ledger',
    frequencyPerMin: 160,
    beforeLatencyMs: 310.0,
    afterLatencyMs: 0.9,
    slowSql: `SELECT org_id, SUM(bytes_allocated) AS total_bytes
FROM shard_usage_ledger
GROUP BY org_id;`,
    optimizedSql: `-- Đọc từ Materialized Summary / Redis Counter (INCRBY)
SELECT org_id, total_bytes, updated_at
FROM org_quota_rollup
WHERE org_id = $1;`,
    indexDdl: `CREATE TABLE IF NOT EXISTS org_quota_rollup (
  org_id TEXT PRIMARY KEY,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    redisStrategyVi: 'Duy trì bộ đếm nguyên tử `HINCRBY ocodejs:quota {org_id} {delta}` trên Redis và đồng bộ bất đồng bộ về bảng `org_quota_rollup` mỗi 10s.',
    redisStrategyEn: 'Maintain atomic `HINCRBY ocodejs:quota {org_id} {delta}` in Redis with 10s async flush to `org_quota_rollup`.',
    explainBefore: [
      'HashAggregate (actual time=295.4..310.0ms)',
      '  -> Parallel Seq Scan on shard_usage_ledger (rows=1,420,000)',
    ],
    explainAfter: [
      'Index Scan using org_quota_rollup_pkey (actual time=0.14..0.88ms)',
      '  Index Cond: (org_id = $1) · Redis Cache Hit: 99.1%',
    ],
    applied: false,
  },
];

export const INITIAL_BACKUPS: BackupSnapshot[] = [
  {
    id: 'snap-20261123-0200',
    createdAt: '2026-11-23 02:00:04 UTC',
    type: 'full',
    sizeGb: 48.6,
    s3Path: 's3://ocodejs-pg-backups-prod/backups/20261123/full.sql.zst.gpg',
    encryption: 'AES-256-GCM + SSE-S3',
    durationSec: 112,
    verified: true,
  },
  {
    id: 'snap-20261123-0500',
    createdAt: '2026-11-23 05:00:02 UTC',
    type: 'wal-incremental',
    sizeGb: 1.9,
    s3Path: 's3://ocodejs-pg-backups-prod/wal/20261123/00000001000000A4.zst.gpg',
    encryption: 'AES-256-GCM + SSE-S3',
    durationSec: 9,
    verified: true,
  },
  {
    id: 'snap-20261122-0200',
    createdAt: '2026-11-22 02:00:05 UTC',
    type: 'full',
    sizeGb: 47.9,
    s3Path: 's3://ocodejs-pg-backups-prod/backups/20261122/full.sql.zst.gpg',
    encryption: 'AES-256-GCM + SSE-S3',
    durationSec: 109,
    verified: true,
  },
];

export const INITIAL_SLACK_ALERTS: SlackAlertEvent[] = [
  {
    id: 'evt-1',
    time: '06:05:14',
    severity: 'info',
    rule: 'S3BackupVerified',
    messageVi: 'Bản sao lưu WAL 05:00 UTC đã tải lên S3 và kiểm tra SHA-256 thành công.',
    messageEn: 'WAL snapshot 05:00 UTC uploaded to AWS S3 and SHA-256 checksum verified.',
    channel: '#ocodejs-infra-alerts',
  },
  {
    id: 'evt-2',
    time: '04:18:42',
    severity: 'info',
    rule: 'DeploymentSucceeded',
    messageVi: 'CI/CD triển khai phiên bản ocodejs/ocodejs@8c4f21a không gián đoạn (0ms downtime).',
    messageEn: 'CI/CD rolled out ocodejs/ocodejs@8c4f21a cleanly with zero downtime.',
    channel: '#ocodejs-infra-alerts',
  },
];

export const PERIODIC_REPORTS: PeriodicReport[] = [
  {
    id: 'rep-weekly',
    periodVi: 'Báo cáo tuần · 16/11 – 23/11/2026',
    periodEn: 'Weekly Digest · Nov 16 – Nov 23, 2026',
    avgQps: 2140,
    p95LatencyMs: 14.8,
    uptimePercent: 99.998,
    cacheHitPercent: 96.1,
    s3BackupSuccessRate: 100,
    summaryVi: 'Hiệu năng ổn định ở mức SLA 99.998%. Tỷ lệ trúng Redis đạt 96.1%, giảm 64% số lần quét đĩa trên PostgreSQL Primary.',
    summaryEn: 'Cluster maintained 99.998% uptime. Redis cache hit ratio reached 96.1%, reducing disk IOPS on Primary by 64%.',
  },
  {
    id: 'rep-monthly',
    periodVi: 'Báo cáo tháng · Tháng 11/2026',
    periodEn: 'Monthly Audit · November 2026',
    avgQps: 1985,
    p95LatencyMs: 16.2,
    uptimePercent: 99.995,
    cacheHitPercent: 95.4,
    s3BackupSuccessRate: 100,
    summaryVi: 'Đã hoàn thành 23 bản sao lưu toàn phần và 540 phân đoạn WAL lên AWS S3. Độ trễ trung bình giảm 18% sau khi tối ưu chỉ mục GIN.',
    summaryEn: 'Completed 23 full snapshots and 540 WAL archives to AWS S3. Mean query latency improved 18% following GIN index tuning.',
  },
];

export const INITIAL_TEAM_SECURITY: TeamMemberSecurity[] = [
  {
    id: 'tm-1',
    email: 'lead-sre@ocodejs.dev',
    role: 'Owner',
    twoFactorEnabled: true,
    keyFingerprint: 'ed25519:8a9c...41e2',
    lastActive: '2m ago',
  },
  {
    id: 'tm-2',
    email: 'db-ops@ocodejs.dev',
    role: 'SRE Admin',
    twoFactorEnabled: true,
    keyFingerprint: 'ed25519:3f12...9b04',
    lastActive: '19m ago',
  },
  {
    id: 'tm-3',
    email: 'storage-dev@ocodejs.dev',
    role: 'Developer',
    twoFactorEnabled: false,
    keyFingerprint: 'ed25519:7c01...2d88',
    lastActive: '1h ago',
  },
];

export const INITIAL_API_KEYS: ApiKeyItem[] = [
  {
    id: 'key-1',
    name: 'Grafana Cloud External Sync',
    prefix: 'ocj_live_94f2a1...',
    scope: 'read:metrics',
    createdAt: '2026-10-14',
    lastUsed: '4m ago',
    active: true,
  },
  {
    id: 'key-2',
    name: 'Partner Storage Webhook',
    prefix: 'ocj_live_31c8b7...',
    scope: 'write:storage',
    createdAt: '2026-11-02',
    lastUsed: '12m ago',
    active: true,
  },
];
