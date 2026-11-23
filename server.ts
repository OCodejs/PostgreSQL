import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GITHUB_API_BASE = 'https://api.github.com';
const SAFE_GITHUB_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_GIT_REF = /^[a-zA-Z0-9._/-]+$/;
const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface GitHubUserSummary {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubSession {
  githubToken: string;
  user: GitHubUserSummary;
  expiresAt: number;
}

interface AuthedRequest extends Request {
  githubSession?: GitHubSession;
  githubSessionToken?: string;
}

const pendingStates = new Map<string, number>();
const githubSessions = new Map<string, GitHubSession>();

function getBaseUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getGitHubCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

function pruneExpiredMaps(): void {
  const now = Date.now();
  for (const [state, createdAt] of pendingStates.entries()) {
    if (now - createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
  for (const [token, session] of githubSessions.entries()) {
    if (session.expiresAt <= now) {
      githubSessions.delete(token);
    }
  }
}

function renderPopupResultHtml(payload: Record<string, unknown>, heading: string, detail: string): string {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const safeHeading = heading.replace(/[<>&"]/g, '');
  const safeDetail = detail.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub Authorization — ocodejs Infrastructure</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { max-width: 420px; border: 1px solid #334155; background: #1e293b; border-radius: 12px; padding: 24px; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      p { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeHeading}</h1>
      <p>${safeDetail}</p>
    </div>
    <script>
      (function () {
        var payload = ${safeJson};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          window.close();
        } else {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`;
}

function requireGitHubSession(req: AuthedRequest, res: Response, next: NextFunction): void {
  pruneExpiredMaps();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing GitHub plugin session token' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const session = githubSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    githubSessions.delete(token);
    res.status(401).json({ error: 'GitHub plugin session expired or invalid' });
    return;
  }
  req.githubSession = session;
  req.githubSessionToken = token;
  next();
}

async function githubFetch(pathName: string, token: string, init?: RequestInit): Promise<globalThis.Response> {
  return fetch(`${GITHUB_API_BASE}${pathName}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'ocodejs-infrastructure-studio',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
}

function validateRepoParams(req: Request, res: Response): { owner: string; repo: string } | null {
  const owner = String(req.params.owner || '');
  const repo = String(req.params.repo || '');
  if (!SAFE_GITHUB_SEGMENT.test(owner) || !SAFE_GITHUB_SEGMENT.test(repo)) {
    res.status(400).json({ error: 'Invalid repository owner or name' });
    return null;
  }
  return { owner, repo };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/github/config', (_req: Request, res: Response) => {
    const creds = getGitHubCredentials();
    res.json({
      configured: creds !== null,
      activeCallbackUrl: `${getBaseUrl()}/auth/github/callback`,
    });
  });

  app.get('/api/auth/github/url', (_req: Request, res: Response) => {
    pruneExpiredMaps();
    const creds = getGitHubCredentials();
    if (!creds) {
      res.status(503).json({
        error: 'GITHUB_OAUTH_NOT_CONFIGURED',
        message: 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in AI Studio Secrets.',
      });
      return;
    }

    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, Date.now());

    const redirectUri = `${getBaseUrl()}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user repo workflow',
      state,
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  const handleGitHubCallback = async (req: Request, res: Response): Promise<void> => {
    pruneExpiredMaps();
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    const oauthErrorDesc =
      typeof req.query.error_description === 'string' ? req.query.error_description : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (oauthError) {
      res
        .status(400)
        .send(
          renderPopupResultHtml(
            { type: 'GITHUB_OAUTH_ERROR', error: oauthErrorDesc || oauthError },
            'GitHub authorization declined',
            'You can close this window and return to ocodejs Infrastructure Studio.',
          ),
        );
      return;
    }

    if (!state || !pendingStates.has(state)) {
      res
        .status(400)
        .send(
          renderPopupResultHtml(
            { type: 'GITHUB_OAUTH_ERROR', error: 'Invalid or expired authorization state. Please try again.' },
            'Authorization state expired',
            'Please close this window and retry connecting GitHub.',
          ),
        );
      return;
    }
    pendingStates.delete(state);

    const creds = getGitHubCredentials();
    if (!creds || !code) {
      res
        .status(400)
        .send(
          renderPopupResultHtml(
            { type: 'GITHUB_OAUTH_ERROR', error: 'Missing GitHub OAuth credentials or authorization code.' },
            'Authorization incomplete',
            'Missing authorization code or server configuration.',
          ),
        );
      return;
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code,
          redirect_uri: `${getBaseUrl()}/auth/github/callback`,
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        res
          .status(400)
          .send(
            renderPopupResultHtml(
              {
                type: 'GITHUB_OAUTH_ERROR',
                error: tokenJson.error_description || tokenJson.error || 'Token exchange failed.',
              },
              'GitHub token exchange failed',
              'Please close this window and retry.',
            ),
          );
        return;
      }

      const userRes = await githubFetch('/user', tokenJson.access_token);
      if (!userRes.ok) {
        res
          .status(502)
          .send(
            renderPopupResultHtml(
              { type: 'GITHUB_OAUTH_ERROR', error: 'Failed to load GitHub user profile.' },
              'Profile check failed',
              'Unable to verify connected GitHub account.',
            ),
          );
        return;
      }

      const ghUser = (await userRes.json()) as GitHubUserSummary;
      const userSummary: GitHubUserSummary = {
        login: ghUser.login,
        name: ghUser.name,
        avatar_url: ghUser.avatar_url,
        html_url: ghUser.html_url,
      };

      const sessionToken = crypto.randomBytes(32).toString('hex');
      githubSessions.set(sessionToken, {
        githubToken: tokenJson.access_token,
        user: userSummary,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });

      res.send(
        renderPopupResultHtml(
          {
            type: 'GITHUB_OAUTH_SUCCESS',
            sessionToken,
            user: userSummary,
          },
          'GitHub repository plugin connected',
          'Authorization complete. This window will close automatically.',
        ),
      );
    } catch (err) {
      console.error('GitHub OAuth callback error:', err);
      res
        .status(500)
        .send(
          renderPopupResultHtml(
            { type: 'GITHUB_OAUTH_ERROR', error: 'Unexpected error while completing GitHub authorization.' },
            'Authorization error',
            'Please close this window and try again.',
          ),
        );
    }
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], handleGitHubCallback);

  app.get('/api/github/status', requireGitHubSession, (req: AuthedRequest, res: Response) => {
    res.json({
      connected: true,
      user: req.githubSession!.user,
    });
  });

  app.post('/api/github/disconnect', requireGitHubSession, (req: AuthedRequest, res: Response) => {
    if (req.githubSessionToken) {
      githubSessions.delete(req.githubSessionToken);
    }
    res.json({ disconnected: true });
  });

  app.get('/api/github/repos', requireGitHubSession, async (req: AuthedRequest, res: Response) => {
    try {
      const ghRes = await githubFetch(
        '/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator,organization_member',
        req.githubSession!.githubToken,
      );
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: 'Unable to fetch GitHub repositories' });
        return;
      }
      const repos = (await ghRes.json()) as Array<{
        id: number;
        full_name: string;
        name: string;
        owner: { login: string };
        private: boolean;
        default_branch: string;
        html_url: string;
        updated_at: string;
        pushed_at: string;
        open_issues_count: number;
      }>;
      res.json({
        repos: repos.map((r) => ({
          id: r.id,
          fullName: r.full_name,
          name: r.name,
          owner: r.owner.login,
          isPrivate: r.private,
          defaultBranch: r.default_branch,
          htmlUrl: r.html_url,
          updatedAt: r.updated_at,
          pushedAt: r.pushed_at,
          openIssuesCount: r.open_issues_count,
        })),
      });
    } catch (err) {
      console.error('GitHub repos error:', err);
      res.status(502).json({ error: 'Failed to load repositories from GitHub' });
    }
  });

  app.get('/api/github/repos/:owner/:repo/overview', requireGitHubSession, async (req: AuthedRequest, res: Response) => {
    const params = validateRepoParams(req, res);
    if (!params) return;

    const token = req.githubSession!.githubToken;
    const base = `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`;

    try {
      const [repoRes, commitsRes, workflowsRes, runsRes] = await Promise.all([
        githubFetch(base, token),
        githubFetch(`${base}/commits?per_page=5`, token),
        githubFetch(`${base}/actions/workflows`, token),
        githubFetch(`${base}/actions/runs?per_page=10`, token),
      ]);

      if (!repoRes.ok) {
        res.status(repoRes.status).json({ error: 'Repository not accessible or not found' });
        return;
      }

      const repoData = (await repoRes.json()) as {
        full_name: string;
        default_branch: string;
        private: boolean;
        html_url: string;
        open_issues_count: number;
        stargazers_count: number;
        pushed_at: string;
      };

      const commitsData = commitsRes.ok
        ? ((await commitsRes.json()) as Array<{
            sha: string;
            html_url: string;
            commit: { message: string; author: { name: string; date: string } };
          }>)
        : [];

      const workflowsData = workflowsRes.ok
        ? ((await workflowsRes.json()) as {
            workflows: Array<{ id: number; name: string; path: string; state: string }>;
          })
        : { workflows: [] };

      const runsData = runsRes.ok
        ? ((await runsRes.json()) as {
            workflow_runs: Array<{
              id: number;
              name: string;
              head_branch: string;
              head_sha: string;
              status: string;
              conclusion: string | null;
              event: string;
              updated_at: string;
              html_url: string;
            }>;
          })
        : { workflow_runs: [] };

      res.json({
        repository: {
          fullName: repoData.full_name,
          defaultBranch: repoData.default_branch,
          isPrivate: repoData.private,
          htmlUrl: repoData.html_url,
          openIssuesCount: repoData.open_issues_count,
          stars: repoData.stargazers_count,
          pushedAt: repoData.pushed_at,
        },
        commits: commitsData.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
          htmlUrl: c.html_url,
        })),
        workflows: workflowsData.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state,
        })),
        runs: runsData.workflow_runs.map((r) => ({
          id: r.id,
          name: r.name,
          branch: r.head_branch,
          sha: r.head_sha.slice(0, 7),
          status: r.status,
          conclusion: r.conclusion,
          event: r.event,
          updatedAt: r.updated_at,
          htmlUrl: r.html_url,
        })),
      });
    } catch (err) {
      console.error('GitHub repo overview error:', err);
      res.status(502).json({ error: 'Failed to inspect repository on GitHub' });
    }
  });

  app.post(
    '/api/github/repos/:owner/:repo/workflows/:workflowId/dispatch',
    requireGitHubSession,
    async (req: AuthedRequest, res: Response) => {
      const params = validateRepoParams(req, res);
      if (!params) return;

      const workflowId = String(req.params.workflowId || '');
      if (!SAFE_GITHUB_SEGMENT.test(workflowId)) {
        res.status(400).json({ error: 'Invalid workflow identifier' });
        return;
      }

      const body = (req.body || {}) as { ref?: unknown; inputs?: unknown };
      const ref = typeof body.ref === 'string' ? body.ref.trim() : '';
      if (!ref || ref.length > 120 || !SAFE_GIT_REF.test(ref) || ref.includes('..')) {
        res.status(400).json({ error: 'Invalid branch or tag reference' });
        return;
      }

      const sanitizedInputs: Record<string, string> = {};
      if (body.inputs && typeof body.inputs === 'object' && !Array.isArray(body.inputs)) {
        const entries = Object.entries(body.inputs as Record<string, unknown>).slice(0, 10);
        for (const [k, v] of entries) {
          if (/^[a-zA-Z0-9_-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 256) {
            sanitizedInputs[k] = v;
          }
        }
      }

      try {
        const dispatchRes = await githubFetch(
          `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`,
          req.githubSession!.githubToken,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ref,
              ...(Object.keys(sanitizedInputs).length > 0 ? { inputs: sanitizedInputs } : {}),
            }),
          },
        );

        if (!dispatchRes.ok) {
          const text = await dispatchRes.text();
          res.status(dispatchRes.status).json({
            error: text || 'Workflow does not accept manual workflow_dispatch triggers or insufficient permission.',
          });
          return;
        }

        res.status(202).json({ dispatched: true, ref, workflowId });
      } catch (err) {
        console.error('GitHub workflow dispatch error:', err);
        res.status(502).json({ error: 'Failed to dispatch workflow on GitHub' });
      }
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
        next();
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ocodejs Infrastructure Studio listening on port ${PORT}`);
  });
}

void startServer();
