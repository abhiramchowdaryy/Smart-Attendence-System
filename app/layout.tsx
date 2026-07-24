import type { Metadata, Viewport } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PES Smart Attendance",
    template: "%s · PES Smart Attendance",
  },
  description:
    "Smart Attendance Management System with Facial Recognition and Performance Analytics — PES University",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "PES Attendance" },
  icons: {
    icon: [
      { url: "/pes-emblem.png", type: "image/png", sizes: "184x184" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/app-icon-512.png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A8A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply persisted theme before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("pes-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} min-h-dvh`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
