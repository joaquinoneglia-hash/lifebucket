import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const vietnam = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LifeBucket",
  description: "Planificador de balance de vida en cinco cuadrantes.",
};

export const viewport: Viewport = {
  themeColor: "#F6F8FB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={vietnam.variable}>
      <body>{children}</body>
    </html>
  );
}
