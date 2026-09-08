import type { Metadata } from "next";
import { Providers } from "./providers";
import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Khám Bệnh Từ Xa",
  description: "Nền tảng đặt lịch khám và tư vấn sức khỏe trực tuyến.",
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
