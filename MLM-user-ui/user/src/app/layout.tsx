import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/app/providers";
import { AppLayout } from "@/components/layout/AppLayout";
import { SupportFab } from "@/components/support/SupportFab";
import { ConditionalChatFab } from "@/components/chat/ConditionalChatFab";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Secure Infinite Association - Dashboard",
  description: "Secure Infinite Association - MLM Commission Platform",
  icons: {
    icon: [
      { url: "/SIA-png-logo.png", sizes: "any" },
      { url: "/SIA-png-logo.png", type: "image/png" },
    ],
    apple: "/SIA-png-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-screen" data-theme="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AppLayout>{children}</AppLayout>
          <SupportFab />
          <ConditionalChatFab />
        </Providers>
      </body>
    </html>
  );
}
