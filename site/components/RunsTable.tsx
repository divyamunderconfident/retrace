"use client";

import Link from "next/link";
import { useState } from "react";
import type { RunMeta } from "@/lib/data";

const FILTERS = [["all", "All runs"], ["correct", "Baselines"], ["broken", "With a bug"]] as const;
const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold";
const ACTION = "rt-lift inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold no-underline";

export function RunsTable({ runs }: { runs: RunMeta[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const shown = runs.filter((r) => filter === "all" || r.role === filter);

  return (
    <>
      <div role="group" aria-label="Filter runs" className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 cursor-pointer rounded-full border-[3px] border-ink px-5 text-[15px] font-bold ${filter === key ? "bg-ink text-sun" : "bg-white text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[28px] border-[3px] border-ink bg-white">
        <div className="relative overflow-x-auto">{/* relative: keeps the sr-only header inside the scroll area */}
          <table className="w-full min-w-[900px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-ink text-left text-[13px] uppercase tracking-[0.6px] text-sun">
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-3 py-3.5">Run</th>
                <th scope="col" className="px-3 py-3.5">Question</th>
                <th scope="col" className="px-3 py-3.5">Kind</th>
                <th scope="col" className="px-3 py-3.5 text-right">Steps</th>
                <th scope="col" className="px-3 py-3.5 text-right">Tokens</th>
                <th scope="col" className="py-3.5 pr-5 pl-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={`border-t-2 border-rule transition-colors hover:bg-paper ${r.role === "broken" ? "bg-[#FFFCF5]" : ""}`}>
                  <td className="px-5 py-3.5">
                    <span className={`${PILL} ${r.stopped ? "bg-verm" : "border-2 border-ink bg-white"}`}>{r.stopped ? "Stopped" : "Answered"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[13px]">{r.id.slice(0, 8)}</td>
                  <td className="max-w-[380px] px-3 py-3.5 leading-snug">{r.question}</td>
                  <td className="px-3 py-3.5">
                    <span className={`${PILL} ${r.role === "correct" ? "bg-paper" : "bg-sun"}`}>{r.role === "correct" ? "baseline" : r.type}</span>
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{r.steps ?? "—"}</td>
                  <td className="px-3 py-3.5 text-right font-bold tabular-nums">{r.tokens.toLocaleString("en-US")}</td>
                  <td className="whitespace-nowrap py-2.5 pr-5 pl-3">
                    {r.has_file ? (
                      <span className="flex gap-2">
                        <Link href={`/runs/${r.id}`} className={`${ACTION} bg-ink text-sun`}>Open run</Link>
                        {r.diff && r.role === "broken" && (
                          <Link href={`/diffs/${r.diff}`} className={`${ACTION} bg-verm text-ink`}>Diff vs baseline</Link>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm italic">summary only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
