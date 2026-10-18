"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import type { Trends } from "@/lib/services/trends";

const tick = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" };
const grid = <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />;
const tip = (
  <Tooltip
    cursor={{ stroke: "var(--line)" }}
    contentStyle={{ background: "var(--ink)", border: "none", borderRadius: 8, color: "var(--on-ink)", fontSize: 12, fontFamily: "var(--font-mono)" }}
    labelStyle={{ color: "var(--on-ink-muted)" }}
    itemStyle={{ color: "var(--on-ink)" }}
  />
);

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-[14px] text-muted">{children}</p>;
}

function Legend({ items }: { items: { label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex gap-4">
      {items.map((i) => (
        <span key={i.label} className="label flex items-center gap-2 text-muted">
          <i className="block w-5" style={{ borderTop: `1.5px ${i.dashed ? "dashed" : "solid"} var(--text)`, opacity: i.dashed ? 0.55 : 1 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function TrendCharts({ trends }: { trends: Trends }) {
  const { weeks, days, areaScores, areaTargetsHours } = trends;
  const codes = Object.keys(areaTargetsHours);
  const noWeeks = weeks.length === 0;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="grid gap-[14px] lg:grid-cols-2">
        <Tile>
          <div className="flex items-center justify-between"><Label>Planned vs done, habits · % per week</Label></div>
          <Rule dotted />
          {noWeeks ? <Empty>Finish a weekly review to start this line.</Empty> : (
            <>
              <div className="h-[200px]" role="img" aria-label="Planned versus done and habit completion by week">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    {grid}
                    <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={tick} axisLine={false} tickLine={false} />
                    {tip}
                    <Line type="monotone" dataKey="plannedVsDone" name="Planned vs done" stroke="var(--text)" strokeWidth={1.8} dot={{ r: 2.5, fill: "var(--text)" }} connectNulls />
                    <Line type="monotone" dataKey="habitRate" name="Habits" stroke="var(--text)" strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2"><Legend items={[{ label: "Planned vs done" }, { label: "Habits", dashed: true }]} /></div>
            </>
          )}
        </Tile>

        <Tile>
          <div className="flex items-center justify-between"><Label>Deep work · hours per week</Label></div>
          <Rule dotted />
          {noWeeks ? <Empty>Appears after your first weekly review.</Empty> : (
            <div className="h-[200px]" role="img" aria-label="Deep work hours by week">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  {grid}
                  <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} />
                  {tip}
                  <Bar dataKey="deepHours" name="Deep hours" fill="var(--text)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tile>
      </div>

      <Tile>
        <div className="flex items-center justify-between"><Label>Mood and energy · daily, last 30 shutdowns</Label></div>
        <Rule dotted />
        {days.length === 0 ? <Empty>Complete a daily shutdown with mood and energy to see this.</Empty> : (
          <>
            <div className="h-[200px]" role="img" aria-label="Mood and energy by day">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  {grid}
                  <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={tick} axisLine={false} tickLine={false} />
                  {tip}
                  <Line type="monotone" dataKey="mood" name="Mood" stroke="var(--text)" strokeWidth={1.8} dot={{ r: 2.5, fill: "var(--text)" }} connectNulls />
                  <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--text)" strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2"><Legend items={[{ label: "Mood" }, { label: "Energy", dashed: true }]} /></div>
          </>
        )}
      </Tile>

      <Tile>
        <div className="flex items-center justify-between"><Label>Attention per area · scheduled hours per week</Label><Label>— target</Label></div>
        <Rule dotted />
        {noWeeks ? <Empty>Appears after your first weekly review.</Empty> : (
          <div className="grid gap-6 sm:grid-cols-2">
            {codes.map((code) => {
              const data = weeks.map((w) => ({ label: w.label, hours: w.areaHours[code] ?? 0 }));
              const target = areaTargetsHours[code];
              return (
                <div key={code}>
                  <div className="flex justify-between"><Label>{code}</Label>{target ? <Mono className="text-muted">TARGET {target} H</Mono> : null}</div>
                  <div className="mt-2 h-[110px]" role="img" aria-label={`${code} hours by week`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
                        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                        <YAxis tick={tick} axisLine={false} tickLine={false} />
                        {tip}
                        {target ? <ReferenceLine y={target} stroke="var(--orange)" strokeDasharray="3 3" /> : null}
                        <Bar dataKey="hours" name="Hours" fill="var(--text)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Tile>

      <Tile>
        <div className="flex items-center justify-between"><Label>Area ratings · each quarter</Label></div>
        <Rule dotted />
        {areaScores.length === 0 ? <Empty>Rate your areas in the quarterly review to track how each one feels.</Empty> : (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="label pb-2 font-normal text-muted">Quarter</th>
                {codes.map((c) => <th key={c} className="label pb-2 font-normal text-muted">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {areaScores.map((q) => (
                <tr key={q.periodId} className="leader">
                  <td className="mono py-2">{q.periodId}</td>
                  {codes.map((c) => <td key={c} className="thin py-2 text-[24px]">{q.scores[c] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tile>
    </div>
  );
}
