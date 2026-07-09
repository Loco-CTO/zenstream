import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { ProgressProvider } from "@/components/status/progress-indicator";
import "./globals.css";

const notoSans = Noto_Sans({
	subsets: ["latin"],
	variable: "--font-noto-sans",
});

export const metadata: Metadata = {
	title: "ZenStream",
	description: "ZenStream home",
	icons: {
		icon: "/icon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`dark ${notoSans.variable}`}>
			<body>
				<ProgressProvider>{children}</ProgressProvider>
			</body>
		</html>
	);
}
