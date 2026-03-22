"use client";

import { useEffect, useMemo, useState } from "react";

type Mode =
  | "NONE"
  | "DAILY"
  | "WEEKLY"
  | "WEEKLY_4"
  | "WEEKLY_6"
  | "WEEKLY_8"
  | "MONTHLY"
  | "YEARLY"
  | "CUSTOM";

export type RecurrenceValue = {
  rrule: string | null;
  untilDate: string | null;
  mode: Mode;
  raw?: string;
};

type Props = {
  baseDate: string; // YYYY-MM-DD
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  disabled?: boolean;
};

const WEEKDAYS = [
  { key: "MO", label: "Ma" },
  { key: "TU", label: "Di" },
  { key: "WE", label: "Wo" },
  { key: "TH", label: "Do" },
  { key: "FR", label: "Vr" },
  { key: "SA", label: "Za" },
  { key: "SU", label: "Zo" },
] as const;

function getWeekdayCode(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jsDay = d.getDay(); // 0=Sun ... 6=Sat
  const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  return map[jsDay];
}

function dayOfMonth(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDate();
}

function monthOfYear(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getMonth() + 1;
}

function parseSimpleRRULE(
  rrule: string | null
): Partial<{
  freq: string;
  interval: number;
  byday: string[];
  bymonthday: number;
  bymonth: number;
}> {
  if (!rrule) return {};
  const raw = rrule.replace(/^RRULE:/i, "");
  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
  const out: any = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (!k || !v) continue;
    const key = k.toUpperCase();
    if (key === "FREQ") out.freq = v.toUpperCase();
    if (key === "INTERVAL") out.interval = Number(v) || 1;
    if (key === "BYDAY") out.byday = v.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (key === "BYMONTHDAY") out.bymonthday = Number(v);
    if (key === "BYMONTH") out.bymonth = Number(v);
  }
  return out;
}

function detectMode(rrule: string | null): Mode {
  if (!rrule) return "NONE";
  const p = parseSimpleRRULE(rrule);

  if (p.freq === "WEEKLY" && p.interval === 4) return "WEEKLY_4";
  if (p.freq === "WEEKLY" && p.interval === 6) return "WEEKLY_6";
  if (p.freq === "WEEKLY" && p.interval === 8) return "WEEKLY_8";
  if (p.freq === "DAILY") return "DAILY";
  if (p.freq === "WEEKLY") return "WEEKLY";
  if (p.freq === "MONTHLY") return "MONTHLY";
  if (p.freq === "YEARLY") return "YEARLY";
  return "CUSTOM";
}

