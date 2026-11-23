import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
] as const;

export const FIREBASE_PROJECT_ID: string = firebaseConfig.projectId;

const app = initializeApp(firebaseConfig);
const firestoreDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
export const auth = getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  googleAuthProvider.addScope(scope);
}

// Keep Google Workspace OAuth access token strictly in runtime memory (never browser storage).
let cachedWorkspaceToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

function notifyTokenListeners(nextToken: string | null): void {
  for (const listener of tokenListeners) {
    listener(nextToken);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedWorkspaceToken = null;
    notifyTokenListeners(null);
  }
});

export function subscribeWorkspaceToken(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  listener(cachedWorkspaceToken);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedWorkspaceToken = null;
  notifyTokenListeners(null);
}

export async function signInWithGoogleWorkspace(forceConsent = false): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  if (forceConsent) {
    provider.setCustomParameters({ prompt: 'consent' });
  }
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken ?? null;
  cachedWorkspaceToken = accessToken;
  notifyTokenListeners(accessToken);
  return { user: result.user, accessToken };
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testFirestoreConnection();
