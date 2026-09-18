import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Avocado ERP",
  description: "Avocado Business ERP & Management Dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
