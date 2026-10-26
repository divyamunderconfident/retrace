import Link from "next/link";
import { Logo } from "@/components/art";

export const GITHUB = "https://github.com/divyamunderconfident/retrace";
export const FREE_TIER_NOTE = "Runs used free API tiers; tokens shown instead of cost.";

export function fmt(n: number) {
  return n.toLocaleString("en-US");
}

const NAV = "inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-bold";

/** Dark header and cream page used by the tool pages (runs, run, diff, results). */
export function ToolShell({ current, children }: { current?: "try" | "runs" | "results"; children: React.ReactNode }) {
  const tab = (key: "try" | "runs" | "results", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`${NAV} ${current === key ? "bg-sun text-ink" : "text-sun hover:bg-white/10"}`}
    >
      {label}
    </Link>
  );
  return (
    <>
      <header className="bg-ink px-[clamp(16px,4vw,56px)] py-3.5 text-sun">
        <nav aria-label="Main" className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link href="/" className="flex items-center gap-2.5 text-sun no-underline">
            <Logo size={36} ring="#FFDB8E" />
            <span className="display text-[26px]">Retrace</span>
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            {tab("try", "/try", "Try it")}
            {tab("runs", "/runs", "Runs")}
            {tab("results", "/results", "Results")}
            <a href={GITHUB} className={`${NAV} ml-2 border-2 border-sun text-sun hover:bg-white/10`}>GitHub</a>
          </div>
        </nav>
      </header>
      <main id="main" className="px-[clamp(16px,4vw,56px)] pt-8 pb-16">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-7">{children}</div>
      </main>
    </>
  );
}

export function Crumb({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-sm font-bold">
      <Link href="/runs" className="underline">Runs</Link> <span aria-hidden="true">/</span> {children}
    </p>
  );
}

/** A labelled monospace block for inputs and outputs. */
export function Block({ label, text, alert = false, className = "" }: { label: string; text: string; alert?: boolean; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={`max-w-full self-start rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.6px] [overflow-wrap:anywhere] ${alert ? "bg-verm" : "bg-white"}`}>
        {label}
      </span>
      <pre className={`m-0 overflow-auto whitespace-pre-wrap rounded-[14px] px-3.5 py-3 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere] ${alert ? "border-[3px] border-dashed border-verm bg-paper" : "bg-cream"} ${className}`}>
        {text}
      </pre>
    </div>
  );
}

export function StepNum({ n, active = false, small = false }: { n: number; active?: boolean; small?: boolean }) {
  return (
    <span
      className={`display flex flex-none items-center justify-center rounded-full ${small ? "h-9 w-9 text-[17px]" : "h-[38px] w-[38px] text-lg"} ${
        active ? "border-[3px] border-ink bg-verm text-ink" : "bg-ink text-sun"
      }`}
    >
      {n}
    </span>
  );
}

export function Chip({ children, tone = "sun", mono = false }: { children: React.ReactNode; tone?: "sun" | "white" | "ink" | "paper" | "verm"; mono?: boolean }) {
  const tones = {
    sun: "bg-sun",
    white: "border-2 border-ink bg-white",
    ink: "bg-ink text-sun",
    paper: "bg-paper",
    verm: "bg-verm",
  };
  return (
    <span className={`rounded-full px-3.5 py-1.5 text-sm ${mono ? "font-mono text-[13px]" : "font-bold"} ${tones[tone]}`}>{children}</span>
  );
}
