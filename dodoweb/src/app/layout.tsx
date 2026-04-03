import React from "react";
import type { Metadata } from "next";
import { AppProviders } from "./providers";
import { BrowserZoomGuard } from "@/components/common/BrowserZoomGuard";
import "./styles.css";

export const metadata: Metadata = {
  title: "DODO",
  description:
    "Desktop web workspace for tasks, habits, notes, and focus mode.",
  icons: {
    icon: [{ url: "/dodo-icon.png", type: "image/png" }],
    shortcut: [{ url: "/dodo-icon.png", type: "image/png" }],
    apple: [{ url: "/dodo-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background font-sans text-text antialiased">
        <BrowserZoomGuard />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
