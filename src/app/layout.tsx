import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursive — Mobile & Web Code Editor",
  description:
    "A smooth, mobile-friendly code editor with AI suggestions, theming, and in-browser execution.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/favicon-32.png",
        sizes: "32x32",
      },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cursive",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1b2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full w-full overflow-hidden antialiased bg-slate-950 text-slate-100 select-none">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
