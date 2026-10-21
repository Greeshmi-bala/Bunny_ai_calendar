import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bunny AI Calendar",
    template: "%s | Bunny AI Calendar",
  },
  description:
    "A beautifully simple AI-powered calendar for managing your schedule, tasks, and daily priorities.",
  applicationName: "Bunny AI Calendar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bunny AI Calendar",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF7F4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
