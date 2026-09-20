"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import RecurrenceBuilder, { type RecurrenceValue } from "@/components/RecurrenceBuilder";

type Customer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  number?: string | null;
  box?: string | null;
  postal?: string | null;
  city?: string | null;
  defaultRecurrence?: string | null;
};

type EventItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    seriesId?: string;
    dateKey: string;
    customerId: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
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
  startDate: string;
  startTime: string;
  endTime: string;
  rrule: string | null;
  untilDate: string | null;
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function dateKey(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function hhmm(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function timeFromMinutes(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function customerLabel(c: Customer | null | undefined) {
  if (!c) return "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return (c.company || name || "Klant").trim();
}
function customerAddress(c: Customer | null | undefined) {
  if (!c) return "";
  const a = [c.street, c.number, c.box ? `bus ${c.box}` : ""].filter(Boolean).join(" ");
  const b = [c.postal, c.city].filter(Boolean).join(" ");
  return [a, b].filter(Boolean).join(", ");
}
function isoToDateKey(iso: string) {
  const d = new Date(iso);
  return dateKey(d);
}
function recurrenceFromCustomer(raw: string | null | undefined, baseDate: string): RecurrenceValue {
  const v = String(raw || "").trim().toUpperCase();
  const weekdayMap = ["SU","MO","TU","WE","TH","FR","SA"];
  const d = new Date(baseDate + "T00:00:00");
  const wd = weekdayMap[d.getDay()];
  if (v === "WEEKLY") return { mode:"WEEKLY", rrule:`FREQ=WEEKLY;INTERVAL=1;BYDAY=${wd}`, untilDate:null };
  if (v === "2W") return { mode:"WEEKLY_2", rrule:`FREQ=WEEKLY;INTERVAL=2;BYDAY=${wd}`, untilDate:null };
  if (v === "4W") return { mode:"WEEKLY_4", rrule:`FREQ=WEEKLY;INTERVAL=4;BYDAY=${wd}`, untilDate:null };
  if (v === "6W") return { mode:"WEEKLY_6", rrule:`FREQ=WEEKLY;INTERVAL=6;BYDAY=${wd}`, untilDate:null };
  if (v === "8W") return { mode:"WEEKLY_8", rrule:`FREQ=WEEKLY;INTERVAL=8;BYDAY=${wd}`, untilDate:null };
  if (v === "MONTHLY") return { mode:"MONTHLY", rrule:`FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${d.getDate()}`, untilDate:null };
  const legacy = v.match(/(2|4|6|8)\s*WEEK/);
  if (legacy) return recurrenceFromCustomer(`${legacy[1]}W`, baseDate);
  return { mode:"NONE", rrule:null, untilDate:null };
}
function formatDay(d: Date) {
  return new Intl.DateTimeFormat("nl-BE", { weekday:"short", day:"2-digit", month:"short" }).format(d);
}
function appointmentOverlap(event: EventItem, selectedDate: string, startTime: string, endTime: string) {
  if (!selectedDate || minutes(endTime) <= minutes(startTime)) return false;
  const s = new Date(event.start);
  const e = new Date(event.end);
  if (dateKey(s) !== selectedDate) return false;
  const a = minutes(hhmm(s));
  const b = minutes(hhmm(e));
  return minutes(startTime) < b && minutes(endTime) > a;
}

function CustomerPicker({
  customers,
  value,
  onChange,
  onNew,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value) || null;
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return customers.slice(0, 12);
    return customers
      .filter((c) => `${customerLabel(c)} ${customerAddress(c)} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(query))
      .slice(0, 15);
  }, [customers, q]);

  return (
    <div className="relative">
      <label className="text-sm font-medium">Klant</label>
      {selected ? (
        <div className="mt-1 tdg-customer-selected">
          <button type="button" className="min-w-0 text-left" onClick={() => { setOpen(true); setQ(""); }}>
            <strong>{customerLabel(selected)}</strong>
            <span>{customerAddress(selected) || selected.phone || "Geen adresgegevens"}</span>
          </button>
          <button type="button" onClick={() => onChange("")} aria-label="Klant wissen">×</button>
        </div>
      ) : (
        <input
          className="tdg-input mt-1"
          placeholder="Zoek op naam, bedrijf, plaats…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        />
      )}
      {open ? (
        <div className="tdg-picker-popover">
          <div className="tdg-picker-head">
            {selected ? (
              <input className="tdg-input" autoFocus placeholder="Andere klant zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
            ) : null}
            <button type="button" className="tdg-btn-small" onClick={() => { setOpen(false); onNew(); }}>+ Nieuwe klant</button>
          </div>
          <div className="tdg-picker-list">
            {filtered.map((c) => (
              <button type="button" key={c.id} onClick={() => { onChange(c.id); setQ(""); setOpen(false); }}>
                <strong>{customerLabel(c)}</strong>
                <span>{customerAddress(c) || c.phone || c.email || "Geen extra gegevens"}</span>
              </button>
            ))}
            {!filtered.length ? <div className="p-4 text-sm text-zinc-500">Geen klanten gevonden.</div> : null}
          </div>
          <button type="button" className="tdg-picker-close" onClick={() => setOpen(false)}>Sluiten</button>
        </div>
      ) : null}
    </div>
  );
}

export default function CalendarClient() {
  const calRef = useRef<any>(null);
  const plannerRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [dayEvents, setDayEvents] = useState<EventItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upcomingQ, setUpcomingQ] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ company:"", firstName:"", lastName:"", phone:"", city:"" });

  const todayKey = dateKey(new Date());
  const [form, setForm] = useState({
    customerId: "",
    date: todayKey,
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    notes: "",
  });
  const [createRecurrence, setCreateRecurrence] = useState<RecurrenceValue>({
    mode: "NONE", rrule: null, untilDate: null,
  });

  const [edit, setEdit] = useState<null | {
    seriesId: string;
    occurrenceDate: string;
    date: string;
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

  async function apiEvents(start: Date, end: Date) {
    const r = await fetch(
      `/api/calendar/events?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      { cache: "no-store" }
    );
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || "Agenda laden mislukt");
    return (j.events || []) as EventItem[];
  }

  async function loadCustomers() {
    const r = await fetch("/api/customers", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || "Klanten laden mislukt");
    setCustomers(j.items || []);
  }

  async function loadUpcoming() {
    const start = startOfLocalDay(new Date());
    const end = addDays(start, 181);
    const items = await apiEvents(start, end);
    setUpcomingEvents(items);
  }

  async function loadDay(date: string) {
    if (!date) return setDayEvents([]);
    const start = new Date(date + "T00:00:00");
    const end = addDays(start, 1);
    try { setDayEvents(await apiEvents(start, end)); } catch { setDayEvents([]); }
  }

  async function fetchVisible(start: Date, end: Date) {
    setLoadingCalendar(true);
    try { setEvents(await apiEvents(start, end)); }
    finally { setLoadingCalendar(false); }
  }

  async function refreshAll() {
    const api = calRef.current?.getApi?.();
    await Promise.all([
      api ? fetchVisible(api.view.activeStart, api.view.activeEnd) : Promise.resolve(),
      loadUpcoming(),
      loadDay(form.date),
    ]);
  }

  async function fetchSeries(seriesId: string): Promise<Series | null> {
    const r = await fetch(`/api/series/${seriesId}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && j.ok ? (j.item as Series) : null;
  }

  useEffect(() => {
    Promise.all([loadCustomers(), loadUpcoming()]).catch((e) => setError(e?.message || "Laden mislukt"));
  }, []);

  useEffect(() => { loadDay(form.date); }, [form.date]);

  useEffect(() => {
    const requested = searchParams.get("customerId");
    if (!requested || !customers.some((c) => c.id === requested)) return;
    setForm((f) => ({ ...f, customerId: requested }));
    const c = customers.find((x) => x.id === requested);
    if (c?.defaultRecurrence) setCreateRecurrence(recurrenceFromCustomer(c.defaultRecurrence, form.date));
    requestAnimationFrame(() => plannerRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }, [customers, searchParams]);

  const selectedCustomer = customers.find((c) => c.id === form.customerId) || null;
  const conflicts = useMemo(
    () => dayEvents.filter((ev) => appointmentOverlap(ev, form.date, form.startTime, form.endTime)),
    [dayEvents, form.date, form.startTime, form.endTime]
  );

  const todayEvents = useMemo(
    () => upcomingEvents.filter((e) => dateKey(new Date(e.start)) === todayKey),
    [upcomingEvents, todayKey]
  );
  const nextEvent = useMemo(
    () => upcomingEvents.filter((e) => new Date(e.start) >= new Date()).sort((a,b) => +new Date(a.start) - +new Date(b.start))[0] || null,
    [upcomingEvents]
  );
  const weekEnd = useMemo(() => addDays(new Date(), 7), []);
  const weekCount = useMemo(
    () => upcomingEvents.filter((e) => new Date(e.start) >= new Date() && new Date(e.start) <= weekEnd).length,
    [upcomingEvents, weekEnd]
  );

  const upcomingItems = useMemo(() => {
    const q = upcomingQ.trim().toLowerCase();
    return upcomingEvents
      .filter((e) => new Date(e.start) >= new Date())
      .filter((e) => {
        if (!q) return true;
        const x = e.extendedProps;
        return `${e.title} ${x.customerName || ""} ${x.customerAddress || ""} ${x.description || ""} ${x.notes || ""}`.toLowerCase().includes(q);
      })
      .slice(0, 250);
  }, [upcomingEvents, upcomingQ]);

  function chooseCustomer(id: string) {
    setForm((f) => ({ ...f, customerId:id }));
    const c = customers.find((x) => x.id === id);
    if (c?.defaultRecurrence) setCreateRecurrence(recurrenceFromCustomer(c.defaultRecurrence, form.date));
  }

  function setDuration(duration: number) {
    setForm((f) => ({ ...f, endTime: timeFromMinutes(minutes(f.startTime) + duration) }));
  }

  function fillFromSelection(start: Date, end?: Date | null) {
    const duration = end ? Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000)) : 60;
    setForm((f) => ({
      ...f,
      date: dateKey(start),
      startTime: hhmm(start),
      endTime: timeFromMinutes(minutes(hhmm(start)) + duration),
    }));
    setError(null); setNotice("Tijdsblok gekozen. Selecteer nu een klant en sla de afspraak op.");
    requestAnimationFrame(() => plannerRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }));
  }

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (!form.customerId) throw new Error("Selecteer eerst een klant.");
      if (!form.date) throw new Error("Kies een datum.");
      if (minutes(form.endTime) <= minutes(form.startTime)) throw new Error("De eindtijd moet na de starttijd liggen.");

      const r = await fetch("/api/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          startDate: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          description: form.description || null,
          notes: form.notes || null,
          rrule: createRecurrence.rrule,
          untilDate: createRecurrence.untilDate,
          title: null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Opslaan mislukt");

      const createdFor = selectedCustomer ? customerLabel(selectedCustomer) : "Klant";
      setNotice(`Afspraak voor ${createdFor} is ingepland.`);
      setForm((f) => ({ ...f, customerId:"", description:"", notes:"" }));
      setCreateRecurrence({ mode:"NONE", rrule:null, untilDate:null });
      await refreshAll();
    } catch (e: any) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function createCustomerInline(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/customers", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify({
          company:newCustomer.company || null,
          firstName:newCustomer.firstName || null,
          lastName:newCustomer.lastName || null,
          phone:newCustomer.phone || null,
          city:newCustomer.city || null,
          type:newCustomer.company ? "BUSINESS" : "PRIVATE",
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Klant aanmaken mislukt");
      setCustomers((prev) => [...prev, j.item].sort((a,b) => customerLabel(a).localeCompare(customerLabel(b), "nl")));
      chooseCustomer(j.item.id);
      setNewCustomer({ company:"", firstName:"", lastName:"", phone:"", city:"" });
      setNewCustomerOpen(false);
      setNotice("Klant aangemaakt en geselecteerd.");
    } catch (e:any) {
      setError(e?.message || "Klant aanmaken mislukt");
    } finally { setBusy(false); }
  }

  async function onEventClick(arg: any) {
    setError(null); setNotice(null);
    const xp = (arg.event._def?.extendedProps || {}) as any;
    const series = await fetchSeries(xp.seriesId);
    const start: Date = arg.event.start;
    const end: Date = arg.event.end;
    setEdit({
      seriesId: xp.seriesId,
      occurrenceDate: xp.dateKey,
      date: xp.dateKey,
      customerId: xp.customerId ?? null,
      startTime: hhmm(start),
      endTime: hhmm(end),
      description: xp.description || "",
      notes: xp.notes || "",
      isRecurring: Boolean(xp.isRecurring),
      baseSeries: series,
      mode: xp.isRecurring ? "ONLY_THIS" : "ALL",
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
    setBusy(true); setError(null); setNotice(null);
    try {
      const patch: any = {
        customerId: edit.customerId,
        description: edit.description || null,
        notes: edit.notes || null,
        startTime: edit.startTime,
        endTime: edit.endTime,
      };
      if (!edit.isRecurring || edit.mode === "ONLY_THIS") patch.startDate = edit.date;
      if (edit.isRecurring && edit.mode !== "ONLY_THIS") {
        patch.rrule = edit.recurrence.rrule;
        patch.untilDate = edit.recurrence.untilDate;
      } else if (!edit.isRecurring) {
        patch.rrule = null; patch.untilDate = null;
      }

      const r = await fetch(`/api/series/${edit.seriesId}`, {
        method:"PATCH",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify({
          mode: edit.isRecurring ? edit.mode : "ALL",
          occurrenceDate: edit.occurrenceDate,
          patch,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Wijzigen mislukt");
      setEdit(null); setNotice("Afspraak bijgewerkt."); await refreshAll();
    } catch (e:any) {
      setError(e?.message || "Wijzigen mislukt");
    } finally { setBusy(false); }
  }

  async function deleteEdit() {
    if (!edit) return;
    const recurringSingle = edit.isRecurring && edit.mode === "ONLY_THIS";
    if (!confirm(recurringSingle ? "Alleen deze afspraak verwijderen?" : "Deze afspraak of reeks verwijderen?")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = recurringSingle
        ? await fetch(`/api/series/${edit.seriesId}/occurrence/delete`, {
            method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ date:edit.occurrenceDate }),
          })
        : await fetch(`/api/series/${edit.seriesId}`, { method:"DELETE" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Verwijderen mislukt");
      setEdit(null); setNotice("Afspraak verwijderd."); await refreshAll();
    } catch (e:any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally { setBusy(false); }
  }

  function gotoDate(key: string) {
    const api = calRef.current?.getApi?.();
    if (!api) return;
    api.gotoDate(key);
    api.changeView("timeGridWeek");
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="tdg-stat"><span>Vandaag</span><strong>{todayEvents.length}</strong><small>afspraken</small></div>
        <div className="tdg-stat"><span>Komende 7 dagen</span><strong>{weekCount}</strong><small>gepland</small></div>
        <div className="tdg-stat"><span>Volgende afspraak</span><strong className="text-base">{nextEvent ? formatDay(new Date(nextEvent.start)) : "—"}</strong><small>{nextEvent?.title || "Niets gepland"}</small></div>
      </div>

      {notice ? <div className="tdg-alert tdg-alert-success">{notice}</div> : null}
      {error ? <div className="tdg-alert tdg-alert-error">{error}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3 md:p-4 tdg-calendar-shell">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><strong className="text-sm">Planning</strong><div className="text-xs text-zinc-500">Klik of sleep over een tijdsblok om meteen een afspraak klaar te zetten.</div></div>
              {loadingCalendar ? <span className="text-xs text-zinc-500">Laden…</span> : null}
            </div>
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{ left:"prev,next today", center:"title", right:"dayGridMonth,timeGridWeek,timeGridDay" }}
              buttonText={{ today:"Vandaag", month:"Maand", week:"Week", day:"Dag" }}
              firstDay={1}
              height="auto"
              locale="nl"
              events={events as any}
              eventClick={onEventClick}
              selectable
              selectMirror
              select={(info) => fillFromSelection(info.start, info.end)}
              dateClick={(info) => {
                if (String(info.view.type).startsWith("dayGrid")) {
                  const d = new Date(info.date);
                  d.setHours(9,0,0,0);
                  fillFromSelection(d, new Date(d.getTime() + 60*60000));
                }
              }}
              nowIndicator
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:15:00"
              snapDuration="00:15:00"
              scrollTime="08:00:00"
              expandRows
              businessHours={{ daysOfWeek:[1,2,3,4,5,6], startTime:"07:00", endTime:"19:00" }}
              eventTimeFormat={{ hour:"2-digit", minute:"2-digit", hour12:false }}
              slotLabelFormat={{ hour:"2-digit", minute:"2-digit", hour12:false }}
              eventDidMount={(info) => {
                const x:any = info.event.extendedProps;
                info.el.title = [x.customerName, x.customerAddress, x.description].filter(Boolean).join(" · ");
              }}
              datesSet={(info) => fetchVisible(info.start, info.end).catch((e) => setError(e?.message || "Agenda laden mislukt"))}
            />
          </section>

          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div><strong>Toekomstige afspraken</strong><div className="text-xs text-zinc-500 mt-1">Werkelijke planning voor de komende 180 dagen.</div></div>
              <input className="tdg-input md:max-w-[320px]" placeholder="Zoek klant, plaats, omschrijving…" value={upcomingQ} onChange={(e) => setUpcomingQ(e.target.value)} />
            </div>
            <div className="mt-3 max-h-[420px] overflow-auto divide-y divide-zinc-100">
              {upcomingItems.length ? upcomingItems.map((ev) => {
                const start = new Date(ev.start), end = new Date(ev.end), xp = ev.extendedProps;
                return (
                  <button key={ev.id} className="tdg-upcoming-row" onClick={() => gotoDate(xp.dateKey)}>
                    <div className="tdg-upcoming-date"><strong>{pad2(start.getDate())}</strong><span>{new Intl.DateTimeFormat("nl-BE",{month:"short"}).format(start)}</span></div>
                    <div className="min-w-0">
                      <strong>{ev.title}</strong>
                      <span>{hhmm(start)}–{hhmm(end)}{xp.customerAddress ? ` · ${xp.customerAddress}` : ""}</span>
                      {xp.description ? <small>{xp.description}</small> : null}
                    </div>
                    <b>→</b>
                  </button>
                );
              }) : <div className="text-sm text-zinc-500 py-8 text-center">Geen afspraken gevonden.</div>}
            </div>
          </section>
        </div>

        <aside ref={plannerRef} className="space-y-4 xl:sticky xl:top-[86px]">
          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><span className="tdg-kicker">Snel plannen</span><h2 className="text-xl font-semibold tracking-tight mt-1">Nieuwe afspraak</h2></div>
              <button type="button" className="tdg-btn-small" onClick={() => {
                const d=new Date(); d.setHours(9,0,0,0); fillFromSelection(d,new Date(d.getTime()+60*60000));
              }}>Vandaag</button>
            </div>

            <form onSubmit={createAppointment} className="space-y-4">
              <CustomerPicker customers={customers} value={form.customerId} onChange={chooseCustomer} onNew={() => setNewCustomerOpen(true)} />
              {selectedCustomer ? (
                <div className="tdg-selected-customer-card">
                  <strong>{customerLabel(selectedCustomer)}</strong>
                  <span>{customerAddress(selectedCustomer) || "Geen adres ingevuld"}</span>
                  {selectedCustomer.phone ? <a href={`tel:${selectedCustomer.phone}`}>{selectedCustomer.phone}</a> : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2"><span>Datum</span><input type="date" className="tdg-input mt-1" value={form.date} onChange={(e) => {
                  const next=e.target.value; setForm((f)=>({...f,date:next}));
                  if (selectedCustomer?.defaultRecurrence && createRecurrence.mode!=="NONE") setCreateRecurrence(recurrenceFromCustomer(selectedCustomer.defaultRecurrence,next));
                }} required /></label>
                <label><span>Start</span><input type="time" className="tdg-input mt-1" value={form.startTime} onChange={(e) => {
                  const next=e.target.value; const duration=Math.max(15,minutes(form.endTime)-minutes(form.startTime));
                  setForm((f)=>({...f,startTime:next,endTime:timeFromMinutes(minutes(next)+duration)}));
                }} required /></label>
                <label><span>Einde</span><input type="time" className="tdg-input mt-1" value={form.endTime} onChange={(e) => setForm((f)=>({...f,endTime:e.target.value}))} required /></label>
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-600 mb-2">Snelle duur</div>
                <div className="flex flex-wrap gap-2">
                  {[30,60,90,120,180].map((m) => <button type="button" key={m} onClick={() => setDuration(m)} className="tdg-duration">{m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m/60)}u${m%60}` : `${m/60}u`}</button>)}
                </div>
              </div>

              {conflicts.length ? (
                <div className="tdg-conflict">
                  <strong>Let op: overlap</strong>
                  <span>{conflicts.length === 1 ? "Er staat al een afspraak in dit tijdsblok." : `Er staan al ${conflicts.length} afspraken in dit tijdsblok.`}</span>
                  {conflicts.slice(0,2).map((x) => <small key={x.id}>{x.title} · {hhmm(new Date(x.start))}–{hhmm(new Date(x.end))}</small>)}
                </div>
              ) : null}

              <details className="tdg-recurrence-details" open={Boolean(selectedCustomer?.defaultRecurrence)}>
                <summary>Herhaling instellen <span>{createRecurrence.mode === "NONE" ? "Eenmalig" : "Recurrent"}</span></summary>
                <div className="pt-3"><RecurrenceBuilder baseDate={form.date} value={createRecurrence} onChange={setCreateRecurrence} /></div>
              </details>

              <label><span>Omschrijving</span><input className="tdg-input mt-1" placeholder="bv. ramen + veranda" value={form.description} onChange={(e) => setForm((f)=>({...f,description:e.target.value}))} /></label>
              <label><span>Notities</span><textarea className="tdg-input mt-1 min-h-[82px]" placeholder="Toegang, materiaal, aandachtspunten…" value={form.notes} onChange={(e) => setForm((f)=>({...f,notes:e.target.value}))} /></label>

              <button disabled={busy || !form.customerId} className="tdg-btn-primary w-full py-3">
                {busy ? "Inplannen…" : "Afspraak inplannen"}
              </button>
            </form>
          </section>

          {newCustomerOpen ? (
            <section className="bg-white rounded-2xl border border-sky-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3"><strong>Snel nieuwe klant</strong><button type="button" onClick={() => setNewCustomerOpen(false)}>×</button></div>
              <form onSubmit={createCustomerInline} className="space-y-3">
                <input className="tdg-input" placeholder="Bedrijf (optioneel)" value={newCustomer.company} onChange={(e)=>setNewCustomer((x)=>({...x,company:e.target.value}))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="tdg-input" placeholder="Voornaam" value={newCustomer.firstName} onChange={(e)=>setNewCustomer((x)=>({...x,firstName:e.target.value}))} />
                  <input className="tdg-input" placeholder="Achternaam" value={newCustomer.lastName} onChange={(e)=>setNewCustomer((x)=>({...x,lastName:e.target.value}))} />
                </div>
                <input className="tdg-input" placeholder="Telefoon" value={newCustomer.phone} onChange={(e)=>setNewCustomer((x)=>({...x,phone:e.target.value}))} />
                <input className="tdg-input" placeholder="Gemeente" value={newCustomer.city} onChange={(e)=>setNewCustomer((x)=>({...x,city:e.target.value}))} />
                <button disabled={busy} className="tdg-btn-primary w-full">Aanmaken en selecteren</button>
              </form>
            </section>
          ) : null}

          {edit ? (
            <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div><span className="tdg-kicker">Wijzigen</span><h2 className="text-lg font-semibold mt-1">{customerLabel(customers.find((c)=>c.id===edit.customerId)) || "Afspraak"}</h2></div>
                <button type="button" onClick={()=>setEdit(null)}>×</button>
              </div>

              {edit.isRecurring ? (
                <label><span>Toepassen op</span><select className="tdg-input mt-1" value={edit.mode} onChange={(e)=>setEdit((x)=>x?{...x,mode:e.target.value as any}:x)}>
                  <option value="ONLY_THIS">Alleen deze afspraak</option>
                  <option value="FUTURE">Deze en toekomstige afspraken</option>
                  <option value="ALL">Volledige reeks</option>
                </select></label>
              ) : null}

              <div className="space-y-3 mt-3">
                <CustomerPicker customers={customers} value={edit.customerId || ""} onChange={(id)=>setEdit((x)=>x?{...x,customerId:id||null}:x)} onNew={()=>setNewCustomerOpen(true)} />
                <label><span>Datum</span><input type="date" className="tdg-input mt-1" value={edit.date} disabled={edit.isRecurring && edit.mode!=="ONLY_THIS"} onChange={(e)=>setEdit((x)=>x?{...x,date:e.target.value}:x)} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label><span>Start</span><input type="time" className="tdg-input mt-1" value={edit.startTime} onChange={(e)=>setEdit((x)=>x?{...x,startTime:e.target.value}:x)} /></label>
                  <label><span>Einde</span><input type="time" className="tdg-input mt-1" value={edit.endTime} onChange={(e)=>setEdit((x)=>x?{...x,endTime:e.target.value}:x)} /></label>
                </div>
                {edit.isRecurring ? <details className="tdg-recurrence-details" open={edit.mode!=="ONLY_THIS"}><summary>Recurrentie</summary><div className="pt-3"><RecurrenceBuilder baseDate={edit.occurrenceDate} value={edit.recurrence} disabled={edit.mode==="ONLY_THIS"} onChange={(v)=>setEdit((x)=>x?{...x,recurrence:v}:x)} /></div></details> : null}
                <label><span>Omschrijving</span><input className="tdg-input mt-1" value={edit.description} onChange={(e)=>setEdit((x)=>x?{...x,description:e.target.value}:x)} /></label>
                <label><span>Notities</span><textarea className="tdg-input mt-1 min-h-[82px]" value={edit.notes} onChange={(e)=>setEdit((x)=>x?{...x,notes:e.target.value}:x)} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={busy} onClick={saveEdit} className="tdg-btn-primary">Opslaan</button>
                  <button disabled={busy} onClick={deleteEdit} className="tdg-btn-danger">Verwijderen</button>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
