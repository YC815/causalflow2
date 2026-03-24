import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { IBM_Plex_Sans } from "next/font/google";
import { Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const notoSerifTc = Noto_Serif_TC({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-causal-serif",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-causal-ui",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-causal-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CausalFlow — 邏輯因果圖",
  description:
    "繪製邏輯因果圖、匯入匯出 JSON／PNG／PDF、單雙向與正負相關箭頭",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSerifTc.variable} ${ibmPlexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
