const BADGE: Record<string, string> = {
  model: "bg-sky-950 text-sky-300 ring-sky-800",
  tool: "bg-violet-950 text-violet-300 ring-violet-800",
  live: "bg-zinc-900 text-zinc-300 ring-zinc-700",
  replay: "bg-emerald-950 text-emerald-300 ring-emerald-800",
  edited: "bg-amber-950 text-amber-300 ring-amber-800",
  correct: "bg-emerald-950 text-emerald-300 ring-emerald-800",
  broken: "bg-rose-950 text-rose-300 ring-rose-800",
};

export function Badge({ children }: { children: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset ${BADGE[children] ?? BADGE.live}`}>
      {children}
    </span>
  );
}

export function Json({ value, className = "" }: { value: unknown; className?: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre className={`overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300 ${className}`}>
      {text}
    </pre>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl text-zinc-100">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-400">{note}</div>}
    </div>
  );
}

export function H1({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rise mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{children}</h1>
      {sub && <p className="mt-1 text-zinc-400">{sub}</p>}
    </div>
  );
}
