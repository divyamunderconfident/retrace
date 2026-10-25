import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Retrace",
  description: "A time-travel debugger for AI agents: record, replay, fork and diff agent runs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-sm">
        <header className="border-b border-zinc-800 bg-zinc-950/80">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-mono font-semibold text-zinc-100">
              retrace<span className="text-emerald-400">_</span>
            </Link>
            <Link href="/" className="text-zinc-400 hover:text-zinc-100">Runs</Link>
            <Link href="/results" className="text-zinc-400 hover:text-zinc-100">Results</Link>
            <a href="https://github.com/divyamunderconfident/retrace" className="ml-auto text-zinc-400 hover:text-zinc-100">
              GitHub
            </a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-zinc-800 px-4 py-3 text-center text-xs text-zinc-500">
          Read-only viewer of saved runs. Nothing here calls a model.
        </footer>
      </body>
    </html>
  );
}
