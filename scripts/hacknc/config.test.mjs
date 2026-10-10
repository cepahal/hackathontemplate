import assert from "node:assert/strict";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { configured, configReport, readEnv, secretPublicKey } from "./common.mjs";

test("env reader preserves quoted keys and strips unquoted comments", () => {
  const directory = mkdtempSync(join(tmpdir(), "hacknc-env-"));
  const path = join(directory, ".env");
  try {
    writeFileSync(path, '# comment\r\nA="fake#value" # note\r\nexport B=plain # note\r\nC=\r\n');
    assert.deepEqual(readEnv(path), { A: "fake#value", B: "plain", C: "" });
  } finally {
    unlinkSync(path);
    rmdirSync(directory);
  }
});

test("blank and example values never count as configured", () => {
  for (const value of [undefined, "", "  ", "https://your-project-ref.supabase.co", "replace-me", "<key>"]) assert.equal(configured(value), false);
  assert.equal(configured("fake-credential-for-test"), true);
});

test("public service-role keys and frontend/backend disagreement are blockers without printing values", () => {
  const fakeSecret = "sb_secret_fake_redaction_sentinel";
  const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  assert.equal(secretPublicKey(jwt), true);
  const entries = configReport({
    NEXT_PUBLIC_SUPABASE_URL: "https://alpha.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeSecret,
    NEXT_PUBLIC_API_URL: "http://localhost:8000",
    NEXT_PUBLIC_OPENAI_API_KEY: fakeSecret,
  }, { SUPABASE_URL: "https://beta.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_test" });
  assert.ok(entries.some((entry) => entry.level === "FAIL" && entry.message.includes("secret/service-role")));
  assert.ok(entries.some((entry) => entry.level === "FAIL" && entry.message.includes("do not match")));
  assert.ok(entries.some((entry) => entry.level === "FAIL" && entry.message.includes("browser configuration")));
  assert.ok(!JSON.stringify(entries).includes(fakeSecret));
});

test("configured integrations are explicitly not live verified", () => {
  const entries = configReport({}, { GEMINI_API_KEY: "fake-key-sentinel", GEMINI_MODEL: "fake-model" });
  assert.ok(entries.some((entry) => entry.message === "Gemini AI: configured (not live verified)"));
  assert.ok(!JSON.stringify(entries).includes("fake-key-sentinel"));
});

test("publishable-key alias follows frontend precedence and detects mismatches", () => {
  const front = {
    NEXT_PUBLIC_SUPABASE_URL: "https://review.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_alias",
    NEXT_PUBLIC_API_URL: "http://localhost:8000",
  };
  const back = { SUPABASE_URL: front.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY: front.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  assert.equal(configReport(front, back).some((entry) => entry.level === "FAIL"), false);
  assert.ok(configReport(front, { ...back, SUPABASE_ANON_KEY: "sb_publishable_other" }).some((entry) => entry.level === "FAIL" && entry.message === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_ANON_KEY: values do not match"));
  assert.equal(configReport({ ...front, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_primary" }, { ...back, SUPABASE_ANON_KEY: "sb_publishable_primary" }).some((entry) => entry.level === "FAIL"), false);
});

test("secret publishable-key aliases block frontend-only startup without exposing values", () => {
  const fakeSecret = "sb_secret_alias_redaction_sentinel";
  const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  for (const value of [fakeSecret, ` ${fakeSecret} `, jwt]) {
    const entries = configReport({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_primary", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value }, {});
    assert.ok(entries.some((entry) => entry.level === "FAIL" && entry.message.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret")));
    assert.ok(!JSON.stringify(entries).includes(value.trim()));
  }
});
