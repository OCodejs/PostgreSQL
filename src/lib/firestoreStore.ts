import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  ApiKeyItem,
  BackupSnapshot,
  ClusterConfig,
  IntegrationAuditEntry,
  SlackAlertEvent,
  TeamMemberSecurity,
} from '../types/infra';

const DEFAULT_CLUSTER_DOC_ID = 'primary-cluster';

function clampStr(value: string, maxLen: number, fallback = 'default'): string {
  const trimmed = (value || fallback).trim();
  return (trimmed.length > 0 ? trimmed : fallback).slice(0, maxLen);
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function safeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `doc-${Date.now()}`;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(userRef);
    const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Operator', 100, 'Operator');
    const email = clampStr(user.email || 'operator@ocodejs.dev', 254, 'operator@ocodejs.dev');

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName,
        twoFactorVerified: false,
        e2eeKeyVersion: 4,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email,
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOperatorSecurityPosture(
  uid: string,
  updates: { twoFactorVerified?: boolean; e2eeKeyVersion?: number },
): Promise<void> {
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const payload: {
    twoFactorVerified?: boolean;
    e2eeKeyVersion?: number;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.twoFactorVerified === 'boolean') {
    payload.twoFactorVerified = updates.twoFactorVerified;
  }
  if (typeof updates.e2eeKeyVersion === 'number') {
    payload.e2eeKeyVersion = clampInt(updates.e2eeKeyVersion, 1, 10000);
  }

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function persistTeamMemberSecurity(
  uid: string,
  member: TeamMemberSecurity,
): Promise<void> {
  const docId = safeDocId(member.id);
  const path = `users/${uid}/teamMembers/${docId}`;
  const ref = doc(db, 'users', uid, 'teamMembers', docId);
  const lastActive = clampStr(member.lastActive || 'just now', 64, 'just now');

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        email: clampStr(member.email, 254, 'operator@ocodejs.dev'),
        role: member.role,
        twoFactorEnabled: Boolean(member.twoFactorEnabled),
        keyFingerprint: clampStr(member.keyFingerprint, 64, 'ed25519:default'),
        lastActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        twoFactorEnabled: Boolean(member.twoFactorEnabled),
        lastActive,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistIntegrationAudit(
  uid: string,
  entry: IntegrationAuditEntry,
): Promise<void> {
  const docId = safeDocId(entry.id);
  const path = `users/${uid}/integrationAudits/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'integrationAudits', docId), {
      ownerId: uid,
      channel: entry.channel,
      action: entry.action,
      target: clampStr(entry.target, 180, 'unknown'),
      summary: clampStr(entry.summary, 280, 'dispatched'),
      status: entry.status,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveClusterConfig(
  uid: string,
  config: ClusterConfig,
  appliedSqlIds: string[],
): Promise<void> {
  const path = `users/${uid}/clusters/${DEFAULT_CLUSTER_DOC_ID}`;
  const ref = doc(db, 'users', uid, 'clusters', DEFAULT_CLUSTER_DOC_ID);

  const minReplicas = clampInt(config.minReplicas, 1, 64);
  const maxReplicas = clampInt(config.maxReplicas, minReplicas, 128);

  const payload = {
    ownerId: uid,
    brandName: clampStr(config.brandName, 64, 'ocodejs'),
    repoSlug: clampStr(config.repoSlug, 120, 'ocodejs/ocodejs'),
    pgVersion: config.pgVersion === '16' ? '16' : '17',
    dbName: clampStr(config.dbName, 64, 'ocodejs_prod'),
    dbUser: clampStr(config.dbUser, 64, 'ocodejs_admin'),
    tlsMode: config.tlsMode,
    sharedBuffers: clampStr(config.sharedBuffers, 32, '2GB'),
    maxConnections: clampInt(config.maxConnections, 10, 10000),
    redisMaxMemory: clampStr(config.redisMaxMemory, 32, '1024mb'),
    redisEvictionPolicy: config.redisEvictionPolicy,
    s3Bucket: clampStr(config.s3Bucket, 128, 'ocodejs-pg-backups-prod'),
    s3Region: clampStr(config.s3Region, 64, 'ap-southeast-1'),
    backupCron: clampStr(config.backupCron, 64, '0 2 * * *'),
    retentionDays: clampInt(config.retentionDays, 1, 3650),
    slackChannel: clampStr(config.slackChannel, 80, '#ocodejs-infra-alerts'),
    minReplicas,
    maxReplicas,
    targetCpuPercent: clampInt(config.targetCpuPercent, 10, 95),
    enableE2EE: Boolean(config.enableE2EE),
    enforce2FA: Boolean(config.enforce2FA),
    appliedSqlIds: appliedSqlIds.slice(0, 20).map((s) => clampStr(s, 64)),
  };

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistBackupSnapshot(
  uid: string,
  snap: BackupSnapshot,
): Promise<void> {
  const docId = safeDocId(snap.id);
  const path = `users/${uid}/snapshots/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'snapshots', docId), {
      ownerId: uid,
      snapshotCode: clampStr(snap.id, 64),
      backupType: snap.type,
      sizeGb: Number(snap.sizeGb) || 0,
      s3Path: clampStr(snap.s3Path, 256),
      encryption: clampStr(snap.encryption, 64),
      durationSec: clampInt(snap.durationSec, 0, 86400),
      verified: Boolean(snap.verified),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markSnapshotVerified(uid: string, id: string): Promise<void> {
  const docId = safeDocId(id);
  const path = `users/${uid}/snapshots/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'snapshots', docId), {
      verified: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function persistApiKey(uid: string, item: ApiKeyItem): Promise<void> {
  const docId = safeDocId(item.id);
  const path = `users/${uid}/apiKeys/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'apiKeys', docId), {
      ownerId: uid,
      name: clampStr(item.name, 80),
      prefix: clampStr(item.prefix, 48),
      scope: item.scope,
      active: Boolean(item.active),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeApiKeyInFirestore(uid: string, id: string): Promise<void> {
  const docId = safeDocId(id);
  const path = `users/${uid}/apiKeys/${docId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'apiKeys', docId), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function persistSlackAlert(uid: string, evt: SlackAlertEvent): Promise<void> {
  const docId = safeDocId(evt.id);
  const path = `users/${uid}/slackAlerts/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'slackAlerts', docId), {
      ownerId: uid,
      severity: evt.severity,
      rule: clampStr(evt.rule, 64),
      messageVi: clampStr(evt.messageVi, 300),
      messageEn: clampStr(evt.messageEn, 300),
      channel: clampStr(evt.channel, 80),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onProfileLoaded: (posture: { twoFactorVerified: boolean; e2eeKeyVersion: number }) => void;
    onClusterLoaded: (config: ClusterConfig, appliedSqlIds: string[]) => void;
    onSnapshotsLoaded: (items: BackupSnapshot[]) => void;
    onApiKeysLoaded: (items: ApiKeyItem[]) => void;
    onAlertsLoaded: (items: SlackAlertEvent[]) => void;
    onTeamLoaded: (overrides: Map<string, { twoFactorEnabled: boolean; lastActive: string }>) => void;
    onIntegrationAuditsLoaded: (items: IntegrationAuditEntry[]) => void;
  },
): Unsubscribe {
  const profilePath = `users/${uid}`;
  const unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const d = snapshot.data();
      callbacks.onProfileLoaded({
        twoFactorVerified: Boolean(d.twoFactorVerified),
        e2eeKeyVersion: typeof d.e2eeKeyVersion === 'number' ? d.e2eeKeyVersion : 4,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, profilePath);
    },
  );

  const clusterPath = `users/${uid}/clusters/${DEFAULT_CLUSTER_DOC_ID}`;
  const unsubCluster = onSnapshot(
    doc(db, 'users', uid, 'clusters', DEFAULT_CLUSTER_DOC_ID),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const d = snapshot.data();
      callbacks.onClusterLoaded(
        {
          brandName: d.brandName,
          repoSlug: d.repoSlug,
          pgVersion: d.pgVersion,
          dbName: d.dbName,
          dbUser: d.dbUser,
          tlsMode: d.tlsMode,
          sharedBuffers: d.sharedBuffers,
          maxConnections: d.maxConnections,
          redisMaxMemory: d.redisMaxMemory,
          redisEvictionPolicy: d.redisEvictionPolicy,
          s3Bucket: d.s3Bucket,
          s3Region: d.s3Region,
          backupCron: d.backupCron,
          retentionDays: d.retentionDays,
          slackChannel: d.slackChannel,
          minReplicas: d.minReplicas,
          maxReplicas: d.maxReplicas,
          targetCpuPercent: d.targetCpuPercent,
          enableE2EE: d.enableE2EE,
          enforce2FA: d.enforce2FA,
        },
        Array.isArray(d.appliedSqlIds) ? d.appliedSqlIds : [],
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, clusterPath);
    },
  );

  const snapshotsPath = `users/${uid}/snapshots`;
  const unsubSnapshots = onSnapshot(
    query(
      collection(db, 'users', uid, 'snapshots'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
    (qs) => {
      if (qs.empty) return;
      const items: BackupSnapshot[] = qs.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          createdAt: d.createdAt?.toDate
            ? d.createdAt.toDate().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
            : 'Pending',
          type: d.backupType,
          sizeGb: d.sizeGb,
          s3Path: d.s3Path,
          encryption: d.encryption,
          durationSec: d.durationSec,
          verified: d.verified,
        };
      });
      callbacks.onSnapshotsLoaded(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, snapshotsPath);
    },
  );

  const apiKeysPath = `users/${uid}/apiKeys`;
  const unsubApiKeys = onSnapshot(
    query(
      collection(db, 'users', uid, 'apiKeys'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
    (qs) => {
      if (qs.empty) return;
      const items: ApiKeyItem[] = qs.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name,
          prefix: d.prefix,
          scope: d.scope,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString().slice(0, 10) : 'Today',
          lastUsed: 'Synced',
          active: d.active,
        };
      });
      callbacks.onApiKeysLoaded(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, apiKeysPath);
    },
  );

  const alertsPath = `users/${uid}/slackAlerts`;
  const unsubAlerts = onSnapshot(
    query(
      collection(db, 'users', uid, 'slackAlerts'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
    (qs) => {
      if (qs.empty) return;
      const items: SlackAlertEvent[] = qs.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          time: d.createdAt?.toDate ? d.createdAt.toDate().toTimeString().slice(0, 8) : '00:00:00',
          severity: d.severity,
          rule: d.rule,
          messageVi: d.messageVi,
          messageEn: d.messageEn,
          channel: d.channel,
        };
      });
      callbacks.onAlertsLoaded(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, alertsPath);
    },
  );

  const teamPath = `users/${uid}/teamMembers`;
  const unsubTeam = onSnapshot(
    query(
      collection(db, 'users', uid, 'teamMembers'),
      where('ownerId', '==', uid),
      limit(20),
    ),
    (qs) => {
      if (qs.empty) return;
      const overrides = new Map<string, { twoFactorEnabled: boolean; lastActive: string }>();
      for (const docSnap of qs.docs) {
        const d = docSnap.data();
        overrides.set(docSnap.id, {
          twoFactorEnabled: Boolean(d.twoFactorEnabled),
          lastActive: typeof d.lastActive === 'string' ? d.lastActive : 'Synced',
        });
      }
      callbacks.onTeamLoaded(overrides);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, teamPath);
    },
  );

  const auditsPath = `users/${uid}/integrationAudits`;
  const unsubAudits = onSnapshot(
    query(
      collection(db, 'users', uid, 'integrationAudits'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(25),
    ),
    (qs) => {
      const items: IntegrationAuditEntry[] = qs.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          channel: d.channel,
          action: d.action,
          target: d.target,
          summary: d.summary,
          status: d.status,
          createdAt: d.createdAt?.toDate
            ? d.createdAt.toDate().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
            : 'Pending',
        };
      });
      callbacks.onIntegrationAuditsLoaded(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, auditsPath);
    },
  );

  return () => {
    unsubProfile();
    unsubCluster();
    unsubSnapshots();
    unsubApiKeys();
    unsubAlerts();
    unsubTeam();
    unsubAudits();
  };
}
