import test from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { app } from "../server/app.js";
import { pool } from "../server/db.js";

test("PostgreSQL-backed login creates, reads, and revokes an HttpOnly session", async () => {
  const email = `identity-ci-${randomUUID()}@example.test`;
  const password = "CI-only-Strong-Password-123!";
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const inserted = await pool.query<{ id: string }>(
    "INSERT INTO users(email,email_normalized,password_hash,email_verified_at) VALUES($1,$2,$3,now()) RETURNING id",
    [email, email, passwordHash]
  );
  const userId = inserted.rows[0]!.id;

  try {
    const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    assert.equal(csrfResponse.statusCode, 200);
    const csrfToken = csrfResponse.json<{ csrfToken: string }>().csrfToken;
    const csrfCookie = String(csrfResponse.headers["set-cookie"]).split(";")[0];

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { cookie: csrfCookie, "x-csrf-token": csrfToken },
      payload: { email, password }
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().user.email, email);
    const sessionCookie = String(login.headers["set-cookie"]).split(";")[0];
    assert.match(sessionCookie, /^ocodejs_session=/);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: sessionCookie }
    });
    assert.equal(me.statusCode, 200, me.body);
    assert.equal(me.json().user.id, userId);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${sessionCookie}; ${csrfCookie}`,
        "x-csrf-token": csrfToken
      }
    });
    assert.equal(logout.statusCode, 200, logout.body);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: sessionCookie }
    });
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    await app.close();
    await pool.end();
  }
});
