"use client";

import { useEffect, useState } from "react";

type Customer = any;

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function label(c: Customer) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return (c.company || name || "Klant").trim();
}

export default function CustomersClient() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(query = q) {
    const r = await fetch("/api/customers?q=" + encodeURIComponent(query));
    const j = await r.json();
    if (j.ok) setItems(j.items);
  }

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function createNew() {
    setBusy(true);
    setError(null);
    try {
      // Zorg dat hij zichtbaar is: maak zoeken leeg
      setQ("");

      const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Aanmaken mislukt");

      // Optimistisch toevoegen + selecteren (geen refresh nodig)
      setItems((prev) => [j.item, ...prev]);
      setSelected(j.item);

      // Optioneel: haal lijst meteen opnieuw op (zorgt voor correcte sortering)
      await load("");
    } catch (e: any) {
      setError(e?.message || "Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Opslaan mislukt");

      // update in lijst
      setItems((prev) => prev.map((c) => (c.id === j.item.id ? j.item : c)));
      setSelected(j.item);
    } catch (e: any) {
      setError(e?.message || "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!selected) return;
    if (!confirm("Klant verwijderen?")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${selected.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Verwijderen mislukt");

      setItems((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
    } catch (e: any) {
      setError(e?.message || "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  function setField(k: string, v: any) {
    setSelected((s: any) => ({ ...(s || {}), [k]: v }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <input
            className="w-full rounded-xl border border-zinc-200 px-3 py-2"
            placeholder="Zoek (naam, bedrijf, stad, email, tel)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={createNew}
            className="shrink-0 rounded-xl bg-zinc-900 text-white px-3 py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
          >
            + Nieuw
          </button>
        </div>

        {error ? <div className="text-sm text-red-600 mb-2">{error}</div> : null}

        <div className="divide-y divide-zinc-100 max-h-[60vh] overflow-auto">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={cls(
                "w-full text-left py-3 px-2 rounded-xl",
                selected?.id === c.id ? "bg-zinc-50" : "hover:bg-zinc-50"
              )}
            >
              <div className="font-medium">{label(c)}</div>
              <div className="text-xs text-zinc-500">
                {[c.street, c.number, c.city].filter(Boolean).join(" ")}
              </div>
            </button>
          ))}
          {!items.length ? (
            <div className="text-sm text-zinc-500 py-6 text-center">Geen klanten</div>
          ) : null}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
        {!selected ? (
          <div className="text-sm text-zinc-600">
            Selecteer een klant links, of klik op <span className="font-medium">+ Nieuw</span>.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{label(selected)}</div>
                <div className="text-xs text-zinc-500">ID: {selected.id}</div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={save}
                  className="rounded-xl bg-zinc-900 text-white px-4 py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
                >
                  Opslaan
                </button>
                <button
                  disabled={busy}
                  onClick={del}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-medium hover:bg-zinc-50 disabled:opacity-60"
                >
                  Verwijderen
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["company", "Bedrijf"],
                ["firstName", "Voornaam"],
                ["lastName", "Achternaam"],
                ["type", "Type (PRIVATE/BUSINESS)"],
                ["email", "E-mail"],
                ["phone", "Telefoon"],
                ["vat", "BTW-nummer"],
                ["street", "Straat"],
                ["number", "Nummer"],
                ["box", "Bus"],
                ["postal", "Postcode"],
                ["city", "Gemeente"],
                ["country", "Land"],
                ["defaultRecurrence", "Standaard frequentie (vrij veld)"],
              ].map(([k, labelText]) => (
                <div key={k}>
                  <label className="text-sm font-medium">{labelText}</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                    value={(selected as any)[k] || ""}
                    onChange={(e) => setField(k, e.target.value || null)}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium">Notities</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 min-h-[140px]"
                value={selected.notes || ""}
                onChange={(e) => setField("notes", e.target.value || null)}
              />
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
