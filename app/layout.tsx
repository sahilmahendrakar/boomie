import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ProfileMenu from "@/app/components/profile-menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Boomie",
  description: "The album companion for curious listeners.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "Boomie",
    description: "The album companion for curious listeners.",
    images: [
      {
        url: "/Boomie%20thumbnail.png",
        alt: "Boomie thumbnail",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boomie",
    description: "The album companion for curious listeners.",
    images: ["/Boomie%20thumbnail.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProfileMenu />
        {children}
      </body>
    </html>
  );
}
