import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kham Benh Tu Xa",
  description: "Telemedicine web app for remote appointments and video consultations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

