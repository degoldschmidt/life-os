import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: { default: "Life OS", template: "%s · Life OS" },
  description: "Plan. Review. Repeat.",
  applicationName: "Life OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Life OS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#eceae4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-text">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
