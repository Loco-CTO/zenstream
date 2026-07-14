import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function generateServiceWorker({ rootDir = root } = {}) {
	const [packageJson, mainVersion, template] = await Promise.all([
		readFile(resolve(rootDir, "package.json"), "utf8").then(JSON.parse),
		readFile(resolve(rootDir, ".main-version.json"), "utf8").then(JSON.parse),
		readFile(resolve(rootDir, "public/sw.template.js"), "utf8"),
	]);
	const buildVersion = `v${packageJson.version}-main.${mainVersion.main}`;
	const output = template.replace(
		"__CACHE_NAME__",
		`zenstream-shell-${buildVersion}`,
	);
	await writeFile(resolve(rootDir, "public/sw.js"), output);
	return { buildVersion, output };
}

if (process.argv[1] === fileURLToPath(import.meta.url))
	await generateServiceWorker();
