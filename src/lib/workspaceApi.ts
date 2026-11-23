export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
}

export interface ChatSpaceItem {
  name: string;
  displayName: string;
  spaceType: string;
  threaded: boolean;
}

export interface ChatMessageItem {
  name: string;
  text: string;
  createTime: string;
  senderName: string;
  senderType: string;
}

export class WorkspaceApiError extends Error {
  status: number;
  code: 'AUTH_EXPIRED' | 'CHAT_APP_NOT_CONFIGURED' | 'FORBIDDEN' | 'API_ERROR';
  consoleUrl?: string;

  constructor(
    message: string,
    status: number,
    code: WorkspaceApiError['code'],
    consoleUrl?: string,
  ) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
    this.code = code;
    this.consoleUrl = consoleUrl;
  }
}

export const CHAT_CONSOLE_CONFIG_URL =
  'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=modular-context-6k4jk';

function utf8ToBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64Url: string): string {
  const b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function encodeRfc2047(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  const found = headers.find((h) => h.name?.toLowerCase() === target);
  return found?.value ?? '';
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

function extractPlainTextBody(payload?: GmailPayloadPart): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return base64UrlToUtf8(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const nested = extractPlainTextBody(part);
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    const decoded = base64UrlToUtf8(payload.body.data);
    return decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

async function parseGoogleError(res: Response, fallback: string): Promise<{ message: string; status: number }> {
  try {
    const json = (await res.json()) as { error?: { message?: string; status?: string } };
    return {
      message: json.error?.message || fallback,
      status: res.status,
    };
  } catch {
    return { message: fallback, status: res.status };
  }
}

export async function listGmailMessages(
  accessToken: string,
  query = '',
  maxResults = 12,
): Promise<GmailMessageSummary[]> {
  const listParams = new URLSearchParams({
    maxResults: String(maxResults),
    ...(query.trim() ? { q: query.trim() } : {}),
  });

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (listRes.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }
  if (!listRes.ok) {
    const err = await parseGoogleError(listRes, 'Failed to list Gmail messages');
    throw new WorkspaceApiError(err.message, err.status, err.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
  }

  const listData = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const refs = listData.messages ?? [];
  if (refs.length === 0) return [];

  const details = await Promise.all(
    refs.map(async (ref) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) return null;
      const msg = (await msgRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        labelIds?: string[];
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      };
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader(msg.payload?.headers, 'Subject') || '(No subject)',
        from: getHeader(msg.payload?.headers, 'From') || 'Unknown sender',
        date: getHeader(msg.payload?.headers, 'Date'),
        snippet: msg.snippet ?? '',
        unread: Boolean(msg.labelIds?.includes('UNREAD')),
      } satisfies GmailMessageSummary;
    }),
  );

  return details.filter((m): m is GmailMessageSummary => m !== null);
}

export async function getGmailMessageDetail(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageDetail> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }
  if (!res.ok) {
    const err = await parseGoogleError(res, 'Failed to read Gmail message');
    throw new WorkspaceApiError(err.message, err.status, 'API_ERROR');
  }

  const msg = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    labelIds?: string[];
    payload?: GmailPayloadPart & { headers?: Array<{ name?: string; value?: string }> };
  };

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(msg.payload?.headers, 'Subject') || '(No subject)',
    from: getHeader(msg.payload?.headers, 'From') || 'Unknown sender',
    date: getHeader(msg.payload?.headers, 'Date'),
    snippet: msg.snippet ?? '',
    unread: Boolean(msg.labelIds?.includes('UNREAD')),
    bodyText: extractPlainTextBody(msg.payload) || msg.snippet || '',
  };
}

