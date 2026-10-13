import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { NoZoom } from "@/components/NoZoom";

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
  width: "device-width",
  initialScale: 1,
  // La app se queda siempre a escala 1: sin zoom al tocar un campo (en iPhone dejaba las hojas cortadas)
  // ni con dos dedos. Safari de iPhone ignora esto en parte; lo completa <NoZoom />.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={vietnam.variable}>
      <body>
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
