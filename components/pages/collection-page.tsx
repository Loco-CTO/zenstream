"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PosterCard } from "@/components/home/media-card";
import type { DetailData } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

export function CollectionPage({
	initialData,
	session,
}: {
	initialData: DetailData;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const items = initialData.collectionItems ?? [];

	function goBack() {
		if (window.history.length > 1) {
			router.back();
			return;
		}
		router.push("/");
	}

	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
			<header className="mb-8">
				<button
					type="button"
					onClick={goBack}
					aria-label={t("back")}
					className="flex items-center gap-1 rounded-md px-2 py-2 text-xs uppercase tracking-wider text-white/60 hover:text-white"
				>
					<ChevronLeft className="h-4 w-4" />
					{t("back")}
				</button>
				<div className="mt-3 min-w-0">
					<h1 className="max-w-full break-words text-3xl font-black leading-none tracking-tight text-white md:text-4xl">
						{initialData.item.Name}
					</h1>
					<p className="mt-1 text-xs uppercase tracking-widest text-white/25">
						{t("collectionItems", { count: items.length })}
					</p>
				</div>
			</header>
			{items.length === 0 ? (
				<div className="mt-8 rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center text-white/40">
					{t("collectionEmpty")}
				</div>
			) : (
				<div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-x-5 [&>article]:w-full">
					{items.map((item) => (
						<PosterCard key={item.Id} item={item} session={session} />
					))}
				</div>
			)}
		</main>
	);
}
