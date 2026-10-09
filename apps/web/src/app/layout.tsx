import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";
import { ToastProvider } from "@/components/Toast";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "FaceOff — You have a voice", template: "%s · FaceOff" },
  description: "Live, unscripted, one-on-one ten-minute debates. Challenge an idea, defend a position, and let the audience weigh in.",
  applicationName: "FaceOff",
  openGraph: { type: "website", siteName: "FaceOff", title: "FaceOff — You have a voice", description: "The Fight Club for Ideas: live one-on-one debates anyone can join." },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7EF" },
    { media: "(prefers-color-scheme: dark)", color: "#161B20" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
