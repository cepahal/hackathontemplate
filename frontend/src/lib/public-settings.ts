/** Reject unsafe configuration before public environment values enter a browser build. */
export function validatePublicSettings(settings: {
  apiUrl?: string;
  supabaseUrl?: string;
  publicKey?: string;
}) {
  for (const [name, value] of [
    ["API", settings.apiUrl],
    ["Supabase", settings.supabaseUrl],
  ] as const) {
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} URL must be a valid origin.`);
    }
    const localApi =
      name === "API" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (!localApi && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      /\s/.test(value)
    ) {
      throw new Error(
        `${name} URL must be an HTTPS origin without credentials or a path.`,
      );
    }
  }
  const key = settings.publicKey ?? "";
  let privileged = key.startsWith("sb_secret_");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      privileged ||= payload?.role === "service_role";
    } catch {
      /* Decoding is only a configuration guard, never token authorization. */
    }
  }
  if (privileged)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY must contain a public key, never a service-role secret.",
    );
}
