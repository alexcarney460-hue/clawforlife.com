import type { Metadata } from "next";
import "./globals.css";
import CartProvider from "@/components/CartProvider";

export const metadata: Metadata = {
  title: "ClawForLife | AI-Powered Business Phones",
  description:
    "Business phones with built-in AI assistant handling calls, scheduling & customer service 24/7. Samsung Galaxy A16 5G with OpenClaw pre-installed.",
  openGraph: {
    title: "ClawForLife — AI-Powered Business Phones",
    description:
      "Business phones with built-in AI assistant handling calls & scheduling 24/7. Your AI receptionist, out of the box.",
    type: "website",
    url: "https://openclaw-store.vercel.app",
    siteName: "ClawForLife",
    images: [
      {
        url: "https://openclaw-store.vercel.app/logo.png",
        width: 512,
        height: 512,
        alt: "ClawForLife - AI Business Phones",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClawForLife | AI-Powered Business Phones",
    description: "Business phones with built-in AI handling calls & scheduling 24/7.",
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
