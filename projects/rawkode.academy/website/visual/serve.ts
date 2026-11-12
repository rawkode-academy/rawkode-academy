// Static file server for the Storybook build. Run by Playwright's webServer.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../storybook-static", import.meta.url));
const port = Number(process.env.VISUAL_PORT ?? 6107);

// Storybook will not boot a story when a module arrives with the wrong type.
const CONTENT_TYPES: Record<string, string> = {
	".avif": "image/avif",
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".wasm": "application/wasm",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

createServer((request, response) => {
	const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
	const path = normalize(decodeURIComponent(pathname));
	const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
	if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
		response.writeHead(404).end("Not found");
		return;
	}
	response.writeHead(200, {
		"content-type":
			CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
	});
	createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1");