export default function RecurrenceBuilder({ baseDate, value, onChange, disabled }: Props) {
  const parsed = useMemo(() => parseSimpleRRULE(value.rrule), [value.rrule]);

  const [mode, setMode] = useState<Mode>(value.mode || detectMode(value.rrule));
  const [interval, setInterval] = useState<number>(parsed.interval || 1);
  const [weeklyDays, setWeeklyDays] = useState<string[]>(
    parsed.byday && parsed.byday.length ? parsed.byday : [getWeekdayCode(baseDate)]
  );
  const [endType, setEndType] = useState<"NEVER" | "UNTIL">(value.untilDate ? "UNTIL" : "NEVER");
  const [untilDate, setUntilDate] = useState<string>(value.untilDate || "");
  const [raw, setRaw] = useState<string>(value.raw || value.rrule || "");

  useEffect(() => {
    const detected = value.mode || detectMode(value.rrule);
    const p = parseSimpleRRULE(value.rrule);

    setMode(detected);
    setInterval(p.interval || 1);
    setWeeklyDays(p.byday && p.byday.length ? p.byday : [getWeekdayCode(baseDate)]);
    setEndType(value.untilDate ? "UNTIL" : "NEVER");
    setUntilDate(value.untilDate || "");
    setRaw(value.raw || value.rrule || "");
  }, [value.rrule, value.untilDate, value.mode, value.raw, baseDate]);

  function buildAndEmit(next: {
    nextMode?: Mode;
    nextInterval?: number;
    nextWeeklyDays?: string[];
    nextEndType?: "NEVER" | "UNTIL";
    nextUntilDate?: string;
    nextRaw?: string;
  } = {}) {
    const m = next.nextMode ?? mode;
    const iv = next.nextInterval ?? interval;
    const wd = next.nextWeeklyDays ?? weeklyDays;
    const et = next.nextEndType ?? endType;
    const ud = next.nextUntilDate ?? untilDate;
    const rw = next.nextRaw ?? raw;

    const baseWeekday = getWeekdayCode(baseDate);
    const dom = dayOfMonth(baseDate);
    const moy = monthOfYear(baseDate);

    let rrule: string | null = null;

    if (m === "NONE") {
      rrule = null;
    } else if (m === "DAILY") {
      rrule = `FREQ=DAILY;INTERVAL=${Math.max(1, iv)}`;
    } else if (m === "WEEKLY") {
      const days = wd.length ? wd : [baseWeekday];
      rrule = `FREQ=WEEKLY;INTERVAL=${Math.max(1, iv)};BYDAY=${days.join(",")}`;
    } else if (m === "WEEKLY_4") {
      rrule = `FREQ=WEEKLY;INTERVAL=4;BYDAY=${baseWeekday}`;
    } else if (m === "WEEKLY_6") {
      rrule = `FREQ=WEEKLY;INTERVAL=6;BYDAY=${baseWeekday}`;
    } else if (m === "WEEKLY_8") {
      rrule = `FREQ=WEEKLY;INTERVAL=8;BYDAY=${baseWeekday}`;
    } else if (m === "MONTHLY") {
      rrule = `FREQ=MONTHLY;INTERVAL=${Math.max(1, iv)};BYMONTHDAY=${dom}`;
    } else if (m === "YEARLY") {
      rrule = `FREQ=YEARLY;INTERVAL=${Math.max(1, iv)};BYMONTH=${moy};BYMONTHDAY=${dom}`;
    } else if (m === "CUSTOM") {
      rrule = rw.trim() ? rw.trim().replace(/^RRULE:/i, "") : null;
    }

    onChange({
      mode: m,
      rrule,
      untilDate: et === "UNTIL" ? (ud || null) : null,
      raw: m === "CUSTOM" ? rw : undefined,
    });
  }

  function toggleWeekday(code: string) {
    const nextDays = weeklyDays.includes(code)
      ? weeklyDays.filter((x) => x !== code)
      : [...weeklyDays, code];

    setWeeklyDays(nextDays);
    buildAndEmit({ nextWeeklyDays: nextDays });
  }

  const showInterval =
    mode !== "NONE" &&
    mode !== "WEEKLY_4" &&
    mode !== "WEEKLY_6" &&
    mode !== "WEEKLY_8";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Recurrentie</label>
        <select
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            const nextMode = e.target.value as Mode;
            setMode(nextMode);
            if (nextMode !== "CUSTOM") setRaw("");
            if (nextMode === "WEEKLY" && weeklyDays.length === 0) {
              const baseWd = [getWeekdayCode(baseDate)];
              setWeeklyDays(baseWd);
              buildAndEmit({ nextMode, nextWeeklyDays: baseWd, nextRaw: "" });
              return;
            }
            buildAndEmit({ nextMode, nextRaw: "" });
          }}
        >
          <option value="NONE">Geen recurrentie (éénmalig)</option>
          <option value="DAILY">Dagelijks</option>
          <option value="WEEKLY">Wekelijks</option>
          <option value="WEEKLY_4">Om de 4 weken</option>
          <option value="WEEKLY_6">Om de 6 weken</option>
          <option value="WEEKLY_8">Om de 8 weken</option>
          <option value="MONTHLY">Maandelijks</option>
          <option value="YEARLY">Jaarlijks</option>
          <option value="CUSTOM">Geavanceerd (RRULE)</option>
        </select>
      </div>

      {showInterval ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">Elke</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-24 rounded-xl border border-zinc-200 px-3 py-2"
                value={interval}
                disabled={disabled}
                onChange={(e) => {
                  const nextInterval = Number(e.target.value) || 1;
                  setInterval(nextInterval);
                  buildAndEmit({ nextInterval });
                }}
              />
              <div className="text-sm text-zinc-600">
                {mode === "DAILY" && "dag(en)"}
                {mode === "WEEKLY" && "week/weken"}
                {mode === "MONTHLY" && "maand(en)"}
                {mode === "YEARLY" && "jaar/jaren"}
                {mode === "CUSTOM" && "interval"}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Einde</label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              value={endType}
              disabled={disabled}
              onChange={(e) => {
                const nextEndType = e.target.value as "NEVER" | "UNTIL";
                setEndType(nextEndType);
                buildAndEmit({ nextEndType });
              }}
            >
              <option value="NEVER">Nooit</option>
              <option value="UNTIL">Tot datum</option>
            </select>
          </div>
        </div>
      ) : mode !== "NONE" ? (
        <div>
          <label className="text-sm font-medium">Einde</label>
          <select
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            value={endType}
            disabled={disabled}
            onChange={(e) => {
              const nextEndType = e.target.value as "NEVER" | "UNTIL";
              setEndType(nextEndType);
              buildAndEmit({ nextEndType });
            }}
          >
            <option value="NEVER">Nooit</option>
            <option value="UNTIL">Tot datum</option>
          </select>
        </div>
      ) : null}

      {mode === "WEEKLY" ? (
        <div>
          <label className="text-sm font-medium">Op</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = weeklyDays.includes(d.key);
              return (
                <button
                  type="button"
                  key={d.key}
                  disabled={disabled}
                  onClick={() => toggleWeekday(d.key)}
                  className={[
                    "px-3 py-2 rounded-xl border text-sm font-medium",
                    active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200 hover:bg-zinc-50",
                    disabled ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {endType === "UNTIL" && mode !== "NONE" ? (
        <div>
          <label className="text-sm font-medium">Tot</label>
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            value={untilDate}
            disabled={disabled}
            onChange={(e) => {
              const nextUntilDate = e.target.value;
              setUntilDate(nextUntilDate);
              buildAndEmit({ nextUntilDate });
            }}
          />
        </div>
      ) : null}

      {mode === "CUSTOM" ? (
        <div>
          <label className="text-sm font-medium">RRULE (geavanceerd)</label>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm"
            placeholder="FREQ=WEEKLY;INTERVAL=6;BYDAY=MO"
            value={raw}
            disabled={disabled}
            onChange={(e) => {
              const nextRaw = e.target.value;
              setRaw(nextRaw);
              buildAndEmit({ nextRaw });
            }}
          />
        </div>
      ) : null}

      <div className="text-xs text-zinc-500">
        Uren blijven afzonderlijk ingesteld. Recurrentie bepaalt enkel welke datums herhalen.
      </div>
    </div>
  );
}