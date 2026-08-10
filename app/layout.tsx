import type { Metadata } from "next";
import { Archivo, Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import CursorRing from "@/components/CursorRing";
import Loader from "@/components/Loader";
import TextReveal from "@/components/TextReveal";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veyra — Freight, unified.",
  description:
    "Veyra moves freight across APAC by sea, air and road on a single operating layer. Live visibility, one contract, every mile accounted for.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html>: the @theme font tokens are emitted on
    // :root and reference them, so defining them any lower breaks var()
    // substitution at the root and the tokens compute to invalid.
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${spaceMono.variable}`}
    >
      <body className="bg-paper text-ink antialiased">
        {children}
        {/* Site-wide pointer accent, above every act and every section. */}
        <CursorRing />
        {/* The first two seconds, over everything. */}
        <Loader />
        {/* One pass that wires every heading and paragraph to the wipe. */}
        <TextReveal />
      </body>
    </html>
  );
}
