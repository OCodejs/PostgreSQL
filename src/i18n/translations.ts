import { Language } from '../types/infra';

export interface Translations {
  appName: string;
  nav: {
    overview: string;
    blueprints: string;
    optimization: string;
    backups: string;
    security: string;
    cicd: string;
    integrations: string;
  };
  breadcrumbs: {
    root: string;
    overview: string;
    blueprints: string;
    optimization: string;
    backups: string;
    security: string;
    cicd: string;
    integrations: string;
  };
  actions: {
    exportBundle: string;
    copy: string;
    copied: string;
    download: string;
    downloadInstaller: string;
    close: string;
    apply: string;
    applied: string;
    revert: string;
    simulateSurge: string;
    normalizeTraffic: string;
    triggerFailover: string;
    restorePrimary: string;
    runBackupNow: string;
    verifyChecksum: string;
    sendTestAlert: string;
    triggerPipeline: string;
    createApiKey: string;
    revoke: string;
    enable2FA: string;
    verifyCode: string;
    rotateKeys: string;
    exportReport: string;
  };
  overview: {
    title: string;
    subtitle: string;
    kpiQps: string;
    kpiLatency: string;
    kpiCacheHit: string;
    kpiReplicas: string;
    trafficTitle: string;
    trafficSubtitle: string;
    latencyChartTitle: string;
    cacheChartTitle: string;
    nodesTitle: string;
    nodesSubtitle: string;
    colNode: string;
    colRole: string;
    colCpuMem: string;
    colStorage: string;
    colLag: string;
    colTls: string;
    colStatus: string;
    autoScaleLabel: string;
    autoScaleActive: string;
    autoScaleNominal: string;
    reportsTitle: string;
    reportsSubtitle: string;
    slackFeedTitle: string;
  };
  blueprints: {
    title: string;
    subtitle: string;
    configPanelTitle: string;
    brandName: string;
    repoSlug: string;
    pgVersion: string;
    dbName: string;
    dbUser: string;
    tlsMode: string;
    sharedBuffers: string;
    maxConnections: string;
    redisMaxMemory: string;
    redisEviction: string;
    s3Bucket: string;
    s3Region: string;
    backupCron: string;
    retentionDays: string;
    slackChannel: string;
    minReplicas: string;
    maxReplicas: string;
    targetCpu: string;
    filesTitle: string;
    allCategories: string;
  };
  optimization: {
    title: string;
    subtitle: string;
    labTitle: string;
    beforeLabel: string;
    afterLabel: string;
    reductionLabel: string;
    slowSqlLabel: string;
    optimizedSqlLabel: string;
    indexDdlLabel: string;
    redisPatternLabel: string;
    explainPlanLabel: string;
    pgTuningGuideTitle: string;
    redisGuideTitle: string;
  };
  backups: {
    title: string;
    subtitle: string;
    haTitle: string;
    haDesc: string;
    rpoLabel: string;
    rtoLabel: string;
    s3Title: string;
    s3Desc: string;
    colSnapshotId: string;
    colTime: string;
    colType: string;
    colSize: string;
    colPath: string;
    colEncryption: string;
    colStatus: string;
    verifiedLabel: string;
    unverifiedLabel: string;
  };
  security: {
    title: string;
    subtitle: string;
    e2eeTitle: string;
    e2eeDesc: string;
    tlsTitle: string;
    tlsDesc: string;
    tfaTitle: string;
    tfaDesc: string;
    totpPrompt: string;
    totpPlaceholder: string;
    totpSuccess: string;
    totpError: string;
    teamTableTitle: string;
    colMember: string;
    colRole: string;
    col2FA: string;
    colFingerprint: string;
    colLastActive: string;
    enabled: string;
    pending: string;
  };
  cicd: {
    title: string;
    subtitle: string;
    pipelineTitle: string;
    pipelineDesc: string;
    slackTitle: string;
    slackDesc: string;
    apiTitle: string;
    apiDesc: string;
    keyNamePlaceholder: string;
    colKeyName: string;
    colPrefix: string;
    colScope: string;
    colStatus: string;
    sdkSnippetTitle: string;
  };
  exportModal: {
    title: string;
    subtitle: string;
    includedFiles: string;
    commandTitle: string;
  };
  statusLabels: {
    healthy: string;
    degraded: string;
    offline: string;
  };
}

