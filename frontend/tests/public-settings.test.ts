import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicSettings } from "../src/lib/public-settings.ts";

test("setup without credentials and valid public settings are accepted", () => {
  validatePublicSettings({});
  validatePublicSettings({
    apiUrl: "https://api.example.com",
    supabaseUrl: "https://example.supabase.co",
    publicKey: "sb_publishable_test",
  });
  validatePublicSettings({ apiUrl: "http://127.0.0.1:8000" });
});

test("public build rejects secret and service-role keys", () => {
  const token = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  for (const publicKey of ["sb_secret_test", token])
    assert.throws(
      () => validatePublicSettings({ publicKey }),
      /never a service-role secret/,
    );
});

test("provider origins cannot downgrade TLS or carry credentials", () => {
  for (const supabaseUrl of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?token=test",
  ]) {
    assert.throws(() => validatePublicSettings({ supabaseUrl }));
  }
  assert.throws(() =>
    validatePublicSettings({ apiUrl: "http://public.example.com" }),
  );
});
