import { redirect } from "next/navigation";

export default async function LegacyAlbumRoute({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/album/${encodeURIComponent(id)}`);
}
