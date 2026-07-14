import packageJson from "../package.json";
import mainVersion from "../.main-version.json";

export const zenstreamVersion = `v${packageJson.version}-main.${mainVersion.main}`;

export async function fetchOrchestratorVersion(): Promise<string | null> {
	try {
		const base = (process.env.NEXT_PUBLIC_ZSO_URL ?? "").replace(/\/+$/, "");
		const response = await fetch(`${base}/api/zenstream/version`);
		if (!response.ok) return null;
		const payload = (await response.json()) as { version?: unknown; main?: unknown };
		if (typeof payload.version !== "string" || typeof payload.main !== "number") return null;
		return `v${payload.version}-main.${payload.main}`;
	} catch {
		return null;
	}
}
