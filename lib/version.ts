import packageJson from "../package.json";
import mainVersion from "../.main-version.json";

export function formatVersion(version: string, main: number): string {
	return main === 0 ? `v${version}` : `v${version}-main.${main}`;
}

export const zenstreamVersion = formatVersion(packageJson.version, mainVersion.main);

export async function fetchOrchestratorVersion(): Promise<string | null> {
	try {
		const base = (process.env.NEXT_PUBLIC_ZSO_URL ?? "").replace(/\/+$/, "");
		const response = await fetch(`${base}/api/version`);
		if (!response.ok) return null;
		const payload = (await response.json()) as {
			version?: unknown;
			main?: unknown;
		};
		if (
			typeof payload.version !== "string" ||
			typeof payload.main !== "number" ||
			!Number.isInteger(payload.main) ||
			payload.main < 0
		)
			return null;
		return formatVersion(payload.version, payload.main);
	} catch {
		return null;
	}
}
