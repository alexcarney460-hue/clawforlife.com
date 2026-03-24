import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw | AI-Powered Phone",
  description:
    "Samsung phones preloaded with OpenClaw autonomous agent system. Your personal AI army, out of the box.",
  openGraph: {
    title: "OpenClaw | AI-Powered Phone",
    description: "Samsung phones preloaded with OpenClaw. $225 phone or $1,299 full agent package.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="scanline">{children}</body>
    </html>
  );
}
