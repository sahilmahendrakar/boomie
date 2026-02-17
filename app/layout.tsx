import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ProfileMenu from "@/app/components/profile-menu";
import { Analytics } from "@vercel/analytics/next";

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
  icons: {
    icon: "/boomie-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://listenboomie.com",
    title: "Boomie",
    description: "The album companion for curious listeners.",
    siteName: "Boomie",
    images: [
      {
        url: "https://listenboomie.com/boomie-thumbnail.png",
        width: 1394,
        height: 870,
        alt: "Boomie - The album companion for curious listeners.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Boomie",
    description: "The album companion for curious listeners.",
    images: ["/boomie-thumbnal.png"],
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
        <Analytics />
      </body>
    </html>
  );
}
