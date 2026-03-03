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
  startDate: string;  // ISO
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
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

export default function CalendarClient() {
  const calRef = useRef<FullCalendar | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // editable fields:
    date: string; // YYYY-MM-DD (for moving only-this OR single appointment)
    customerId: string | null;
    startTime: string;
    endTime: string;
    description: string;
    notes: string;

    isRecurring: boolean;
    baseSeries: Series | null; // fetched from API
    mode: "ONLY_THIS" | "FUTURE" | "ALL";
    recurrence: RecurrenceValue; // used for ALL/FUTURE mainly
  }>(null);

  async function loadCustomers() {
    const r = await fetch("/api/customers");
    const j = await r.json();
    if (j.ok) setCustomers(j.items);
  }

  async function refetchEvents() {
    const api = (calRef.current as any)?.getApi?.();
    if (!api) return;
    const view = api.view;
    const start = view.activeStart.toISOString();
    const end = view.activeEnd.toISOString();
    const r = await fetch(`/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    const j = await r.json();
    if (j.ok) setEvents(j.events);
  }

  async function fetchSeries(seriesId: string): Promise<Series | null> {
    const r = await fetch(`/api/series/${seriesId}`);
    const j = await r.json();
    if (!j.ok) return null;
    return j.item as Series;
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        label: customerLabel(c as any) || "Klant",
      })),
    [customers]
  );

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

      await refetchEvents();
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

    const occurrenceDate = xp.dateKey as string; // YYYY-MM-DD from our API
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
      // 1) ONE-OFF or non-recurring: we update the series directly (ALL)
      if (!edit.isRecurring) {
        const payload = {
          mode: "ALL",
          patch: {
            customerId: edit.customerId,
            description: edit.description || null,
            notes: edit.notes || null,
            startTime: edit.startTime,
            endTime: edit.endTime,
            // allow moving date for non-recurring:
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
        await refetchEvents();
        return;
      }

      // 2) Recurring series
      if (edit.mode === "ONLY_THIS") {
        // If date unchanged: just override fields for this occurrence
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
          await refetchEvents();
          return;
        }

        // If date changed: move THIS occurrence
        // - delete old occurrence
        // - create a new single appointment on new date
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
        await refetchEvents();
        return;
      }

      // 3) FUTURE or ALL: update recurrence + fields.
      // Note: moving the actual "date" of the series is not done via date input here
      // (you can change recurrence days instead). Date input is disabled in these modes.
      const payload = {
        mode: edit.mode,
        occurrenceDate: edit.occurrenceDate, // needed for FUTURE split
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
      await refetchEvents();
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
      // recurring + ONLY_THIS => delete that occurrence
      if (edit.isRecurring && edit.mode === "ONLY_THIS") {
        const r = await fetch(`/api/series/${edit.seriesId}/occurrence/delete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date: edit.occurrenceDate }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      } else {
        // delete series entirely
        const r = await fetch(`/api/series/${edit.seriesId}`, { method: "DELETE" });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      }

      setEdit(null);
      await refetchEvents();
    } catch (e: any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm p-3">
        <FullCalendar
          ref={calRef as any}
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
          datesSet={() => {
            refetchEvents();
          }}
          nowIndicator

          // 24u + uu:mm
          locale="nl"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      {/* Side panels */}
      <div className="space-y-4">
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
                onChange={(e) => {
                  const next = e.target.value;
                  setForm((f) => ({ ...f, date: next }));
                  // keep recurrence base-date aligned
                  setCreateRecurrence((r) => ({ ...r }));
                }}
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

                <div className="text-xs text-zinc-500 mt-1">
                  Tip: “Alleen deze” kan je ook verplaatsen naar een andere dag.
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Klant</label>
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.customerId || ""}
                  onChange={(e) =>
                    setEdit((ed) => (ed ? { ...ed, customerId: e.target.value || null } : ed))
                  }
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
                {edit.isRecurring && edit.mode !== "ONLY_THIS" ? (
                  <div className="text-xs text-zinc-500 mt-1">
                    Wil je de dag wijzigen? Kies “Alleen deze afspraak” (verplaatsen) of pas BYDAY aan in recurrentie.
                  </div>
                ) : null}
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

              {/* Recurrence builder */}
              {edit.isRecurring ? (
                <div className="pt-2 border-t border-zinc-100">
                  <RecurrenceBuilder
                    baseDate={edit.occurrenceDate}
                    value={edit.recurrence}
                    disabled={edit.mode === "ONLY_THIS"}
                    onChange={(v) => setEdit((ed) => (ed ? { ...ed, recurrence: v } : ed))}
                  />
                  {edit.mode === "ONLY_THIS" ? (
                    <div className="text-xs text-zinc-500 mt-1">
                      Recurrentie wijzigen kan via “Alle toekomstige” of “Volledige reeks”.
                    </div>
                  ) : null}
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

              <button
                onClick={() => setEdit(null)}
                className="w-full text-sm text-zinc-600 hover:text-zinc-900"
              >
                Sluiten
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="font-semibold mb-1">Tip</div>
            <div className="text-sm text-zinc-600">
              Klik op een afspraak in de agenda om te wijzigen, verplaatsen of recurrentie aan te passen.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
