import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { occurrencesBetween, dateKeyLocal } from "@/lib/recurrence";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function localDateTimeString(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(h)}:${pad2(m)}:00`;
}
function customerLabel(customer: any) {
  if (!customer) return "";
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
  return (customer.company || name || "Klant").trim();
}
function addressLabel(customer: any) {
  if (!customer) return "";
  const line1 = [customer.street, customer.number, customer.box ? `bus ${customer.box}` : ""].filter(Boolean).join(" ");
  const line2 = [customer.postal, customer.city].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json({ ok: false, error: "Start- en einddatum ontbreken." }, { status: 400 });
    }

    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
    if (!Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeEnd <= rangeStart) {
      return NextResponse.json({ ok: false, error: "Ongeldig datumbereik." }, { status: 400 });
    }

    const series = await prisma.appointmentSeries.findMany({
      where: {
        OR: [
          { rrule: null, startDate: { gte: rangeStart, lt: rangeEnd } },
          {
            rrule: { not: null },
            startDate: { lt: rangeEnd },
            OR: [{ untilDate: null }, { untilDate: { gte: rangeStart } }],
          },
        ],
      },
      include: { customer: true, exceptions: true },
      orderBy: { startDate: "asc" },
    });

    const exceptionCustomerIds = Array.from(
      new Set(series.flatMap((s) => s.exceptions.map((ex) => ex.customerId).filter(Boolean)))
    ) as string[];
    const extraCustomers = exceptionCustomerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: exceptionCustomerIds } } })
      : [];
    const customerMap = new Map(extraCustomers.map((c) => [c.id, c]));

    const events: any[] = [];

    for (const s of series) {
      const occs = occurrencesBetween({
        startDate: s.startDate,
        startTime: s.startTime,
        endTime: s.endTime,
        rrule: s.rrule,
        untilDate: s.untilDate,
        rangeStart,
        rangeEnd,
      });

      const exByKey = new Map<string, any>();
      for (const ex of s.exceptions) exByKey.set(dateKeyLocal(ex.date), ex);

      for (const o of occs) {
        const ex = exByKey.get(o.dateKey);
        if (ex?.isDeleted) continue;

        const customer = ex?.customerId
          ? customerMap.get(ex.customerId) || null
          : s.customer || null;

        const title = (ex?.title ?? s.title) || customerLabel(customer) || "Afspraak";
        const startTime = ex?.startTime ?? s.startTime;
        const endTime = ex?.endTime ?? s.endTime;
        const baseDate = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());

        events.push({
          id: `${s.id}__${o.dateKey}`,
          title,
          start: localDateTimeString(baseDate, startTime),
          end: localDateTimeString(baseDate, endTime),
          extendedProps: {
            seriesId: s.id,
            dateKey: o.dateKey,
            customerId: ex?.customerId ?? s.customerId,
            customerName: customerLabel(customer),
            customerPhone: customer?.phone || null,
            customerAddress: addressLabel(customer) || null,
            description: ex?.description ?? s.description,
            notes: ex?.notes ?? s.notes,
            isRecurring: Boolean(s.rrule),
          },
        });
      }
    }

    events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    console.error("calendar events failed", e);
    return NextResponse.json({ ok: false, error: "De agenda kon niet worden geladen." }, { status: 500 });
  }
}
