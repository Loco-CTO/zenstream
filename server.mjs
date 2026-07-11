import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import module from "node:module";

const require = module.createRequire(import.meta.url);
process.env.NODE_ENV = "production";
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(
	JSON.parse(readFileSync(".next/required-server-files.json", "utf8")).config,
);
const next = require("next");
const app = next({ dev: false, dir: "." });
const handle = app.getRequestHandler();
const websocketPrefix = "/api/syncplay/ws";

function websocketTarget(requestUrl) {
	const base = process.env.ZSO_WEBSOCKET_URL ?? defaultWebsocketBase();
	if (!base || !requestUrl.startsWith(websocketPrefix)) return null;
	const path = requestUrl.slice(websocketPrefix.length) || "/";
	return new URL(path, base.endsWith("/") ? base : `${base}/`);
}

function defaultWebsocketBase() {
	if (!process.env.ZSO_URL) return null;
	const url = new URL(process.env.ZSO_URL);
	url.port = "9091";
	return url.toString();
}

function sendUpgradeResponse(socket, response) {
	const status = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n`;
	const headers = response.rawHeaders.reduce(
		(text, value, index) => index % 2 === 0 ? `${text}${value}: ` : `${text}${value}\r\n`,
		status,
	);
	socket.write(`${headers}\r\n`);
}

await app.prepare();

const server = http.createServer((request, response) => handle(request, response));
server.on("upgrade", (request, socket, head) => {
	const target = websocketTarget(request.url ?? "");
	if (!target) {
		socket.destroy();
		return;
	}
	const transport = target.protocol === "wss:" || target.protocol === "https:" ? https : http;
	const upstream = transport.request({
		protocol: target.protocol === "wss:" ? "https:" : target.protocol === "ws:" ? "http:" : target.protocol,
		host: target.hostname,
		port: target.port || undefined,
		path: `${target.pathname}${target.search}`,
		headers: {
			...request.headers,
			host: target.host,
			connection: "Upgrade",
			upgrade: "websocket",
		},
	});
	upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
		sendUpgradeResponse(socket, response);
		if (upstreamHead.length) socket.write(upstreamHead);
		if (head.length) upstreamSocket.write(head);
		socket.pipe(upstreamSocket).pipe(socket);
	});
	upstream.on("response", (response) => {
		sendUpgradeResponse(socket, response);
		socket.end();
	});
	upstream.on("error", (error) => {
		console.error("Syncplay WebSocket upstream connection failed", {
			code: error.code,
			message: error.message,
			target: target.origin,
		});
		socket.destroy();
	});
	upstream.end();
});

server.listen(Number(process.env.PORT) || 3000, process.env.HOSTNAME || "0.0.0.0");
