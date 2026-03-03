"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export type RecurrenceValue = {
  rrule: string | null;      // without "RRULE:"
  untilDate: string | null;  // YYYY-MM-DD
  mode: Mode;
  raw?: string;              // for CUSTOM
};

type Props = {
  /** Base date used for MONTHLY/YEARLY day-of-month defaults */
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dayOfMonth(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00");
  return d.getDate();
}
function monthOfYear(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00");
  return d.getMonth() + 1;
}

function parseSimpleRRULE(rrule: string | null): Partial<{
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
    const K = k.toUpperCase();
    if (K === "FREQ") out.freq = v.toUpperCase();
    if (K === "INTERVAL") out.interval = Number(v) || 1;
    if (K === "BYDAY") out.byday = v.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (K === "BYMONTHDAY") out.bymonthday = Number(v);
    if (K === "BYMONTH") out.bymonth = Number(v);
  }
  return out;
}

export default function RecurrenceBuilder({ baseDate, value, onChange, disabled }: Props) {
  const parsed = useMemo(() => parseSimpleRRULE(value.rrule), [value.rrule]);

  const [mode, setMode] = useState<Mode>(value.mode ?? "NONE");
  const [interval, setInterval] = useState<number>(parsed.interval || 1);

  const [weeklyDays, setWeeklyDays] = useState<string[]>(
    parsed.byday && parsed.byday.length ? parsed.byday : []
  );

  // End condition
  const [endType, setEndType] = useState<"NEVER" | "UNTIL">(value.untilDate ? "UNTIL" : "NEVER");
  const [untilDate, setUntilDate] = useState<string>(value.untilDate || "");

  // Custom RRULE
  const [raw, setRaw] = useState<string>(value.raw || value.rrule || "");

  // Keep local UI in sync when parent changes (click another event, etc.)
  useEffect(() => {
    setMode(value.mode ?? (value.rrule ? "CUSTOM" : "NONE"));
    const p = parseSimpleRRULE(value.rrule);
    setInterval(p.interval || 1);
    setWeeklyDays(p.byday && p.byday.length ? p.byday : []);
    setEndType(value.untilDate ? "UNTIL" : "NEVER");
    setUntilDate(value.untilDate || "");
    setRaw(value.raw || value.rrule || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.rrule, value.untilDate, value.mode]);

  function buildRRULE(nextMode = mode) {
    if (nextMode === "NONE") return null;

    const iv = Math.max(1, Number(interval) || 1);
    const dom = dayOfMonth(baseDate);
    const moy = monthOfYear(baseDate);

    if (nextMode === "DAILY") return `FREQ=DAILY;INTERVAL=${iv}`;
    if (nextMode === "WEEKLY") {
      const days = weeklyDays.length ? weeklyDays : ["MO"];
      return `FREQ=WEEKLY;INTERVAL=${iv};BYDAY=${days.join(",")}`;
    }
    if (nextMode === "MONTHLY") {
      // “zelfde dag van de maand” (eenvoudig en duidelijk)
      return `FREQ=MONTHLY;INTERVAL=${iv};BYMONTHDAY=${dom}`;
    }
    if (nextMode === "YEARLY") {
      return `FREQ=YEARLY;INTERVAL=${iv};BYMONTH=${moy};BYMONTHDAY=${dom}`;
    }
    if (nextMode === "CUSTOM") {
      const r = (raw || "").trim();
      if (!r) return null;
      return r.replace(/^RRULE:/i, "");
    }
    return null;
  }

  function emit(nextMode = mode) {
    const r = buildRRULE(nextMode);
    const ud = endType === "UNTIL" ? (untilDate || null) : null;

    onChange({
      mode: nextMode,
      rrule: r,
      untilDate: ud,
      raw: nextMode === "CUSTOM" ? raw : undefined,
    });
  }

  function toggleWeekday(code: string) {
    setWeeklyDays((prev) => {
      const has = prev.includes(code);
      const next = has ? prev.filter((x) => x !== code) : [...prev, code];
      return next;
    });
  }

  // Whenever interval / weekdays / until changes, emit
  useEffect(() => {
    if (disabled) return;
    emit(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, weeklyDays, endType, untilDate]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Recurrentie</label>
        <select
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            const m = e.target.value as Mode;
            setMode(m);
            // reasonable defaults
            if (m !== "CUSTOM") setRaw("");
            emit(m);
          }}
        >
          <option value="NONE">Geen recurrentie (éénmalig)</option>
          <option value="DAILY">Dagelijks</option>
          <option value="WEEKLY">Wekelijks</option>
          <option value="MONTHLY">Maandelijks (zelfde dag v/d maand)</option>
          <option value="YEARLY">Jaarlijks (zelfde datum)</option>
          <option value="CUSTOM">Geavanceerd (RRULE)</option>
        </select>
      </div>

      {mode !== "NONE" ? (
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
                onChange={(e) => setInterval(Number(e.target.value) || 1)}
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
              onChange={(e) => setEndType(e.target.value as any)}
            >
              <option value="NEVER">Nooit</option>
              <option value="UNTIL">Tot datum</option>
            </select>
          </div>
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
          <div className="text-xs text-zinc-500 mt-2">
            Tip: selecteer 1 of meerdere dagen.
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
            onChange={(e) => setUntilDate(e.target.value)}
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
              setRaw(e.target.value);
              // emit immediately
              onChange({
                mode: "CUSTOM",
                rrule: e.target.value.trim() ? e.target.value.trim().replace(/^RRULE:/i, "") : null,
                untilDate: endType === "UNTIL" ? (untilDate || null) : null,
                raw: e.target.value,
              });
            }}
          />
          <div className="text-xs text-zinc-500 mt-2">
            Voorbeelden: <code className="px-1 rounded bg-zinc-100">FREQ=WEEKLY;INTERVAL=2</code> of{" "}
            <code className="px-1 rounded bg-zinc-100">FREQ=WEEKLY;BYDAY=MO,WE,FR</code>
          </div>
        </div>
      ) : null}

      <div className="text-xs text-zinc-500">
        Uren blijven afzonderlijk ingesteld (start/einde). Recurrentie bepaalt enkel welke datums herhalen.
      </div>
    </div>
  );
}