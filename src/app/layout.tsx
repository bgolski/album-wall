import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { getBasePath } from "@/utils/basePath";
import Footer from "@/components/layout/Footer";

const basePath = getBasePath();

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

// Runs before the first paint so the page never flashes the wrong theme: the saved choice wins,
// otherwise the device's light or dark setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Vinyl Wall - Your Virtual Record Collection Display",
  description:
    "A dynamic, interactive wall display for your Discogs vinyl collection. Create customizable grid layouts, sort by artist or genre, pin favorite albums, and save or share your wall as an image.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${fraunces.variable} antialiased bg-page text-ink min-h-screen flex flex-col`}
      >
        <main className="grow">{children}</main>

        <Footer />
      </body>
    </html>
  );
}