export const translations: Record<Language, Translations> = {
  vi: {
    appName: 'ocodejs Infra',
    nav: {
      overview: 'Tổng quan & Giám sát',
      blueprints: 'Docker, TLS & Grafana',
      optimization: 'Tối ưu SQL & Redis',
      backups: 'Sao lưu S3 & HA',
      security: 'Bảo mật E2EE & 2FA',
      cicd: 'CI/CD, Slack & API',
      integrations: 'Gmail, Chat & GitHub',
    },
    breadcrumbs: {
      root: 'ocodejs/ocodejs',
      overview: 'Bảng điều khiển thời gian thực',
      blueprints: 'Kiến trúc Docker & Cấu hình',
      optimization: 'Tối ưu truy vấn & Bộ nhớ đệm',
      backups: 'Dự phòng HA & AWS S3',
      security: 'Mã hóa đầu cuối & Xác thực 2FA',
      cicd: 'Quy trình CI/CD & Tích hợp API',
      integrations: 'Trung tâm Tích hợp Gmail, Google Chat & GitHub',
    },
    actions: {
      exportBundle: 'Xuất gói triển khai',
      copy: 'Sao chép',
      copied: 'Đã sao chép',
      download: 'Tải xuống',
      downloadInstaller: 'Tải script cài đặt (.sh)',
      close: 'Đóng',
      apply: 'Áp dụng tối ưu',
      applied: 'Đã tối ưu',
      revert: 'Hoàn tác',
      simulateSurge: 'Mô phỏng tăng tải',
      normalizeTraffic: 'Ổn định lưu lượng',
      triggerFailover: 'Kiểm thử chuyển đổi dự phòng',
      restorePrimary: 'Khôi phục Primary',
      runBackupNow: 'Sao lưu S3 ngay',
      verifyChecksum: 'Kiểm tra toàn vẹn',
      sendTestAlert: 'Gửi cảnh báo Slack thử',
      triggerPipeline: 'Chạy CI/CD Pipeline',
      createApiKey: 'Tạo API Key',
      revoke: 'Thu hồi',
      enable2FA: 'Kích hoạt 2FA',
      verifyCode: 'Xác nhận mã TOTP',
      rotateKeys: 'Xoay vòng khóa E2EE',
      exportReport: 'Tải báo cáo JSON',
    },
    overview: {
      title: 'Trung tâm điều phối lưu trữ phân tán ocodejs',
      subtitle: 'Giám sát thời gian thực PostgreSQL HA, bộ đệm Redis, tự động mở rộng và cảnh báo Slack cho kho mã ocodejs/ocodejs.',
      kpiQps: 'Lưu lượng truy vấn',
      kpiLatency: 'Độ trễ P95',
      kpiCacheHit: 'Tỷ lệ trúng Redis',
      kpiReplicas: 'Node hoạt động',
      trafficTitle: 'Điều khiển tự động mở rộng (Auto-Scaling)',
      trafficSubtitle: 'Mô phỏng lưu lượng đột biến để kiểm tra cơ chế tự động thêm replica và cảnh báo Slack theo thời gian thực.',
      latencyChartTitle: 'Thông lượng (QPS) & Độ trễ P95 (ms)',
      cacheChartTitle: 'Hiệu quả bộ nhớ đệm Redis (%) & Kết nối hoạt động',
      nodesTitle: 'Cụm máy chủ phân tán & Độ trễ đồng bộ',
      nodesSubtitle: 'Trạng thái phần cứng, chứng chỉ TLS 1.3 và độ trễ WAL replication trên từng container.',
      colNode: 'Tên Node',
      colRole: 'Vai trò',
      colCpuMem: 'CPU / RAM',
      colStorage: 'Dung lượng',
      colLag: 'Độ trễ WAL',
      colTls: 'Mã hóa TLS',
      colStatus: 'Trạng thái',
      autoScaleLabel: 'Chính sách mở rộng:',
      autoScaleActive: 'Đang mở rộng thêm Read Replica',
      autoScaleNominal: 'Tải ổn định trong ngưỡng an toàn',
      reportsTitle: 'Báo cáo phân tích hiệu năng định kỳ',
      reportsSubtitle: 'Tổng hợp tự động từ Prometheus & pg_stat_statements phục vụ đánh giá SLA.',
      slackFeedTitle: 'Nhật ký cảnh báo Slack gần đây',
    },
    blueprints: {
      title: 'Trình tạo cấu hình Docker Compose, TLS & Giám sát',
      subtitle: 'Tùy chỉnh tham số cụm lưu trữ ocodejs và xuất toàn bộ tệp cấu hình chuẩn sản xuất.',
      configPanelTitle: 'Tham số cụm ocodejs',
      brandName: 'Tên thương hiệu / Cụm',
      repoSlug: 'Kho lưu trữ chính',
      pgVersion: 'Phiên bản PostgreSQL',
      dbName: 'Tên cơ sở dữ liệu',
      dbUser: 'Tài khoản quản trị DB',
      tlsMode: 'Chế độ SSL/TLS',
      sharedBuffers: 'Bộ nhớ shared_buffers',
      maxConnections: 'Số kết nối tối đa',
      redisMaxMemory: 'Giới hạn RAM Redis',
      redisEviction: 'Chính sách giải phóng Redis',
      s3Bucket: 'AWS S3 Bucket sao lưu',
      s3Region: 'Vùng AWS S3',
      backupCron: 'Lịch Cron sao lưu S3',
      retentionDays: 'Lưu trữ bản sao (ngày)',
      slackChannel: 'Kênh Slack nhận cảnh báo',
      minReplicas: 'Số Replica tối thiểu',
      maxReplicas: 'Số Replica tối đa',
      targetCpu: 'Ngưỡng CPU Auto-Scale (%)',
      filesTitle: 'Tệp cấu hình được sinh tự động',
      allCategories: 'Tất cả tệp',
    },
    optimization: {
      title: 'Phòng lab tối ưu truy vấn SQL & Bộ nhớ đệm Redis',
      subtitle: 'Phân tích kế hoạch thực thi EXPLAIN ANALYZE, tạo chỉ mục phù hợp và tích hợp Redis Cache-Aside để giảm độ trễ.',
      labTitle: 'Phân tích truy vấn chậm trên hệ thống ocodejs',
      beforeLabel: 'Trước tối ưu',
      afterLabel: 'Sau tối ưu',
      reductionLabel: 'Giảm độ trễ',
      slowSqlLabel: 'Truy vấn gốc (Chậm)',
      optimizedSqlLabel: 'Truy vấn đề xuất & Tham số hóa',
      indexDdlLabel: 'Lệnh tạo Index (CONCURRENTLY)',
      redisPatternLabel: 'Chiến lược Redis Cache-Aside',
      explainPlanLabel: 'So sánh cây thực thi EXPLAIN ANALYZE',
      pgTuningGuideTitle: 'Nguyên tắc vàng tối ưu PostgreSQL cho ocodejs',
      redisGuideTitle: 'Thiết lập bộ nhớ đệm Redis an toàn & tốc độ cao',
    },
    backups: {
      title: 'Dự phòng tự động (HA Failover) & Sao lưu AWS S3',
      subtitle: 'Đảm bảo tính sẵn sàng cao RPO = 0 và sao lưu mã hóa định kỳ lên AWS S3 tránh mất mát dữ liệu.',
      haTitle: 'Kiến trúc High Availability & Chuyển đổi dự phòng',
      haDesc: 'Khi node Primary gặp sự cố, hệ thống tự động bầu chọn Standby Replica có WAL mới nhất lên làm Primary trong dưới 5 giây.',
      rpoLabel: 'Mục tiêu mất dữ liệu (RPO)',
      rtoLabel: 'Thời gian khôi phục (RTO)',
      s3Title: 'Kho lưu trữ bản sao mã hóa AWS S3',
      s3Desc: 'Bản sao lưu toàn phần và nhật ký WAL được nén zstd, mã hóa GPG/AES-256 và đẩy định kỳ lên S3.',
      colSnapshotId: 'Mã bản sao',
      colTime: 'Thời gian tạo',
      colType: 'Loại sao lưu',
      colSize: 'Kích thước',
      colPath: 'Đường dẫn S3',
      colEncryption: 'Mã hóa',
      colStatus: 'Toàn vẹn',
      verifiedLabel: 'Đã xác thực SHA-256',
      unverifiedLabel: 'Chờ kiểm tra',
    },
    security: {
      title: 'Bảo mật dữ liệu đầu cuối (E2EE) & Xác thực 2FA',
      subtitle: 'Kiểm soát chặt chẽ truy cập quản trị, chứng chỉ mTLS 1.3 và khóa mã hóa phía máy khách.',
      e2eeTitle: 'Mã hóa dữ liệu đầu cuối (Envelope E2EE)',
      e2eeDesc: 'Dữ liệu nhạy cảm của người dùng được mã hóa AES-256-GCM trước khi ghi xuống phân vùng phân tán PostgreSQL.',
      tlsTitle: 'Kết nối TLS 1.3 & mTLS giữa các dịch vụ',
      tlsDesc: 'Mọi kết nối từ ứng dụng ocodejs đến PostgreSQL và Redis đều bắt buộc chứng chỉ X.509 verify-full.',
      tfaTitle: 'Kích hoạt Xác thực hai yếu tố (TOTP 2FA)',
      tfaDesc: 'Bắt buộc mã OTP 6 chữ số cho toàn bộ tài khoản quản trị viên và truy cập bảng điều khiển.',
      totpPrompt: 'Nhập mã 6 số từ ứng dụng xác thực (thử nhập 6 chữ số bất kỳ, ví dụ 482910):',
      totpPlaceholder: '482910',
      totpSuccess: 'Xác thực 2FA thành công. Phiên quản trị đã được bảo vệ.',
      totpError: 'Vui lòng nhập đủ 6 chữ số hợp lệ.',
      teamTableTitle: 'Trạng thái bảo mật tài khoản quản trị',
      colMember: 'Tài khoản',
      colRole: 'Phân quyền',
      col2FA: 'Trạng thái 2FA',
      colFingerprint: 'Khóa E2EE công khai',
      colLastActive: 'Hoạt động gần nhất',
      enabled: 'Đã bật 2FA',
      pending: 'Chưa kích hoạt',
    },
    cicd: {
      title: 'Tự động hóa CI/CD, Cảnh báo Slack & Tích hợp API',
      subtitle: 'Quy trình triển khai Docker không gián đoạn từ GitHub Actions và cổng API mở rộng cho bên thứ ba.',
      pipelineTitle: 'Quy trình CI/CD tự động (ocodejs/ocodejs)',
      pipelineDesc: 'Tự động kiểm thử SQL migration, quét lỗ hổng container với Trivy, đóng gói Docker multi-arch và triển khai rolling update.',
      slackTitle: 'Cấu hình cảnh báo sự cố qua Slack',
      slackDesc: 'Thông báo tức thời khi độ trễ P95 > 80ms, lỗi sao lưu S3, hoặc độ trễ replica vượt ngưỡng 50ms.',
      apiTitle: 'Quản lý API Key & Tích hợp bên thứ ba',
      apiDesc: 'Cấp khóa API theo quyền hạn tối thiểu (Least Privilege) để kết nối hệ thống đối tác qua REST & Webhook.',
      keyNamePlaceholder: 'Tên tích hợp (vd: DataDog Sync)',
      colKeyName: 'Tên tích hợp',
      colPrefix: 'Tiền tố khóa',
      colScope: 'Phạm vi quyền',
      colStatus: 'Trạng thái',
      sdkSnippetTitle: 'Ví dụ tích hợp API REST & Webhook ký số HMAC',
    },
    exportModal: {
      title: 'Xuất trọn bộ hạ tầng ocodejs',
      subtitle: 'Tải xuống tệp shell tự giải nén chứa toàn bộ Docker Compose, cấu hình PostgreSQL TLS, Prometheus, Grafana, Redis, S3 Backup và CI/CD.',
      includedFiles: 'Danh sách tệp cấu hình đi kèm',
      commandTitle: 'Chạy lệnh sau trên máy chủ Ubuntu/Debian để khởi tạo:',
    },
    statusLabels: {
      healthy: 'Ổn định',
      degraded: 'Tải cao',
      offline: 'Ngắt kết nối',
    },
  },
  en: {
    appName: 'ocodejs Infra',
    nav: {
      overview: 'Overview & Telemetry',
      blueprints: 'Docker, TLS & Grafana',
      optimization: 'SQL & Redis Tuning',
      backups: 'S3 Backups & HA',
      security: 'E2EE & 2FA Security',
      cicd: 'CI/CD, Slack & API',
      integrations: 'Gmail, Chat & GitHub',
    },
    breadcrumbs: {
      root: 'ocodejs/ocodejs',
      overview: 'Real-Time Control Plane',
      blueprints: 'Docker & TLS Blueprints',
      optimization: 'Query & Cache Optimization',
      backups: 'High Availability & AWS S3',
      security: 'Zero-Trust E2EE & 2FA',
      cicd: 'Automated CI/CD & APIs',
      integrations: 'Gmail, Google Chat & GitHub Plugin Hub',
    },
    actions: {
      exportBundle: 'Export Bundle',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      downloadInstaller: 'Download Installer (.sh)',
      close: 'Close',
      apply: 'Apply Optimization',
      applied: 'Optimized',
      revert: 'Revert',
      simulateSurge: 'Simulate Traffic Surge',
      normalizeTraffic: 'Normalize Traffic',
      triggerFailover: 'Test HA Failover',
      restorePrimary: 'Restore Primary',
      runBackupNow: 'Run S3 Backup',
      verifyChecksum: 'Verify Integrity',
      sendTestAlert: 'Send Test Slack Alert',
      triggerPipeline: 'Run CI/CD Pipeline',
      createApiKey: 'Create API Key',
      revoke: 'Revoke',
      enable2FA: 'Enable 2FA',
      verifyCode: 'Verify TOTP Code',
      rotateKeys: 'Rotate E2EE Keys',
      exportReport: 'Download JSON Report',
    },
    overview: {
      title: 'ocodejs Distributed Storage Control Plane',
      subtitle: 'Real-time monitoring for self-hosted PostgreSQL HA, Redis caching, auto-scaling, and Slack incident alerting on ocodejs/ocodejs.',
      kpiQps: 'Query Throughput',
      kpiLatency: 'P95 Latency',
      kpiCacheHit: 'Redis Hit Ratio',
      kpiReplicas: 'Active Nodes',
      trafficTitle: 'Auto-Scaling Controller',
      trafficSubtitle: 'Simulate production traffic spikes to verify replica auto-scaling and real-time Slack notifications.',
      latencyChartTitle: 'Throughput (QPS) & P95 Latency (ms)',
      cacheChartTitle: 'Redis Cache Hit Ratio (%) & Active Connections',
      nodesTitle: 'Distributed Cluster Nodes & Replication Lag',
      nodesSubtitle: 'Container utilization, TLS 1.3 enforcement, and streaming WAL replication lag.',
      colNode: 'Node Name',
      colRole: 'Role',
      colCpuMem: 'CPU / RAM',
      colStorage: 'Storage',
      colLag: 'WAL Lag',
      colTls: 'TLS Mode',
      colStatus: 'Status',
      autoScaleLabel: 'Scaling state:',
      autoScaleActive: 'Auto-scaling Read Replicas active',
      autoScaleNominal: 'Traffic nominal within SLA bounds',
      reportsTitle: 'Periodic Performance Analysis Reports',
      reportsSubtitle: 'Automated weekly and monthly digests compiled from Prometheus and pg_stat_statements.',
      slackFeedTitle: 'Recent Slack Incident Feed',
    },
    blueprints: {
      title: 'Docker Compose, TLS & Observability Generator',
      subtitle: 'Parameterize your self-hosted ocodejs cluster and generate production-ready infrastructure files.',
      configPanelTitle: 'Cluster Parameters',
      brandName: 'Brand / Cluster Name',
      repoSlug: 'Primary Repository',
      pgVersion: 'PostgreSQL Version',
      dbName: 'Database Name',
      dbUser: 'Admin DB User',
      tlsMode: 'SSL/TLS Mode',
      sharedBuffers: 'shared_buffers',
      maxConnections: 'Max Connections',
      redisMaxMemory: 'Redis Max Memory',
      redisEviction: 'Redis Eviction Policy',
      s3Bucket: 'AWS S3 Backup Bucket',
      s3Region: 'AWS Region',
      backupCron: 'S3 Backup Cron',
      retentionDays: 'Retention (Days)',
      slackChannel: 'Slack Alert Channel',
      minReplicas: 'Min Replicas',
      maxReplicas: 'Max Replicas',
      targetCpu: 'Auto-Scale CPU Target (%)',
      filesTitle: 'Generated Configuration Artifacts',
      allCategories: 'All Files',
    },
    optimization: {
      title: 'SQL Query Optimization & Redis Caching Lab',
      subtitle: 'Inspect EXPLAIN ANALYZE execution trees, deploy concurrent indexes, and apply Redis Cache-Aside patterns.',
      labTitle: 'Slow Query Diagnostic Cases on ocodejs',
      beforeLabel: 'Before',
      afterLabel: 'After',
      reductionLabel: 'Latency Drop',
      slowSqlLabel: 'Original Query (Slow)',
      optimizedSqlLabel: 'Rewritten Parameterized Query',
      indexDdlLabel: 'Concurrent Index DDL',
      redisPatternLabel: 'Redis Cache-Aside Pattern',
      explainPlanLabel: 'EXPLAIN ANALYZE Execution Plan Comparison',
      pgTuningGuideTitle: 'PostgreSQL Tuning Playbook for ocodejs',
      redisGuideTitle: 'High-Throughput Redis Caching Architecture',
    },
    backups: {
      title: 'Automated HA Failover & AWS S3 Encrypted Backups',
      subtitle: 'Guarantee zero-data-loss high availability and scheduled encrypted backups to AWS S3.',
      haTitle: 'High Availability & Automated Failover',
      haDesc: 'If the primary PostgreSQL node becomes unreachable, the synchronous standby replica is promoted automatically in under 5 seconds.',
      rpoLabel: 'Recovery Point Objective (RPO)',
      rtoLabel: 'Recovery Time Objective (RTO)',
      s3Title: 'AWS S3 Encrypted Snapshot Vault',
      s3Desc: 'Full base backups and continuous WAL segments are zstd-compressed, GPG/AES-256 encrypted, and uploaded to S3.',
      colSnapshotId: 'Snapshot ID',
      colTime: 'Created At',
      colType: 'Backup Type',
      colSize: 'Size',
      colPath: 'S3 URI',
      colEncryption: 'Encryption',
      colStatus: 'Integrity',
      verifiedLabel: 'SHA-256 Verified',
      unverifiedLabel: 'Pending Check',
    },
    security: {
      title: 'End-to-End Encryption (E2EE) & Two-Factor Auth (2FA)',
      subtitle: 'Enforce strict zero-trust access, mTLS 1.3 transport encryption, and mandatory TOTP 2FA across all accounts.',
      e2eeTitle: 'Client-Side Envelope Encryption (E2EE)',
      e2eeDesc: 'Sensitive user payloads are encrypted with AES-256-GCM before persisting to distributed PostgreSQL shards.',
      tlsTitle: 'Strict TLS 1.3 & Mutual TLS Transport',
      tlsDesc: 'All connections between ocodejs workers, PostgreSQL, and Redis enforce X.509 verify-full certificates.',
      tfaTitle: 'Enroll Two-Factor Authentication (TOTP 2FA)',
      tfaDesc: 'Require a time-based 6-digit OTP for all operator accounts and production control actions.',
      totpPrompt: 'Enter 6-digit code from your authenticator app (try any 6 digits, e.g. 482910):',
      totpPlaceholder: '482910',
      totpSuccess: '2FA verified successfully. Operator session hardened.',
      totpError: 'Please enter a valid 6-digit code.',
      teamTableTitle: 'Operator Security Posture',
      colMember: 'Account',
      colRole: 'Role',
      col2FA: '2FA Status',
      colFingerprint: 'E2EE Key Fingerprint',
      colLastActive: 'Last Active',
      enabled: '2FA Enabled',
      pending: 'Setup Required',
    },
    cicd: {
      title: 'Automated CI/CD, Slack Alerting & API Integrations',
      subtitle: 'Zero-downtime Docker rollout via GitHub Actions and scoped REST/Webhook integrations for 3rd-party services.',
      pipelineTitle: 'Automated CI/CD Pipeline (ocodejs/ocodejs)',
      pipelineDesc: 'Runs SQL migration lints, unit tests, Trivy container security scans, multi-arch Docker builds, and rolling deployment.',
      slackTitle: 'Slack Real-Time Incident Routing',
      slackDesc: 'Dispatches actionable alerts when P95 latency exceeds 80ms, replication lag spikes, or S3 backup verification fails.',
      apiTitle: 'Third-Party API Keys & Webhooks',
      apiDesc: 'Issue least-privilege API keys to connect external observability, billing, or analytics consumers.',
      keyNamePlaceholder: 'Integration name (e.g. DataDog Sync)',
      colKeyName: 'Integration',
      colPrefix: 'Key Prefix',
      colScope: 'Scope',
      colStatus: 'State',
      sdkSnippetTitle: 'Authenticated REST API & HMAC Webhook Verification',
    },
    exportModal: {
      title: 'Export Complete ocodejs Infrastructure Bundle',
      subtitle: 'Download a self-extracting shell script containing Docker Compose, PostgreSQL TLS configs, Prometheus, Grafana, Redis, S3 backup scripts, and GitHub CI/CD.',
      includedFiles: 'Included Configuration Files',
      commandTitle: 'Run on your Ubuntu/Debian host to bootstrap the stack:',
    },
    statusLabels: {
      healthy: 'Healthy',
      degraded: 'Elevated',
      offline: 'Offline',
    },
  },
};
