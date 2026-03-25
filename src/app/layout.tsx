import type { Metadata } from "next";
import "./globals.css";
import CartProvider from "@/components/CartProvider";

export const metadata: Metadata = {
  title: "OpenClaw Phones | AI-Powered Samsung Galaxy A16 5G",
  description:
    "Samsung Galaxy A16 5G preloaded with OpenClaw autonomous agent system. 51 agent skills. Your personal AI army, out of the box.",
  openGraph: {
    title: "OpenClaw Phones | AI-Powered Samsung Galaxy A16 5G",
    description:
      "Samsung phones preloaded with OpenClaw. 51 agent skills. $225 phone or $1,299 full agent package.",
    type: "website",
    url: "https://openclaw-store.vercel.app",
    siteName: "OpenClaw Phones",
    images: [
      {
        url: "https://openclaw-store.vercel.app/logo.png",
        width: 512,
        height: 512,
        alt: "OpenClaw Phones",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenClaw Phones | AI-Powered Samsung Galaxy A16 5G",
    description: "51 autonomous agent skills. Your AI army, in your pocket.",
    images: ["https://openclaw-store.vercel.app/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
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
      <body className="scanline">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
