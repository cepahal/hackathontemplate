// Local-only preview of `expo export --platform web` for UI checks.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../dist");
const port = Number(process.env.PORT ?? 8082);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let file;
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) {
      response.writeHead(404).end();
      return;
    }
  } catch {
    response.writeHead(400).end();
    return;
  }
  for (const candidate of [file, `${file}.html`, resolve(file, "index.html")]) {
    try {
      if (!(await stat(candidate)).isFile()) continue;
      const content = await readFile(candidate);
      response.writeHead(200, {
        "Content-Type": types[extname(candidate)] ?? "application/octet-stream",
        "Content-Length": content.length,
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : content);
      return;
    } catch {
      /* Try the next static route. */
    }
  }
  response.writeHead(404).end("Not found");
}).listen(port, "127.0.0.1", () =>
  console.log(`Mobile UI preview: http://127.0.0.1:${port}`),
);
