import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateServiceWorker } from "../scripts/generate-service-worker.mjs";

describe("service worker generator", () => {
	it("uses the package and main build versions in the cache name", async () => {
		const root = await mkdtemp(join(tmpdir(), "zenstream-sw-"));
		await mkdir(join(root, "public"));
		await writeFile(
			join(root, "package.json"),
			JSON.stringify({ version: "9.8.7" }),
		);
		await writeFile(
			join(root, ".main-version.json"),
			JSON.stringify({ main: 42 }),
		);
		await writeFile(
			join(root, "public/sw.template.js"),
			'const CACHE_NAME = \\"__CACHE_NAME__\\";',
		);
		await generateServiceWorker({ rootDir: root });
		await expect(
			readFile(join(root, "public/sw.js"), "utf8"),
		).resolves.toContain("zenstream-shell-v9.8.7-main.42");
	});
});
