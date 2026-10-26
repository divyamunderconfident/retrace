import type { Metadata } from "next";
import { Anton, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

const DESCRIPTION =
  "Record every step of an AI agent run, replay it, fork it at any step, and diff two runs to find the step where they split.";

export const metadata: Metadata = {
  // Vercel sets this at build time; absolute URLs make the Open Graph image work when the link is shared.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  title: { default: "Retrace: a time-travel debugger for AI agents", template: "%s · Retrace" },
  description: DESCRIPTION,
  openGraph: { title: "Retrace: a time-travel debugger for AI agents", description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-full font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-bold">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
