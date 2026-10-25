import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION =
  "Record every step of an AI agent run, replay it for free, fork it at any step, and diff two runs to find the step where they split.";

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

const NAV = "rounded px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="page-glow min-h-full flex flex-col bg-no-repeat font-sans text-sm">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded focus:bg-zinc-900 focus:px-3 focus:py-1">
          Skip to content
        </a>
        <header className="sticky top-0 z-[5] border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:gap-3">
            <Link href="/" className="mr-2 font-mono text-[15px] font-semibold text-zinc-100">
              retrace<span className="text-emerald-400">_</span>
            </Link>
            <Link href="/#runs" className={NAV}>Runs</Link>
            <Link href="/results" className={NAV}>Results</Link>
            <a href="https://github.com/divyamunderconfident/retrace" className={`${NAV} ml-auto`}>GitHub</a>
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
        <footer className="border-t border-zinc-800/80 px-4 py-5 text-center text-xs text-zinc-500">
          Read-only viewer of saved runs. Nothing on this site calls a model.
        </footer>
      </body>
    </html>
  );
}
