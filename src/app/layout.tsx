import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getBasePath } from "@/utils/basePath";
import Footer from "@/components/layout/Footer";

const basePath = getBasePath();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#111827", // bg-gray-900
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Vinyl Wall - Your Virtual Record Collection Display",
  description:
    "A dynamic, interactive wall display for your Discogs vinyl collection. Create customizable grid layouts, sort by artist or genre, pin favorite albums, and export your collection as an image or CSV.",
  metadataBase: new URL(process.env.VERCEL_URL || "https://bgolski.github.io"),
  icons: {
    icon: `${basePath}/favicon.ico`,
  },
  openGraph: {
    title: "Vinyl Wall - Your Virtual Record Collection Display",
    description:
      "Create a beautiful virtual display of your Discogs vinyl collection with customizable layouts and sharing options.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vinyl Wall - Your Virtual Record Collection Display",
    description:
      "Create a beautiful virtual display of your Discogs vinyl collection with customizable layouts and sharing options.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Note: Add a manifest.json at public/ if you need a PWA manifest
  // manifest: `${basePath}/manifest.json`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-white min-h-screen flex flex-col`}
      >
        <main className="flex-grow">{children}</main>

        <Footer />
      </body>
    </html>
  );
}
