"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import RecurrenceBuilder, { type RecurrenceValue } from "@/components/RecurrenceBuilder";

type Customer = { id: string; firstName?: string | null; lastName?: string | null; company?: string | null };
type EventItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  seriesId: string;
  dateKey: string; // YYYY-MM-DD
  extendedProps: {
    seriesId?: string;
    customerId: string | null;
    description: string | null;
    notes: string | null;
    isRecurring: boolean;
  };
};

type Series = {
  id: string;
  customerId: string | null;
  title: string | null;
  description: string | null;
  notes: string | null;
  startDate: string; // ISO
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  rrule: string | null;
  untilDate: string | null; // ISO or null
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function hhmm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function customerLabel(c: Customer | null) {
  if (!c) return "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return (c.company || name || "").trim();
}
function isoToDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export default function CalendarClient() {
  const calRef = useRef<any>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // track visible range so we can also build the upcoming list
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);

  // upcoming list
  const [upcomingQ, setUpcomingQ] = useState("");
  const UPCOMING_DAYS = 180;

  // Create form
  const [form, setForm] = useState({
    customerId: "" as string,
    date: "" as string, // YYYY-MM-DD
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    notes: "",
  });

  const [createRecurrence, setCreateRecurrence] = useState<RecurrenceValue>({
    mode: "NONE",
    rrule: null,
    untilDate: null,
  });

  // Edit state
  const [edit, setEdit] = useState<null | {
    seriesId: string;
    occurrenceDate: string; // clicked occurrence YYYY-MM-DD
    date: string; // YYYY-MM-DD
    customerId: string | null;
    startTime: string;
    endTime: string;
    description: string;
    notes: string;

    isRecurring: boolean;
    baseSeries: Series | null;
    mode: "ONLY_THIS" | "FUTURE" | "ALL";
    recurrence: RecurrenceValue;
  }>(null);

  async function loadCustomers() {
    const r = await fetch("/api/customers", { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setCustomers(j.items);
  }

  async function fetchEventsInRange(startIso: string, endIso: string) {
    const r = await fetch(
      `/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      { cache: "no-store" }
    );
    const j = await r.json();
    if (j.ok) setEvents(j.events);
  }

  async function refetchVisibleEvents() {
    const api = calRef.current?.getApi?.();
    if (!api) return;
    const startIso = api.view.activeStart.toISOString();
    const endIso = api.view.activeEnd.toISOString();
    await fetchEventsInRange(startIso, endIso);
  }

  async function fetchSeries(seriesId: string): Promise<Series | null> {
    const r = await fetch(`/api/series/${seriesId}`, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) return null;
    return j.item as Series;
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  // IMPORTANT: on mount, try to fetch once (fix “events verdwenen” bij terugkomen)
  useEffect(() => {
    const t = setTimeout(() => {
      refetchVisibleEvents();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        label: customerLabel(c as any) || "Klant",
      })),
    [customers]
  );

  const customerLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) m.set(c.id, customerLabel(c as any) || "Klant");
    return m;
  }, [customers]);

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!form.date) throw new Error("Kies een datum");

      const payload = {
        customerId: form.customerId || null,
        startDate: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        description: form.description || null,
        notes: form.notes || null,
        rrule: createRecurrence.rrule,
        untilDate: createRecurrence.untilDate,
        title: null,
      };

      const r = await fetch("/api/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Opslaan mislukt");

      setForm({ customerId: "", date: "", startTime: "09:00", endTime: "10:00", description: "", notes: "" });
      setCreateRecurrence({ mode: "NONE", rrule: null, untilDate: null });

      await refetchVisibleEvents();
    } catch (e: any) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onEventClick(arg: any) {
    setError(null);
    const xp = (arg.event._def?.extendedProps || {}) as any;

    const start: Date = arg.event.start;
    const end: Date = arg.event.end;

    const occurrenceDate = xp.dateKey as string; // YYYY-MM-DD from API
    const seriesId = xp.seriesId as string;

    const series = await fetchSeries(seriesId);
    const isRecurring = !!xp.isRecurring;

    setEdit({
      seriesId,
      occurrenceDate,
      date: occurrenceDate,
      customerId: xp.customerId ?? null,
      startTime: hhmm(start),
      endTime: hhmm(end),
      description: xp.description || "",
      notes: xp.notes || "",
      isRecurring,
      baseSeries: series,
      mode: isRecurring ? "ONLY_THIS" : "ALL",
      recurrence: {
        mode: series?.rrule ? "CUSTOM" : "NONE",
        rrule: series?.rrule ?? null,
        untilDate: series?.untilDate ? isoToDateKey(series.untilDate) : null,
        raw: series?.rrule ?? "",
      },
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setError(null);

    try {
      if (!edit.isRecurring) {
        const payload = {
          mode: "ALL",
          patch: {
            customerId: edit.customerId,
            description: edit.description || null,
            notes: edit.notes || null,
            startTime: edit.startTime,
            endTime: edit.endTime,
            startDate: edit.date,
            rrule: null,
            untilDate: null,
          },
        };

        const r = await fetch(`/api/series/${edit.seriesId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Wijzigen mislukt");

        setEdit(null);
        await refetchVisibleEvents();
        return;
      }

      if (edit.mode === "ONLY_THIS") {
        if (edit.date === edit.occurrenceDate) {
          const payload = {
            mode: "ONLY_THIS",
            occurrenceDate: edit.occurrenceDate,
            patch: {
              customerId: edit.customerId,
              description: edit.description || null,
              notes: edit.notes || null,
              startTime: edit.startTime,
              endTime: edit.endTime,
            },
          };

          const r = await fetch(`/api/series/${edit.seriesId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || "Wijzigen mislukt");

          setEdit(null);
          await refetchVisibleEvents();
          return;
        }

        // Move only this occurrence:
        const del = await fetch(`/api/series/${edit.seriesId}/occurrence/delete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: edit.occurrenceDate }),
        });
        const delJ = await del.json();
        if (!delJ.ok) throw new Error(delJ.error || "Verplaatsen mislukt (delete)");

        const create = await fetch(`/api/series`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: edit.customerId,
            startDate: edit.date,
            startTime: edit.startTime,
            endTime: edit.endTime,
            description: edit.description || null,
            notes: edit.notes || null,
            rrule: null,
            untilDate: null,
            title: null,
          }),
        });
        const createJ = await create.json();
        if (!createJ.ok) throw new Error(createJ.error || "Verplaatsen mislukt (create)");

        setEdit(null);
        await refetchVisibleEvents();
        return;
      }

      const payload = {
        mode: edit.mode,
        occurrenceDate: edit.occurrenceDate,
        patch: {
          customerId: edit.customerId,
          description: edit.description || null,
          notes: edit.notes || null,
          startTime: edit.startTime,
          endTime: edit.endTime,
          rrule: edit.recurrence.rrule,
          untilDate: edit.recurrence.untilDate,
        },
      };

      const r = await fetch(`/api/series/${edit.seriesId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Wijzigen mislukt");

      setEdit(null);
      await refetchVisibleEvents();
    } catch (e: any) {
      setError(e?.message || "Wijzigen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEdit() {
    if (!edit) return;
    setBusy(true);
    setError(null);

    try {
      if (edit.isRecurring && edit.mode === "ONLY_THIS") {
        const r = await fetch(`/api/series/${edit.seriesId}/occurrence/delete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: edit.occurrenceDate }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      } else {
        const r = await fetch(`/api/series/${edit.seriesId}`, { method: "DELETE" });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      }

      setEdit(null);
      await refetchVisibleEvents();
    } catch (e: any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  // Build upcoming list from “now -> now+UPCOMING_DAYS”
  const upcomingRange = useMemo(() => {
    const now = new Date();
    return { start: now, end: addDays(now, UPCOMING_DAYS) };
  }, []);

  const upcomingItems = useMemo(() => {
    const now = new Date();
    const q = (upcomingQ || "").trim().toLowerCase();

    const list = (events || [])
      .map((ev) => {
        const s = new Date(ev.start);
        const e = new Date(ev.end);
        const xp = ev.extendedProps || ({} as any);
        const customerName = xp.customerId ? customerLabelById.get(xp.customerId) || "" : "";
        const text = `${customerName} ${xp.description || ""} ${xp.notes || ""}`.toLowerCase();

        return {
          key: `${ev.seriesId}:${ev.dateKey}:${ev.id}`,
          seriesId: ev.seriesId,
          dateKey: ev.dateKey,
          start: s,
          end: e,
          customerName,
          description: xp.description || "",
          notes: xp.notes || "",
          text,
        };
      })
      .filter((x) => x.start >= now)
      .filter((x) => x.start <= upcomingRange.end)
      .filter((x) => (!q ? true : x.text.includes(q)))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return list;
  }, [events, upcomingQ, customerLabelById, upcomingRange.end]);

  function gotoDate(dateKey: string) {
    const api = calRef.current?.getApi?.();
    if (!api) return;
    api.gotoDate(dateKey);
    // switch to week view for clarity
    api.changeView("timeGridWeek");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="auto"
          events={events as any}
          eventClick={onEventClick}
          nowIndicator

          // 24u + uu:mm
          locale="nl"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}

          datesSet={(info) => {
            setVisibleRange({ start: info.start, end: info.end });
            // Key fix: fetch using info (works reliably after navigation)
            fetchEventsInRange(info.start.toISOString(), info.end.toISOString());
          }}
        />
      </div>

      {/* Side panels */}
      <div className="space-y-4">
        {/* Upcoming list */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">Toekomstige afspraken</div>
            <button
              className="text-xs text-zinc-600 hover:text-zinc-900"
              onClick={() => refetchVisibleEvents()}
            >
              Refresh
            </button>
          </div>

          <input
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2"
            placeholder="Zoek (klant, omschrijving, notities)…"
            value={upcomingQ}
            onChange={(e) => setUpcomingQ(e.target.value)}
          />

          <div className="mt-3 max-h-[38vh] overflow-auto divide-y divide-zinc-100">
            {upcomingItems.length ? (
              upcomingItems.map((it) => (
                <button
                  key={it.key}
                  className="w-full text-left py-3 px-2 rounded-xl hover:bg-zinc-50"
                  onClick={() => gotoDate(it.dateKey)}
                >
                  <div className="text-sm font-medium">
                    {it.customerName || "Afspraak"}{" "}
                    <span className="text-zinc-500 font-normal">
                      • {it.dateKey} • {hhmm(it.start)}–{hhmm(it.end)}
                    </span>
                  </div>
                  {it.description ? <div className="text-xs text-zinc-600 mt-1">{it.description}</div> : null}
                  {it.notes ? <div className="text-xs text-zinc-400 mt-1">{it.notes}</div> : null}
                </button>
              ))
            ) : (
              <div className="text-sm text-zinc-500 py-6 text-center">Geen afspraken gevonden</div>
            )}
          </div>

          <div className="text-xs text-zinc-500 mt-2">
            Toont afspraken vanaf nu tot +{UPCOMING_DAYS} dagen.
          </div>
        </div>

        {/* Create */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="font-semibold mb-2">Nieuwe afspraak</div>

          <form onSubmit={createAppointment} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Klant</label>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
              >
                <option value="">(geen)</option>
                {customerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Datum</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Start (uu:mm)</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Einde (uu:mm)</label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100">
              <RecurrenceBuilder
                baseDate={form.date || isoToDateKey(new Date().toISOString())}
                value={createRecurrence}
                onChange={setCreateRecurrence}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Omschrijving</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notities</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 min-h-[90px]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <button
              disabled={busy}
              className="w-full rounded-xl bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy ? "Bezig..." : "Opslaan"}
            </button>
          </form>
        </div>

        {/* Edit */}
        {edit ? (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="font-semibold mb-2">Afspraak wijzigen</div>

            <div className="text-xs text-zinc-500 mb-3">
              {edit.occurrenceDate} {edit.isRecurring ? "• recurrent" : "• éénmalig"}
            </div>

            {edit.isRecurring ? (
              <div className="mb-3">
                <label className="text-sm font-medium">Wijziging toepassen op</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.mode}
                  onChange={(e) => setEdit((ed) => (ed ? { ...ed, mode: e.target.value as any } : ed))}
                >
                  <option value="ONLY_THIS">Alleen deze afspraak</option>
                  <option value="FUTURE">Alle toekomstige afspraken</option>
                  <option value="ALL">De volledige reeks</option>
                </select>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Klant</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.customerId || ""}
                  onChange={(e) => setEdit((ed) => (ed ? { ...ed, customerId: e.target.value || null } : ed))}
                >
                  <option value="">(geen)</option>
                  {customerOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Datum {edit.isRecurring && edit.mode !== "ONLY_THIS" ? "(wijzig via recurrentie)" : ""}
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.date}
                  disabled={edit.isRecurring && edit.mode !== "ONLY_THIS"}
                  onChange={(e) => setEdit((ed) => (ed ? { ...ed, date: e.target.value } : ed))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Start (uu:mm)</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                    value={edit.startTime}
                    onChange={(e) => setEdit((ed) => (ed ? { ...ed, startTime: e.target.value } : ed))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Einde (uu:mm)</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                    value={edit.endTime}
                    onChange={(e) => setEdit((ed) => (ed ? { ...ed, endTime: e.target.value } : ed))}
                  />
                </div>
              </div>

              {edit.isRecurring ? (
                <div className="pt-2 border-t border-zinc-100">
                  <RecurrenceBuilder
                    baseDate={edit.occurrenceDate}
                    value={edit.recurrence}
                    disabled={edit.mode === "ONLY_THIS"}
                    onChange={(v) => setEdit((ed) => (ed ? { ...ed, recurrence: v } : ed))}
                  />
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium">Omschrijving</label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.description}
                  onChange={(e) => setEdit((ed) => (ed ? { ...ed, description: e.target.value } : ed))}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notities</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 min-h-[90px]"
                  value={edit.notes}
                  onChange={(e) => setEdit((ed) => (ed ? { ...ed, notes: e.target.value } : ed))}
                />
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy}
                  onClick={saveEdit}
                  className="rounded-xl bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
                >
                  Opslaan
                </button>
                <button
                  disabled={busy}
                  onClick={deleteEdit}
                  className="rounded-xl border border-zinc-200 py-2 font-medium hover:bg-zinc-50 disabled:opacity-60"
                >
                  Verwijderen
                </button>
              </div>

              <button onClick={() => setEdit(null)} className="w-full text-sm text-zinc-600 hover:text-zinc-900">
                Sluiten
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