export async function sendGmailIncidentReport(
  accessToken: string,
  params: { to: string; subject: string; body: string },
): Promise<{ id: string }> {
  const cleanTo = params.to.replace(/[\r\n]/g, '').trim();
  const cleanSubject = params.subject.replace(/[\r\n]/g, '').trim();
  const rawMime = [
    `To: ${cleanTo}`,
    `Subject: ${encodeRfc2047(cleanSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    params.body,
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: utf8ToBase64Url(rawMime) }),
  });

  if (res.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }
  if (!res.ok) {
    const err = await parseGoogleError(res, 'Failed to send Gmail message');
    throw new WorkspaceApiError(err.message, err.status, err.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
  }

  return (await res.json()) as { id: string };
}

export async function listChatSpaces(accessToken: string): Promise<ChatSpaceItem[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=30', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }

  if (!res.ok) {
    const err = await parseGoogleError(res, 'Failed to list Google Chat spaces');
    if (res.status === 404 || err.message.toLowerCase().includes('chat app not found')) {
      throw new WorkspaceApiError(err.message, 404, 'CHAT_APP_NOT_CONFIGURED', CHAT_CONSOLE_CONFIG_URL);
    }
    throw new WorkspaceApiError(err.message, err.status, err.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
  }

  const data = (await res.json()) as {
    spaces?: Array<{
      name: string;
      displayName?: string;
      spaceType?: string;
      spaceThreadingState?: string;
    }>;
  };

  return (data.spaces ?? []).map((sp) => ({
    name: sp.name,
    displayName: sp.displayName || sp.name,
    spaceType: sp.spaceType || 'SPACE',
    threaded: sp.spaceThreadingState === 'THREADED_MESSAGES',
  }));
}

export async function listChatMessages(
  accessToken: string,
  spaceName: string,
): Promise<ChatMessageItem[]> {
  if (!/^spaces\/[a-zA-Z0-9_-]+$/.test(spaceName)) {
    throw new WorkspaceApiError('Invalid Google Chat space identifier', 400, 'API_ERROR');
  }

  const res = await fetch(
    `https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=20&orderBy=createTime%20desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }

  if (!res.ok) {
    const err = await parseGoogleError(res, 'Failed to fetch Google Chat messages');
    if (res.status === 404 || err.message.toLowerCase().includes('chat app not found')) {
      throw new WorkspaceApiError(err.message, 404, 'CHAT_APP_NOT_CONFIGURED', CHAT_CONSOLE_CONFIG_URL);
    }
    throw new WorkspaceApiError(err.message, err.status, err.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
  }

  const data = (await res.json()) as {
    messages?: Array<{
      name: string;
      text?: string;
      createTime?: string;
      sender?: { displayName?: string; name?: string; type?: string };
    }>;
  };

  return (data.messages ?? []).map((m) => ({
    name: m.name,
    text: m.text || '(Attachment or card message)',
    createTime: m.createTime || '',
    senderName: m.sender?.displayName || m.sender?.name || 'Workspace User',
    senderType: m.sender?.type || 'HUMAN',
  }));
}

export async function postChatMessage(
  accessToken: string,
  spaceName: string,
  text: string,
): Promise<ChatMessageItem> {
  if (!/^spaces\/[a-zA-Z0-9_-]+$/.test(spaceName)) {
    throw new WorkspaceApiError('Invalid Google Chat space identifier', 400, 'API_ERROR');
  }

  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (res.status === 401) {
    throw new WorkspaceApiError('Google session token expired.', 401, 'AUTH_EXPIRED');
  }

  if (!res.ok) {
    const err = await parseGoogleError(res, 'Failed to post Google Chat alert');
    if (res.status === 404 || err.message.toLowerCase().includes('chat app not found')) {
      throw new WorkspaceApiError(err.message, 404, 'CHAT_APP_NOT_CONFIGURED', CHAT_CONSOLE_CONFIG_URL);
    }
    throw new WorkspaceApiError(err.message, err.status, err.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
  }

  const created = (await res.json()) as {
    name: string;
    text?: string;
    createTime?: string;
    sender?: { displayName?: string; name?: string; type?: string };
  };

  return {
    name: created.name,
    text: created.text || text,
    createTime: created.createTime || new Date().toISOString(),
    senderName: created.sender?.displayName || 'You',
    senderType: created.sender?.type || 'HUMAN',
  };
}
