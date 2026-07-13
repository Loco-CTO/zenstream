import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

export const viewport = {
	themeColor: "#070707",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
} as const;

const notoSans = Noto_Sans({
	subsets: ["latin"],
	variable: "--font-noto-sans",
});

export const metadata: Metadata = {
	title: "ZenStream",
	description: "ZenStream home",
		icons: {
			icon: "/icon.png",
			apple: "/icon.png",
		},
		appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ZenStream" },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`dark ${notoSans.variable}`}>
		<body>
			<ServiceWorkerRegistration />
			<ProgressProvider>{children}</ProgressProvider>
			</body>
		</html>
	);
}
