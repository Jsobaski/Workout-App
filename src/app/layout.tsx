import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import NeutralDefaultsNotice from "@/components/NeutralDefaultsNotice";
import ThemeApplier from "@/components/ThemeApplier";
import CelebrationHost from "@/components/CelebrationHost";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golf Fitness Tracker",
  description: "Personal daily workout and nutrition logging for golf fitness.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Golf Fitness",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950 text-neutral-100">
        <ThemeApplier />
        <CelebrationHost />
        <NavBar />
        <main className="pb-20 sm:pb-6">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <NeutralDefaultsNotice />
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
