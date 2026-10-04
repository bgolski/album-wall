import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Serves the static export (out/) under its base path, the way GitHub Pages does, so the
// accessibility and performance checks see the same URLs as visitors. Not used in production.
const port = Number(process.env.PORT ?? 3100);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const root = join(process.cwd(), "out");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

async function findFile(relativePath: string): Promise<string | null> {
  const clean = normalize(decodeURIComponent(relativePath)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [clean, `${clean}.html`, join(clean, "index.html")]) {
    const full = join(root, candidate);
    if (!full.startsWith(root)) return null;
    try {
      if ((await stat(full)).isFile()) return full;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");

  if (basePath && (pathname === "/" || pathname === basePath)) {
    response.writeHead(302, { Location: `${basePath}/` }).end();
    return;
  }

  const inside = !basePath || pathname.startsWith(`${basePath}/`);
  const file = inside ? await findFile(pathname.slice(basePath.length)) : null;

  if (!file) {
    response.writeHead(404, { "Content-Type": types[".html"] });
    response.end(await readFile(join(root, "404.html")));
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  response.end(await readFile(file));
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${basePath}/`));
