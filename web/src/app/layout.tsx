import type { Metadata } from "next";
import { Cormorant_Garamond, EB_Garamond, Noto_Serif_Tamil } from "next/font/google";
import AuthBoot from "@/components/AuthBoot";
import "./globals.css";

const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const body = EB_Garamond({ variable: "--font-body", subsets: ["latin"], style: ["normal", "italic"] });
const tamil = Noto_Serif_Tamil({ variable: "--font-tamil", subsets: ["tamil"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Solveli · சொல்வெளி",
  description: "Every Tamil word has a world inside it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${tamil.variable}`}>
      <body><AuthBoot />{children}</body>
    </html>
  );
}
