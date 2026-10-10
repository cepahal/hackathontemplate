import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { frontend } from "./common.mjs";

const requireFrontend = createRequire(join(frontend, "package.json"));
const ts = requireFrontend("typescript");
const source = readFileSync(join(frontend, "src", "lib", "supabase", "config.ts"), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });

test("public previews tolerate absent config; auth clients, partial config and secret keys fail closed", async () => {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  const original = names.map((name) => process.env[name]);
  let caseNumber = 0;
  async function config(values) {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, values);
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}#${caseNumber++}`);
  }
  try {
    const absent = await config({});
    assert.equal(absent.getOptionalSupabaseConfig(), null);
    assert.throws(() => absent.getSupabaseConfig(), /Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    const blank = await config({ NEXT_PUBLIC_SUPABASE_URL: " ", NEXT_PUBLIC_SUPABASE_ANON_KEY: " " });
    assert.equal(blank.getOptionalSupabaseConfig(), null);

    const urlOnly = await config({ NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co" });
    assert.throws(() => urlOnly.getOptionalSupabaseConfig(), /Missing NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    const keyOnly = await config({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test" });
    assert.throws(() => keyOnly.getOptionalSupabaseConfig(), /Missing NEXT_PUBLIC_SUPABASE_URL/);

    const secret = await config({ NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_test" });
    assert.throws(() => secret.getOptionalSupabaseConfig(), /secret\/service-role key/);

    const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
    const legacySecret = await config({ NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt });
    assert.throws(() => legacySecret.getOptionalSupabaseConfig(), /secret\/service-role key/);

    const badUrl = await config({ NEXT_PUBLIC_SUPABASE_URL: "file:///local", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test" });
    assert.throws(() => badUrl.getOptionalSupabaseConfig(), /must start with https/);

    const valid = await config({ NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co/", NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test" });
    assert.deepEqual(valid.getOptionalSupabaseConfig(), { url: "https://test.supabase.co", publishableKey: "sb_publishable_test" });
    assert.strictEqual(valid.getSupabaseConfig(), valid.getOptionalSupabaseConfig());
    const alias = await config({ NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" });
    assert.deepEqual(alias.getSupabaseConfig(), { url: "https://test.supabase.co", publishableKey: "sb_publishable_test" });
  } finally {
    names.forEach((name, index) => {
      if (original[index] === undefined) delete process.env[name];
      else process.env[name] = original[index];
    });
  }
});
