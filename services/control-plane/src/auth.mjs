import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function authenticateRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    const error = new Error('authentication_required');
    error.statusCode = 401;
    throw error;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    const error = new Error('authentication_not_configured');
    error.statusCode = 503;
    throw error;
  }

  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256']
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.firebase?.sign_in_provider === 'anonymous') {
      throw new Error('invalid_subject');
    }
    return { uid: payload.sub };
  } catch {
    const error = new Error('invalid_or_expired_token');
    error.statusCode = 401;
    throw error;
  }
}
