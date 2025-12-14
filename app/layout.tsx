import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navigation from "./components/Navigation";

export const metadata: Metadata = {
  title: "Tormentor DEX",
  description: "A decentralized exchange built on IOTA blockchain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0b0a0a] text-[#f6e7de]">
        <Providers>
          <div className="min-h-screen bg-[#0b0a0a]">
            <Navigation />
            <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
