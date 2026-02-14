import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeoGuard — Real-Time Earthquake Response Intelligence",
  description: "Emergency response intelligence for live earthquake events. Access real-time USGS data, automatic risk zoning, and actionable response plans.",
  keywords: ["earthquake", "emergency response", "disaster management", "risk assessment", "real-time alerts"],
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  robots: "index, follow",
  openGraph: {
    title: "GeoGuard",
    description: "Real-time earthquake response intelligence system",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0066cc" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased h-full min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
