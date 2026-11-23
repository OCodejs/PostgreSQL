import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateRequest } from '../src/auth.mjs';

test('rejects requests without a bearer token', async () => {
  const previous = process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_PROJECT_ID;
  try {
    await assert.rejects(
      authenticateRequest({ headers: {} }),
      (error) => error.statusCode === 401 && error.message === 'authentication_required'
    );
  } finally {
    if (previous === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previous;
  }
});

test('fails closed when Firebase project configuration is missing', async () => {
  const previous = process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_PROJECT_ID;
  try {
    await assert.rejects(
      authenticateRequest({ headers: { authorization: 'Bearer placeholder-token' } }),
      (error) => error.statusCode === 503 && error.message === 'authentication_not_configured'
    );
  } finally {
    if (previous === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = previous;
  }
});
