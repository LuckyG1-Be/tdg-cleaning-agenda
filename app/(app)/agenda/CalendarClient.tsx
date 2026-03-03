"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Customer = { id: string; firstName?: string|null; lastName?: string|null; company?: string|null };
type EventItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  seriesId: string;
  dateKey: string;
  extendedProps: {
    customerId: string | null;
    description: string | null;
    notes: string | null;
    isRecurring: boolean;
  };
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function customerLabel(c: Customer | null) {
  if (!c) return "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return (c.company || name || "").trim();
}

export default function CalendarClient() {
  const calRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerId: "" as string,
    date: "" as string,
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    notes: "",
    recurrence: "" as string, // RRULE or empty for single
    untilDate: "" as string, // optional YYYY-MM-DD
  });

  const [edit, setEdit] = useState<null | {
    seriesId: string;
    dateKey: string;
    title: string;
    customerId: string | null;
    startTime: string;
    endTime: string;
    description: string;
    notes: string;
    isRecurring: boolean;
  }>(null);

  const [editMode, setEditMode] = useState<"ONLY_THIS"|"FUTURE"|"ALL">("ONLY_THIS");

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

  useEffect(() => {
    loadCustomers();
  }, []);

  const helpRRULE = (
    <div className="text-xs text-zinc-500 space-y-1">
      <div><span className="font-medium">Recurrentie (RRULE)</span> — leeg = éénmalig.</div>
      <div>Voorbeelden:</div>
      <ul className="list-disc pl-4">
        <li><code className="px-1 rounded bg-zinc-100">FREQ=WEEKLY;INTERVAL=2</code> (om de 2 weken)</li>
        <li><code className="px-1 rounded bg-zinc-100">FREQ=MONTHLY;INTERVAL=1</code> (maandelijks)</li>
        <li><code className="px-1 rounded bg-zinc-100">FREQ=WEEKLY;BYDAY=MO,WE,FR</code> (ma/wo/vr)</li>
      </ul>
    </div>
  );

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        customerId: form.customerId || null,
        startDate: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        description: form.description || null,
        notes: form.notes || null,
        rrule: form.recurrence ? (form.recurrence.includes("RRULE") ? form.recurrence : form.recurrence) : null,
        untilDate: form.untilDate || null,
        title: null,
      };
      const r = await fetch("/api/series", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Opslaan mislukt");
      setForm({ customerId: "", date: "", startTime: "09:00", endTime: "10:00", description: "", notes: "", recurrence: "", untilDate: "" });
      await refetchEvents();
    } catch (e: any) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  function onEventClick(arg: any) {
    const ev: EventItem = arg.event.extendedProps
      ? {
          id: arg.event.id,
          title: arg.event.title,
          start: arg.event.start?.toISOString?.() || arg.event.startStr,
          end: arg.event.end?.toISOString?.() || arg.event.endStr,
          seriesId: arg.event.extendedProps.seriesId || arg.event._def.extendedProps.seriesId,
          dateKey: arg.event.extendedProps.dateKey || arg.event._def.extendedProps.dateKey,
          extendedProps: arg.event.extendedProps,
        }
      : arg.event;

    // FullCalendar stores extended props in _def.extendedProps
    const xp = (arg.event._def?.extendedProps || {}) as any;

    setSelected(ev);
    setEdit({
      seriesId: xp.seriesId,
      dateKey: xp.dateKey,
      title: arg.event.title,
      customerId: xp.customerId ?? null,
      startTime: (arg.event.start ? String(arg.event.start).slice(16,21) : "09:00"),
      endTime: (arg.event.end ? String(arg.event.end).slice(16,21) : "10:00"),
      description: xp.description || "",
      notes: xp.notes || "",
      isRecurring: !!xp.isRecurring,
    });

    setEditMode(xp.isRecurring ? "ONLY_THIS" : "ALL");
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      const occurrenceDate = edit.dateKey; // YYYY-MM-DD
      const payload = {
        mode: edit.isRecurring ? editMode : "ALL",
        occurrenceDate,
        patch: {
          customerId: edit.customerId,
          title: null,
          description: edit.description || null,
          notes: edit.notes || null,
          startTime: edit.startTime,
          endTime: edit.endTime,
          // recurrence updates only supported in ALL/FUTURE in this MVP via rrule patch (left null here)
        },
      };
      const r = await fetch(`/api/series/${edit.seriesId}`, { method: "PATCH", headers: {"content-type":"application/json"}, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Wijzigen mislukt");
      setSelected(null);
      setEdit(null);
      await refetchEvents();
    } catch (e: any) {
      setError(e?.message || "Wijzigen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOccurrenceOrSeries() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      if (edit.isRecurring && editMode === "ONLY_THIS") {
        const r = await fetch(`/api/series/${edit.seriesId}/occurrence/delete`, {
          method: "POST",
          headers: {"content-type":"application/json"},
          body: JSON.stringify({ date: edit.dateKey }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      } else {
        const r = await fetch(`/api/series/${edit.seriesId}`, { method: "DELETE" });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");
      }
      setSelected(null);
      setEdit(null);
      await refetchEvents();
    } catch (e: any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  const customerOptions = useMemo(() => customers.map(c => ({
    id: c.id,
    label: customerLabel(c as any) || "Klant",
  })), [customers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
          datesSet={() => { refetchEvents(); }}
          nowIndicator
        />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="font-semibold mb-2">Nieuwe afspraak</div>
          <form onSubmit={createAppointment} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Klant</label>
              <select className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.customerId} onChange={(e)=>setForm(f=>({...f, customerId: e.target.value}))}>
                <option value="">(geen)</option>
                {customerOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Datum</label>
                <input type="date" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.date} onChange={(e)=>setForm(f=>({...f, date: e.target.value}))} required />
              </div>
              <div>
                <label className="text-sm font-medium">Tot (optioneel)</label>
                <input type="date" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.untilDate} onChange={(e)=>setForm(f=>({...f, untilDate: e.target.value}))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Start</label>
                <input type="time" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.startTime} onChange={(e)=>setForm(f=>({...f, startTime: e.target.value}))} required />
              </div>
              <div>
                <label className="text-sm font-medium">Einde</label>
                <input type="time" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={form.endTime} onChange={(e)=>setForm(f=>({...f, endTime: e.target.value}))} required />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Recurrentie (RRULE)</label>
              <input className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm"
                placeholder="FREQ=WEEKLY;INTERVAL=4"
                value={form.recurrence} onChange={(e)=>setForm(f=>({...f, recurrence: e.target.value}))} />
              <div className="mt-2">{helpRRULE}</div>
            </div>

            <div>
              <label className="text-sm font-medium">Omschrijving</label>
              <input className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                value={form.description} onChange={(e)=>setForm(f=>({...f, description: e.target.value}))} />
            </div>

            <div>
              <label className="text-sm font-medium">Notities</label>
              <textarea className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 min-h-[90px]"
                value={form.notes} onChange={(e)=>setForm(f=>({...f, notes: e.target.value}))} />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <button disabled={busy} className="w-full rounded-xl bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60">
              {busy ? "Bezig..." : "Opslaan"}
            </button>
          </form>
        </div>

        {edit ? (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="font-semibold mb-2">Afspraak wijzigen</div>
            <div className="text-xs text-zinc-500 mb-3">
              {edit.dateKey} {edit.isRecurring ? "• recurrent" : "• éénmalig"}
            </div>

            {edit.isRecurring ? (
              <div className="mb-3">
                <label className="text-sm font-medium">Wijziging toepassen op</label>
                <select className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={editMode} onChange={(e)=>setEditMode(e.target.value as any)}>
                  <option value="ONLY_THIS">Alleen deze afspraak</option>
                  <option value="FUTURE">Alle toekomstige afspraken</option>
                  <option value="ALL">De volledige reeks</option>
                </select>
                <div className="text-xs text-zinc-500 mt-1">
                  Tip: bij verwijderen geldt “alleen deze” of “hele reeks” (future = hele reeks in MVP).
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Klant</label>
                <select className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.customerId || ""} onChange={(e)=>setEdit(ed=>ed?({...ed, customerId: e.target.value || null}):ed)}>
                  <option value="">(geen)</option>
                  {customerOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Start</label>
                  <input type="time" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                    value={edit.startTime} onChange={(e)=>setEdit(ed=>ed?({...ed, startTime: e.target.value}):ed)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Einde</label>
                  <input type="time" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                    value={edit.endTime} onChange={(e)=>setEdit(ed=>ed?({...ed, endTime: e.target.value}):ed)} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Omschrijving</label>
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  value={edit.description} onChange={(e)=>setEdit(ed=>ed?({...ed, description: e.target.value}):ed)} />
              </div>

              <div>
                <label className="text-sm font-medium">Notities</label>
                <textarea className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 min-h-[90px]"
                  value={edit.notes} onChange={(e)=>setEdit(ed=>ed?({...ed, notes: e.target.value}):ed)} />
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={saveEdit} className="rounded-xl bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60">
                  Opslaan
                </button>
                <button disabled={busy} onClick={deleteOccurrenceOrSeries} className="rounded-xl border border-zinc-200 py-2 font-medium hover:bg-zinc-50 disabled:opacity-60">
                  Verwijderen
                </button>
              </div>

              <button onClick={()=>{setSelected(null); setEdit(null);}} className="w-full text-sm text-zinc-600 hover:text-zinc-900">
                Sluiten
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="font-semibold mb-1">Tip</div>
            <div className="text-sm text-zinc-600">
              Klik op een afspraak in de agenda om te wijzigen of te verwijderen.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
