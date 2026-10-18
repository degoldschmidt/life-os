import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { Tile } from "@/components/ui/tile";
import { Label, Mono, Rule } from "@/components/ui/label";
import { ThinNumber } from "@/components/ui/thin-number";
import { QuickEntry } from "@/components/journal/quick-entry";
import { DayNote } from "@/components/journal/day-note";
import { DeleteEntry } from "@/components/journal/delete-entry";
import { requireUser } from "@/lib/auth";
import { addDaysToKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { listDayEntries, recentDays } from "@/lib/services/journal";

export const metadata: Metadata = { title: "Journal" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const KIND_LABEL: Record<string, string> = {
  morning: "Intention",
  interstitial: "Note",
  shutdown: "Shutdown",
  freeform: "Day note",
};

export default async function JournalPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayKey(settings.tz, settings.dayStartHour);

  const wanted = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const day = wanted > today ? today : wanted;
  const isToday = day === today;
  const prev = addDaysToKey(day, -1, settings.tz);
  const next = addDaysToKey(day, 1, settings.tz);

  const [entries, recent] = await Promise.all([
    listDayEntries(user.id, day),
    recentDays(user.id, addDaysToKey(today, -30, settings.tz), today),
  ]);

  const note = entries.find((e) => e.kind === "freeform");
  const timeline = entries.filter((e) => e.kind !== "freeform");
  const mood = [...entries].reverse().find((e) => e.mood != null)?.mood ?? null;
  const energy = [...entries].reverse().find((e) => e.energy != null)?.energy ?? null;
  const d = dayKeyToDate(day, settings.tz);

  return (
    <div className="grid gap-[14px] md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <Tile dark className="flex flex-col">
        <div className="flex items-center justify-between">
          <Label>{format(d, "EEE")}{isToday ? " · today" : ""}</Label>
          <span className="flex gap-3">
            <Link href={`/journal?d=${prev}`} aria-label="Previous day" className="label text-muted hover:text-on-ink">←</Link>
            {isToday ? (
              <span className="label text-muted opacity-40" aria-hidden="true">→</span>
            ) : (
              <Link href={next >= today ? "/journal" : `/journal?d=${next}`} aria-label="Next day" className="label text-muted hover:text-on-ink">→</Link>
            )}
          </span>
        </div>
        <ThinNumber size={112} className="mt-5">{format(d, "d")}</ThinNumber>
        <Label className="mt-1 text-on-ink">{format(d, "MMMM yyyy")}</Label>
        <Rule dotted className="my-5" />
        <div className="mono flex justify-between"><span className="text-muted">MOOD</span><span>{mood ?? "—"}</span></div>
        <div className="mono mt-2 flex justify-between"><span className="text-muted">ENERGY</span><span>{energy ?? "—"}</span></div>
        <div className="mono mt-2 flex justify-between"><span className="text-muted">ENTRIES</span><span>{entries.length}</span></div>
        {!isToday ? (
          <Link href="/journal" className="label mt-auto pt-6 text-muted underline hover:text-on-ink">Back to today</Link>
        ) : null}
      </Tile>

      <div className="flex flex-col gap-[14px]">
        {isToday ? (
          <Tile>
            <Label>Right now</Label>
            <div className="mt-3"><QuickEntry /></div>
          </Tile>
        ) : null}

        <Tile>
          <div className="flex justify-between">
            <Label>Timeline</Label>
            <Label>{timeline.length}</Label>
          </div>
          <Rule dotted />
          {timeline.length === 0 ? (
            <p className="py-4 text-[14px] text-muted">
              {isToday ? "Nothing yet. Add a line above, or plan the day to set an intention." : "No entries for this day."}
            </p>
          ) : (
            timeline.map((e) => (
              <div key={e.id} className="leader py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Mono className="w-11 text-muted">{format(new TZDate(e.createdAt, settings.tz), "HH:mm")}</Mono>
                  <Label>{KIND_LABEL[e.kind]}</Label>
                  {e.mood != null || e.energy != null ? (
                    <Mono className="text-muted">{e.mood != null ? `M${e.mood}` : ""} {e.energy != null ? `E${e.energy}` : ""}</Mono>
                  ) : null}
                  {e.kind === "interstitial" ? <span className="ml-auto"><DeleteEntry id={e.id} /></span> : null}
                </div>
                {e.contentMd ? <p className="mt-1 whitespace-pre-wrap pl-14 text-[15px] leading-[1.5]">{e.contentMd}</p> : null}
              </div>
            ))
          )}
        </Tile>

        <Tile>
          <Label>Day note</Label>
          <Rule dotted />
          <DayNote key={day} day={day} initialText={note?.contentMd ?? ""} initialMood={note?.mood ?? null} initialEnergy={note?.energy ?? null} />
        </Tile>
      </div>

      <Tile className="md:col-span-2 xl:col-span-1">
        <div className="flex justify-between">
          <Label>Last 30 days</Label>
          <Label>{recent.length}</Label>
        </div>
        <Rule dotted />
        {recent.length === 0 ? (
          <p className="py-4 text-[14px] text-muted">Your days will collect here.</p>
        ) : (
          <ul>
            {recent.map((r) => (
              <li key={r.day} className="leader py-3 last:border-b-0">
                <Link href={r.day === today ? "/journal" : `/journal?d=${r.day}`} className="block">
                  <div className="flex items-center justify-between">
                    <Mono className={r.day === day ? "text-orange" : "text-muted"}>{format(dayKeyToDate(r.day, settings.tz), "EEE d MMM").toUpperCase()}</Mono>
                    <Mono className="text-muted">
                      {r.mood != null ? `M${r.mood}` : ""} {r.energy != null ? `E${r.energy}` : ""}
                    </Mono>
                  </div>
                  {r.snippet ? <p className="mt-1 line-clamp-2 text-[13px] text-muted">{r.snippet}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </div>
  );
}
