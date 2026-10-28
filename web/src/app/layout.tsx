import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const sans = Noto_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://upsc.calecutech.com"),
  title: { default: "Algo UPSC — algorithmic learning for UPSC Prelims", template: "%s · Algo UPSC" },
  description:
    "Algo UPSC decides what you study for UPSC Prelims 2027: one small card at a time, at your study times, spaced so it sticks. English and Hindi.",
  applicationName: "Algo UPSC",
  
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  openGraph: {
    title: "Algo UPSC — UPSC Prelims, one small card at a time",
    description: "Spaced, algorithmic study for UPSC Prelims 2027 in English and Hindi. By Calecute Technologies.",
    url: "https://upsc.calecutech.com",
    siteName: "Algo UPSC",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c2140",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${deva.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
