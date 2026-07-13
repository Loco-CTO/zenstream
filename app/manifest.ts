import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "ZenStream",
		short_name: "ZenStream",
		description: "Stream your library with ZenStream.",
		start_url: "/",
		display: "standalone",
		background_color: "#070707",
		theme_color: "#070707",
		orientation: "any",
		icons: [
			{
				src: "/icon.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
