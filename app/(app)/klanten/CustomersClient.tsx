"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Customer = {
  id: string;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  type?: "PRIVATE" | "BUSINESS" | null;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  street?: string | null;
  number?: string | null;
  box?: string | null;
  postal?: string | null;
  city?: string | null;
  country?: string | null;
  defaultRecurrence?: string | null;
  notes?: string | null;
  _count?: { series: number };
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function label(c: Customer) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return (c.company || name || "Nieuwe klant").trim();
}
function address(c: Customer) {
  const a = [c.street, c.number, c.box ? `bus ${c.box}` : ""].filter(Boolean).join(" ");
  const b = [c.postal, c.city].filter(Boolean).join(" ");
  return [a, b].filter(Boolean).join(", ");
}
function blankCustomer(): Customer {
  return {
    id: "",
    type: "PRIVATE",
    country: "België",
    defaultRecurrence: null,
    notes: "",
  };
}

const recurrenceOptions = [
  ["", "Geen standaard"],
  ["WEEKLY", "Wekelijks"],
  ["2W", "Om de 2 weken"],
  ["4W", "Om de 4 weken"],
  ["6W", "Om de 6 weken"],
  ["8W", "Om de 8 weken"],
  ["MONTHLY", "Maandelijks"],
];

export default function CustomersClient() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load(query = q) {
    setLoading(true);
    try {
      const r = await fetch("/api/customers?q=" + encodeURIComponent(query), { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Laden mislukt");
      setItems(j.items || []);
    } catch (e: any) {
      setError(e?.message || "Klanten konden niet worden geladen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const stats = useMemo(() => {
    const business = items.filter((x) => x.type === "BUSINESS").length;
    return { total: items.length, business, private: items.length - business };
  }, [items]);

  function createNew() {
    setSelected(blankCustomer());
    setIsNew(true);
    setError(null);
    setSaved(null);
  }

  async function selectCustomer(c: Customer) {
    setError(null);
    setSaved(null);
    setIsNew(false);
    setSelected(c);
    try {
      const r = await fetch(`/api/customers/${c.id}`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok && j.ok) setSelected(j.item);
    } catch {}
  }

  function setField<K extends keyof Customer>(key: K, value: Customer[K]) {
    setSelected((s) => (s ? { ...s, [key]: value } : s));
    setSaved(null);
  }

  async function save() {
    if (!selected) return;
    if (!selected.company?.trim() && !selected.firstName?.trim() && !selected.lastName?.trim()) {
      setError("Vul minstens een bedrijfsnaam, voornaam of achternaam in.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const endpoint = isNew ? "/api/customers" : `/api/customers/${selected.id}`;
      const r = await fetch(endpoint, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Opslaan mislukt");

      setSelected(j.item);
      setIsNew(false);
      setSaved("Klant opgeslagen.");
      setItems((prev) => {
        const exists = prev.some((c) => c.id === j.item.id);
        return exists ? prev.map((c) => (c.id === j.item.id ? j.item : c)) : [j.item, ...prev];
      });
      await load(q);
    } catch (e: any) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!selected?.id || isNew) {
      setSelected(null);
      setIsNew(false);
      return;
    }
    if (!confirm(`${label(selected)} verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;

    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${selected.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Verwijderen mislukt");
      setItems((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
    } catch (e: any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="tdg-stat"><span>Klanten</span><strong>{stats.total}</strong></div>
        <div className="tdg-stat"><span>Particulier</span><strong>{stats.private}</strong></div>
        <div className="tdg-stat"><span>Zakelijk</span><strong>{stats.business}</strong></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <aside className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <div className="flex gap-2">
              <input
                className="tdg-input flex-1"
                placeholder="Zoek naam, bedrijf, gemeente…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button disabled={busy} onClick={createNew} className="tdg-btn-primary whitespace-nowrap">
                + Nieuw
              </button>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              {loading ? "Klanten laden…" : `${items.length} resultaten`}
            </div>
          </div>

          <div className="max-h-[68vh] overflow-auto p-2">
            {items.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className={cls(
                  "w-full text-left p-3 rounded-xl transition mb-1",
                  selected?.id === c.id && !isNew
                    ? "bg-sky-50 ring-1 ring-sky-200"
                    : "hover:bg-zinc-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm text-zinc-900">{label(c)}</strong>
                  <span className="tdg-chip">{c.type === "BUSINESS" ? "Zakelijk" : "Particulier"}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{address(c) || c.email || c.phone || "Geen adresgegevens"}</div>
              </button>
            ))}
            {!loading && !items.length ? (
              <div className="text-sm text-zinc-500 py-10 text-center">Geen klanten gevonden.</div>
            ) : null}
          </div>
        </aside>

        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
          {!selected ? (
            <div className="min-h-[420px] grid place-items-center text-center">
              <div>
                <div className="text-lg font-semibold">Selecteer een klant</div>
                <p className="text-sm text-zinc-500 mt-1">Of maak een nieuwe klant aan om gegevens en planning te beheren.</p>
                <button onClick={createNew} className="tdg-btn-primary mt-4">Nieuwe klant</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[.14em] font-semibold text-sky-600">
                    {isNew ? "Nieuwe klant" : selected.type === "BUSINESS" ? "Zakelijke klant" : "Particuliere klant"}
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight mt-1">{label(selected)}</h2>
                  {!isNew && selected._count?.series ? (
                    <div className="text-xs text-zinc-500 mt-1">{selected._count.series} gekoppelde afspraakreeksen</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isNew && selected.id ? (
                    <Link href={`/agenda?customerId=${encodeURIComponent(selected.id)}`} className="tdg-btn-secondary">
                      Plan afspraak →
                    </Link>
                  ) : null}
                  <button disabled={busy} onClick={save} className="tdg-btn-primary">
                    {busy ? "Opslaan…" : isNew ? "Klant aanmaken" : "Opslaan"}
                  </button>
                  <button disabled={busy} onClick={del} className="tdg-btn-danger">
                    {isNew ? "Annuleren" : "Verwijderen"}
                  </button>
                </div>
              </div>

              {error ? <div className="tdg-alert tdg-alert-error">{error}</div> : null}
              {saved ? <div className="tdg-alert tdg-alert-success">{saved}</div> : null}

              <div className="tdg-form-section">
                <div className="tdg-form-title">Identiteit</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label><span>Type klant</span>
                    <select className="tdg-input mt-1" value={selected.type || "PRIVATE"} onChange={(e) => setField("type", e.target.value as any)}>
                      <option value="PRIVATE">Particulier</option><option value="BUSINESS">Zakelijk</option>
                    </select>
                  </label>
                  <label><span>Bedrijf</span><input className="tdg-input mt-1" value={selected.company || ""} onChange={(e) => setField("company", e.target.value || null)} /></label>
                  <label><span>Voornaam</span><input className="tdg-input mt-1" value={selected.firstName || ""} onChange={(e) => setField("firstName", e.target.value || null)} /></label>
                  <label><span>Achternaam</span><input className="tdg-input mt-1" value={selected.lastName || ""} onChange={(e) => setField("lastName", e.target.value || null)} /></label>
                  <label><span>E-mail</span><input type="email" className="tdg-input mt-1" value={selected.email || ""} onChange={(e) => setField("email", e.target.value || null)} /></label>
                  <label><span>Telefoon</span><input className="tdg-input mt-1" value={selected.phone || ""} onChange={(e) => setField("phone", e.target.value || null)} /></label>
                  <label className="md:col-span-2"><span>BTW-nummer</span><input className="tdg-input mt-1" value={selected.vat || ""} onChange={(e) => setField("vat", e.target.value || null)} /></label>
                </div>
              </div>

              <div className="tdg-form-section">
                <div className="tdg-form-title">Adres</div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <label className="md:col-span-4"><span>Straat</span><input className="tdg-input mt-1" value={selected.street || ""} onChange={(e) => setField("street", e.target.value || null)} /></label>
                  <label><span>Nr.</span><input className="tdg-input mt-1" value={selected.number || ""} onChange={(e) => setField("number", e.target.value || null)} /></label>
                  <label><span>Bus</span><input className="tdg-input mt-1" value={selected.box || ""} onChange={(e) => setField("box", e.target.value || null)} /></label>
                  <label className="md:col-span-2"><span>Postcode</span><input className="tdg-input mt-1" value={selected.postal || ""} onChange={(e) => setField("postal", e.target.value || null)} /></label>
                  <label className="md:col-span-2"><span>Gemeente</span><input className="tdg-input mt-1" value={selected.city || ""} onChange={(e) => setField("city", e.target.value || null)} /></label>
                  <label className="md:col-span-2"><span>Land</span><input className="tdg-input mt-1" value={selected.country || ""} onChange={(e) => setField("country", e.target.value || null)} /></label>
                </div>
              </div>

              <div className="tdg-form-section">
                <div className="tdg-form-title">Planning</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label><span>Standaard frequentie</span>
                    <select className="tdg-input mt-1" value={selected.defaultRecurrence || ""} onChange={(e) => setField("defaultRecurrence", e.target.value || null)}>
                      {recurrenceOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                    </select>
                  </label>
                  {!isNew && selected.id ? (
                    <div className="flex items-end">
                      <Link href={`/agenda?customerId=${encodeURIComponent(selected.id)}`} className="tdg-btn-secondary w-full text-center">
                        Deze klant nu inplannen
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="tdg-form-section">
                <div className="tdg-form-title">Notities</div>
                <textarea className="tdg-input min-h-[140px]" value={selected.notes || ""} onChange={(e) => setField("notes", e.target.value || null)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
