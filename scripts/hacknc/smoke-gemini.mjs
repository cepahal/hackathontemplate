import { join } from "node:path";
import { backend, configured, readEnv } from "./common.mjs";

const file = readEnv(join(backend, ".env"));
const key = process.env.GEMINI_API_KEY || file.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || file.GEMINI_MODEL;

if (!configured(key) || !configured(model)) {
  console.error("Set GEMINI_API_KEY and GEMINI_MODEL in the ignored backend .env first. No request was sent.");
  process.exitCode = 1;
} else if (!/^[A-Za-z0-9._-]{1,100}$/.test(model)) {
  console.error("GEMINI_MODEL has an invalid model name. No request was sent.");
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly HACKNC_OK." }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      console.error(`Gemini rejected the live check (HTTP ${response.status}). Check project, key, model access, and quota in AI Studio. Response details were omitted.`);
      process.exitCode = 1;
    } else {
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || "").join("").trim();
      if (text !== "HACKNC_OK") {
        console.error("Gemini responded, but the expected smoke-test marker was absent. Live generation is not yet verified.");
        process.exitCode = 1;
      } else {
        console.log(`Gemini live generation passed for ${model}. This does not verify Supabase, auth, or application routes.`);
      }
    }
  } catch {
    console.error("Gemini live check failed before a usable response. Check network/TLS configuration; no credential or raw error was printed.");
    process.exitCode = 1;
  }
}
