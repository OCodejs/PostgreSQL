import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("identity migrations use a ledger separate from the control-plane ledger", async () => {
  const source = await readFile(new URL("../server/migrate.ts", import.meta.url), "utf8");
  assert.match(source, /identity_schema_migrations/);
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS schema_migrations\s*\(/);
});
