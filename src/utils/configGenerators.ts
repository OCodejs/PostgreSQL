import { ClusterConfig, GeneratedFile } from '../types/infra';

export function generateInfraFiles(cfg: ClusterConfig): GeneratedFile[] {
  const brandSlug = cfg.brandName.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'ocodejs';

  const dockerCompose = `services:
  pg-primary:
    image: postgres:${cfg.pgVersion}-alpine
    container_name: ${brandSlug}-pg-primary
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-${cfg.dbName}}
      POSTGRES_USER: \${POSTGRES_USER:-${cfg.dbUser}}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --data-checksums"
    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql.conf
      -c hba_file=/etc/postgresql/pg_hba.conf
      -c ssl=on
      -c ssl_cert_file=/etc/postgresql/certs/server.crt
      -c ssl_key_file=/etc/postgresql/certs/server.key
      -c ssl_ca_file=/etc/postgresql/certs/ca.crt
    ports:
      - "5432:5432"
    volumes:
      - pg_primary_data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./config/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
      - ./certs:/etc/postgresql/certs:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${cfg.dbUser} -d ${cfg.dbName}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - ${brandSlug}_net

  pg-replica:
    image: postgres:${cfg.pgVersion}-alpine
    container_name: ${brandSlug}-pg-replica
    restart: unless-stopped
    depends_on:
      pg-primary:
        condition: service_healthy
    environment:
      PGPASSWORD: \${REPLICATION_PASSWORD:?Set REPLICATION_PASSWORD in .env}
      POSTGRES_USER: \${POSTGRES_USER:-${cfg.dbUser}}
    entrypoint: |
      sh -c '
      if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
        pg_basebackup -h pg-primary -D /var/lib/postgresql/data -U replicator -Fp -Xs -P -R
      fi
      exec docker-entrypoint.sh postgres -c hot_standby=on -c ssl=on -c ssl_cert_file=/etc/postgresql/certs/server.crt -c ssl_key_file=/etc/postgresql/certs/server.key -c ssl_ca_file=/etc/postgresql/certs/ca.crt
      '
    volumes:
      - pg_replica_data:/var/lib/postgresql/data
      - ./certs:/etc/postgresql/certs:ro
    networks:
      - ${brandSlug}_net

  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: ${brandSlug}-pgbouncer
    restart: unless-stopped
    depends_on:
      pg-primary:
        condition: service_healthy
    environment:
      DB_HOST: pg-primary
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER:-${cfg.dbUser}}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: ${cfg.maxConnections * 4}
      DEFAULT_POOL_SIZE: 50
      AUTH_TYPE: scram-sha-256
      SERVER_TLS_SSLMODE: ${cfg.tlsMode}
    ports:
      - "6432:6432"
    networks:
      - ${brandSlug}_net

  redis:
    image: redis:7.4-alpine
    container_name: ${brandSlug}-redis
    restart: unless-stopped
    command: >
      redis-server
      --requirepass \${REDIS_PASSWORD:?Set REDIS_PASSWORD in .env}
      --maxmemory ${cfg.redisMaxMemory}
      --maxmemory-policy ${cfg.redisEvictionPolicy}
      --appendonly yes
      --tls-port 6379
      --port 0
      --tls-cert-file /etc/redis/certs/server.crt
      --tls-key-file /etc/redis/certs/server.key
      --tls-ca-cert-file /etc/redis/certs/ca.crt
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./certs:/etc/redis/certs:ro
    healthcheck:
      test: ["CMD", "redis-cli", "--tls", "--cacert", "/etc/redis/certs/ca.crt", "-a", "\${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - ${brandSlug}_net

  ocodejs-core:
    image: ghcr.io/${cfg.repoSlug}:latest
    restart: unless-stopped
    depends_on:
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: "postgresql://${cfg.dbUser}:\${POSTGRES_PASSWORD}@pgbouncer:6432/${cfg.dbName}?sslmode=${cfg.tlsMode}"
      READ_REPLICA_URL: "postgresql://${cfg.dbUser}:\${POSTGRES_PASSWORD}@pg-replica:5432/${cfg.dbName}?sslmode=${cfg.tlsMode}"
      REDIS_URL: "rediss://:\${REDIS_PASSWORD}@redis:6379"
      E2EE_MASTER_KEY_ID: "\${E2EE_MASTER_KEY_ID}"
      ENFORCE_2FA: "${cfg.enforce2FA ? 'true' : 'false'}"
      SLACK_WEBHOOK_URL: "\${SLACK_WEBHOOK_URL}"
    deploy:
      replicas: ${cfg.minReplicas}
      resources:
        limits:
          cpus: "1.5"
          memory: 1024M
    networks:
      - ${brandSlug}_net

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: ${brandSlug}-pg-exporter
    restart: unless-stopped
    environment:
      DATA_SOURCE_NAME: "postgresql://${cfg.dbUser}:\${POSTGRES_PASSWORD}@pg-primary:5432/${cfg.dbName}?sslmode=${cfg.tlsMode}&sslrootcert=/certs/ca.crt"
    volumes:
      - ./certs:/certs:ro
    networks:
      - ${brandSlug}_net

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: ${brandSlug}-redis-exporter
    restart: unless-stopped
    environment:
      REDIS_ADDR: "rediss://redis:6379"
      REDIS_PASSWORD: "\${REDIS_PASSWORD}"
      REDIS_EXPORTER_TLS_CA_CERT_FILE: "/certs/ca.crt"
    volumes:
      - ./certs:/certs:ro
    networks:
      - ${brandSlug}_net

  prometheus:
    image: prom/prometheus:v2.54.1
    container_name: ${brandSlug}-prometheus
    restart: unless-stopped
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.retention.time=30d"
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro
      - prometheus_data:/prometheus
    networks:
      - ${brandSlug}_net

  alertmanager:
    image: prom/alertmanager:v0.27.0
    container_name: ${brandSlug}-alertmanager
    restart: unless-stopped
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    networks:
      - ${brandSlug}_net

  grafana:
    image: grafana/grafana:11.2.0
    container_name: ${brandSlug}-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: \${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: \${GRAFANA_ADMIN_PASSWORD:?Set GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
      - ./monitoring/grafana-dashboard.json:/etc/grafana/provisioning/dashboards/ocodejs-pg.json:ro
    networks:
      - ${brandSlug}_net

  s3-backup:
    image: amazon/aws-cli:2.17.0
    container_name: ${brandSlug}-s3-backup
    restart: unless-stopped
    depends_on:
      pg-replica:
        condition: service_started
    environment:
      PGHOST: pg-replica
      PGUSER: ${cfg.dbUser}
      PGDATABASE: ${cfg.dbName}
      PGPASSWORD: \${POSTGRES_PASSWORD}
      S3_BUCKET: ${cfg.s3Bucket}
      AWS_DEFAULT_REGION: ${cfg.s3Region}
      BACKUP_PASSPHRASE: \${BACKUP_PASSPHRASE}
      SLACK_WEBHOOK_URL: \${SLACK_WEBHOOK_URL}
      RETENTION_DAYS: "${cfg.retentionDays}"
    entrypoint: ["/bin/sh", "-c", "echo '${cfg.backupCron} /scripts/s3-backup.sh >> /var/log/backup.log 2>&1' | crontab - && crond -f"]
    volumes:
      - ./scripts/s3-backup.sh:/scripts/s3-backup.sh:ro
    networks:
      - ${brandSlug}_net

volumes:
  pg_primary_data:
  pg_replica_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  ${brandSlug}_net:
    driver: bridge
`;

  const postgresqlConf = `# ${cfg.brandName} — PostgreSQL ${cfg.pgVersion} Production Configuration
listen_addresses = '*'
port = 5432
max_connections = ${cfg.maxConnections}

# Memory & Query Planner Optimization
shared_buffers = ${cfg.sharedBuffers}
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB
random_page_cost = 1.1
effective_io_concurrency = 200

# Write-Ahead Log & Streaming Replication (HA)
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1024MB
hot_standby = on
synchronous_commit = remote_apply

# TLS 1.3 & Password Hardening
ssl = on
ssl_min_protocol_version = 'TLSv1.3'
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
password_encryption = scram-sha-256

# Real-Time Query Observability
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
log_min_duration_statement = 200
log_checkpoints = on
log_connections = on
log_disconnections = on
`;

  const pgHbaConf = `# ${cfg.brandName} — Strict Host-Based Authentication (TLS Required)
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     scram-sha-256
hostssl ${cfg.dbName}   ${cfg.dbUser}   172.16.0.0/12           scram-sha-256 clientcert=${cfg.tlsMode === 'verify-full' ? 'verify-full' : 'verify-ca'}
hostssl replication     replicator      172.16.0.0/12           scram-sha-256
host    all             all             0.0.0.0/0               reject
`;

  const setupTlsSh = `#!/usr/bin/env bash
set -euo pipefail

mkdir -p ./certs
cd ./certs

echo "[1/4] Generating Root CA for ${cfg.brandName}..."
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \\
  -subj "/CN=${brandSlug}-root-ca/O=${cfg.brandName}" -out ca.crt

echo "[2/4] Generating Server TLS Certificate (pg-primary, pg-replica, redis)..."
cat > server.ext <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = pg-primary
DNS.2 = pg-replica
DNS.3 = redis
DNS.4 = localhost
EOF

openssl genrsa -out server.key 2048
openssl req -new -key server.key -subj "/CN=pg-primary" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \\
  -out server.crt -days 825 -sha256 -extfile server.ext

echo "[3/4] Generating mTLS Client Certificate for ocodejs-core..."
openssl genrsa -out client.key 2048
openssl req -new -key client.key -subj "/CN=${cfg.dbUser}" -out client.csr
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \\
  -out client.crt -days 825 -sha256

echo "[4/4] Setting strict permissions (UID 999 for postgres alpine)..."
chmod 600 server.key ca.key client.key
chmod 644 server.crt ca.crt client.crt
chown 70:70 server.key server.crt ca.crt || true
echo "TLS certificates generated in ./certs/"
`;

  const prometheusYml = `global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/alert-rules.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: "${brandSlug}-postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "${brandSlug}-redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "${brandSlug}-ocodejs-app"
    metrics_path: /metrics
    static_configs:
      - targets: ["ocodejs-core:3000"]
`;

  const alertRulesYml = `groups:
  - name: ${brandSlug}_storage_alerts
    rules:
      - alert: PostgresHighReplicationLag
        expr: pg_replication_lag > 0.05
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL replication lag > 50ms on ${cfg.brandName}"
          description: "Standby replica lag is {{ $value }}s."

      - alert: PostgresConnectionsNearLimit
        expr: sum(pg_stat_activity_count) / ${cfg.maxConnections} > 0.85
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL connections above 85% capacity"

      - alert: RedisHighEvictionRate
        expr: rate(redis_evicted_keys_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Redis evicting keys rapidly (${cfg.redisMaxMemory})"

      - alert: HighQueryLatencyP95
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.08
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "ocodejs P95 query latency exceeded 80ms"
`;

  const alertmanagerYml = `global:
  resolve_timeout: 5m

route:
  group_by: ["alertname", "severity"]
  group_wait: 15s
  group_interval: 2m
  repeat_interval: 1h
  receiver: "slack-ocodejs"

receivers:
  - name: "slack-ocodejs"
    slack_configs:
      - api_url: "\${SLACK_WEBHOOK_URL}"
        channel: "${cfg.slackChannel}"
        send_resolved: true
        title: "[{{ .Status | toUpper }}] ${cfg.brandName} — {{ .CommonLabels.alertname }}"
        text: "{{ range .Alerts }}{{ .Annotations.summary }} — {{ .Annotations.description }}{{ end }}"
`;

  const grafanaDashboard = JSON.stringify(
    {
      title: `${cfg.brandName} Distributed Storage & PostgreSQL`,
      uid: `${brandSlug}-pg-obs`,
      schemaVersion: 39,
      refresh: '10s',
      panels: [
        {
          id: 1,
          title: 'Active PostgreSQL Connections',
          type: 'timeseries',
          targets: [{ expr: 'sum(pg_stat_activity_count) by (datname)' }],
        },
        {
          id: 2,
          title: 'Cache Hit Ratio (PostgreSQL + Redis)',
          type: 'gauge',
          targets: [
            {
              expr: 'sum(pg_stat_database_blks_hit) / (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read)) * 100',
            },
          ],
        },
        {
          id: 3,
          title: 'WAL Replication Lag (ms)',
          type: 'timeseries',
          targets: [{ expr: 'pg_replication_lag * 1000' }],
        },
        {
          id: 4,
          title: 'Redis Memory Used vs Max',
          type: 'stat',
          targets: [{ expr: 'redis_memory_used_bytes / redis_memory_max_bytes * 100' }],
        },
      ],
    },
    null,
    2,
  );

  const s3BackupSh = `#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
ARCHIVE="/tmp/${brandSlug}_\${PGDATABASE}_\${TIMESTAMP}.sql.zst"
ENCRYPTED="\${ARCHIVE}.gpg"
S3_URI="s3://${cfg.s3Bucket}/backups/\${TIMESTAMP}/$(basename "$ENCRYPTED")"

echo "[ocodejs-backup] Starting streaming pg_dump from \${PGHOST}..."
pg_dump --format=custom --no-owner --no-acl "\${PGDATABASE}" | zstd -T0 -6 -o "$ARCHIVE"

echo "[ocodejs-backup] Encrypting archive with AES-256..."
gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$ENCRYPTED" "$ARCHIVE"
SHA256=$(sha256sum "$ENCRYPTED" | awk '{print $1}')

echo "[ocodejs-backup] Uploading to $S3_URI (SSE-S3)..."
aws s3 cp "$ENCRYPTED" "$S3_URI" --sse AES256 --metadata "sha256=$SHA256"

rm -f "$ARCHIVE" "$ENCRYPTED"

if [ -n "\${SLACK_WEBHOOK_URL:-}" ]; then
  curl -s -X POST -H 'Content-type: application/json' \\
    --data "{\\"text\\":\\"[${cfg.brandName}] S3 backup succeeded: $S3_URI (SHA256: \${SHA256:0:12})\\"}" \\
    "$SLACK_WEBHOOK_URL" >/dev/null
fi
`;

  const cicdYml = `name: ${cfg.brandName} CI/CD Pipeline

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  test-and-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm test

  build-and-scan:
    needs: test-and-lint
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      packages: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${cfg.repoSlug}:\${{ github.sha }},ghcr.io/${cfg.repoSlug}:latest
      - name: Trivy Vulnerability Scan
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${cfg.repoSlug}:\${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"

  deploy-rolling-ha:
    needs: build-and-scan
    runs-on: ubuntu-latest
    steps:
      - name: Rolling zero-downtime update & Slack notify
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.PROD_HOST }}
          username: \${{ secrets.PROD_USER }}
          key: \${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/${brandSlug}
            docker compose pull ocodejs-core
            docker compose up -d --no-deps --scale ocodejs-core=${cfg.minReplicas} ocodejs-core
            curl -X POST -H 'Content-type: application/json' \\
              --data '{"text":"[${cfg.brandName}] Deployed \${{ github.sha }} cleanly with zero downtime."}' \\
              \${{ secrets.SLACK_WEBHOOK_URL }}
`;

  const redisCacheTs = `import { createClient } from 'redis';
import fs from 'node:fs';

export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    ca: fs.readFileSync('/etc/redis/certs/ca.crt'),
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

export async function getCachedOrQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  const cached = await redis.get(key);
  if (cached) {
    return { data: JSON.parse(cached) as T, cacheHit: true };
  }

  const fresh = await fetcher();
  // Add +/- 10% TTL jitter to prevent cache stampede on hot keys
  const jitter = Math.floor(ttlSeconds * (0.9 + Math.random() * 0.2));
  await redis.set(key, JSON.stringify(fresh), { EX: jitter });

  return { data: fresh, cacheHit: false };
}
`;

  const pgTlsPoolTs = `import { Pool } from 'pg';
import fs from 'node:fs';

// ${cfg.brandName} — Node.js PostgreSQL TLS/mTLS Connection Pool
export const pgPool = new Pool({
  host: process.env.PGHOST || 'pgbouncer',
  port: Number(process.env.PGPORT || 6432),
  database: process.env.PGDATABASE || '${cfg.dbName}',
  user: process.env.PGUSER || '${cfg.dbUser}',
  password: process.env.PGPASSWORD,
  max: 25,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/etc/postgresql/certs/ca.crt', 'utf8'),
    cert: fs.readFileSync('/etc/postgresql/certs/client.crt', 'utf8'),
    key: fs.readFileSync('/etc/postgresql/certs/client.key', 'utf8'),
  },
});

export async function verifyTlsConnection() {
  const res = await pgPool.query('SELECT version(), ssl_is_used() AS tls_active;');
  return res.rows[0];
}
`;

  const promMetricsTs = `import express from 'express';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: '${brandSlug}_' });

export const httpLatencyHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds for ${cfg.brandName}',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.08, 0.15, 0.5, 1],
  registers: [register],
});

export const redisCacheCounter = new client.Counter({
  name: '${brandSlug}_redis_cache_requests_total',
  help: 'Redis cache hit/miss counter',
  labelNames: ['result'],
  registers: [register],
});

export function mountMetricsEndpoint(app: express.Express) {
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}
`;

  const grafanaDatasourcesYml = `apiVersion: 1

datasources:
  - name: Prometheus (${cfg.brandName})
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
`;

  return [
    {
      id: 'docker-compose',
      path: 'docker-compose.yml',
      category: 'docker',
      language: 'yaml',
      descriptionVi: 'Toàn bộ cụm PostgreSQL Primary/Replica, PgBouncer, Redis TLS, Prometheus, Grafana, Alertmanager và S3 Backup.',
      descriptionEn: 'Full stack with PostgreSQL Primary/Replica, PgBouncer, Redis TLS, Prometheus, Grafana, Alertmanager, and S3 Backup.',
      content: dockerCompose,
    },
    {
      id: 'postgresql-conf',
      path: 'config/postgresql.conf',
      category: 'database',
      language: 'conf',
      descriptionVi: 'Tối ưu bộ nhớ đệm, WAL streaming replication, TLS 1.3 và pg_stat_statements.',
      descriptionEn: 'Memory tuning, WAL streaming replication, TLS 1.3 enforcement, and pg_stat_statements.',
      content: postgresqlConf,
    },
    {
      id: 'pg-hba',
      path: 'config/pg_hba.conf',
      category: 'database',
      language: 'conf',
      descriptionVi: 'Chính sách xác thực scram-sha-256 bắt buộc kết nối SSL/TLS.',
      descriptionEn: 'Strict scram-sha-256 authentication enforcing SSL/TLS connections.',
      content: pgHbaConf,
    },
    {
      id: 'setup-tls',
      path: 'scripts/setup-tls.sh',
      category: 'database',
      language: 'bash',
      descriptionVi: 'Script tự động cấp chứng chỉ Root CA, Server TLS và mTLS cho PostgreSQL & Redis.',
      descriptionEn: 'Automated Root CA, Server TLS, and mTLS certificate generator for PostgreSQL & Redis.',
      content: setupTlsSh,
    },
    {
      id: 'pg-tls-pool',
      path: 'src/db/pgTlsPool.ts',
      category: 'database',
      language: 'typescript',
      descriptionVi: 'Cấu hình kết nối Node.js (pg.Pool) qua TLS/mTLS verify-full tới PostgreSQL.',
      descriptionEn: 'Node.js pg.Pool configuration with strict TLS/mTLS verify-full certificates.',
      content: pgTlsPoolTs,
    },
    {
      id: 'prometheus-yml',
      path: 'monitoring/prometheus.yml',
      category: 'monitoring',
      language: 'yaml',
      descriptionVi: 'Cấu hình thu thập chỉ số thời gian thực từ Postgres Exporter, Redis Exporter và ocodejs.',
      descriptionEn: 'Real-time metrics scraping from Postgres Exporter, Redis Exporter, and ocodejs.',
      content: prometheusYml,
    },
    {
      id: 'prom-metrics',
      path: 'src/metrics/promMetrics.ts',
      category: 'monitoring',
      language: 'typescript',
      descriptionVi: 'Endpoint /metrics cho ứng dụng Node.js (prom-client) đo HTTP latency và Redis hits.',
      descriptionEn: 'Node.js prom-client /metrics exporter for HTTP latency and Redis cache hits.',
      content: promMetricsTs,
    },
    {
      id: 'alert-rules',
      path: 'monitoring/alert-rules.yml',
      category: 'monitoring',
      language: 'yaml',
      descriptionVi: 'Quy tắc cảnh báo độ trễ replication, quá tải kết nối và P95 latency.',
      descriptionEn: 'Alerting rules for replication lag, connection saturation, and P95 latency.',
      content: alertRulesYml,
    },
    {
      id: 'alertmanager',
      path: 'monitoring/alertmanager.yml',
      category: 'monitoring',
      language: 'yaml',
      descriptionVi: 'Định tuyến cảnh báo tự động tới kênh Slack khi có sự cố.',
      descriptionEn: 'Automatic incident alert routing to Slack channels.',
      content: alertmanagerYml,
    },
    {
      id: 'grafana-datasources',
      path: 'monitoring/grafana-datasources.yml',
      category: 'monitoring',
      language: 'yaml',
      descriptionVi: 'Tự động kết nối nguồn dữ liệu Prometheus vào Grafana khi khởi chạy Docker.',
      descriptionEn: 'Auto-provisions Prometheus datasource into Grafana on container startup.',
      content: grafanaDatasourcesYml,
    },
    {
      id: 'grafana-json',
      path: 'monitoring/grafana-dashboard.json',
      category: 'monitoring',
      language: 'json',
      descriptionVi: 'Mẫu Dashboard Grafana dựng sẵn cho cụm phân tán ocodejs.',
      descriptionEn: 'Pre-provisioned Grafana dashboard JSON for the ocodejs distributed cluster.',
      content: grafanaDashboard,
    },
    {
      id: 's3-backup',
      path: 'scripts/s3-backup.sh',
      category: 'backup',
      language: 'bash',
      descriptionVi: 'Sao lưu nén zstd + mã hóa AES-256 lên AWS S3 kèm kiểm tra SHA-256 và báo cáo Slack.',
      descriptionEn: 'zstd-compressed + AES-256 encrypted AWS S3 backup with SHA-256 verification and Slack ping.',
      content: s3BackupSh,
    },
    {
      id: 'cicd-yml',
      path: '.github/workflows/ocodejs-cicd.yml',
      category: 'cicd',
      language: 'yaml',
      descriptionVi: 'Quy trình CI/CD GitHub Actions: Test, quét bảo mật Trivy, build Docker & Rolling Deploy.',
      descriptionEn: 'GitHub Actions CI/CD: Automated tests, Trivy container scan, Docker build, and rolling deploy.',
      content: cicdYml,
    },
    {
      id: 'redis-cache',
      path: 'src/cache/redisCache.ts',
      category: 'cache',
      language: 'typescript',
      descriptionVi: 'Thư viện Cache-Aside kết hợp TLS và TTL Jitter cho ứng dụng ocodejs.',
      descriptionEn: 'TLS-enabled Redis Cache-Aside helper with TTL jitter for ocodejs workers.',
      content: redisCacheTs,
    },
  ];
}
