import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { occurrencesBetween, dateKeyLocal } from "@/lib/recurrence";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localDateTimeString(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(h);
  const mm = pad2(m);
  return `${y}-${mo}-${d}T${hh}:${mm}:00`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ ok: false, error: "Missing start/end" }, { status: 400 });
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  const series = await prisma.appointmentSeries.findMany({
    include: {
      customer: true,
      exceptions: true,
    },
  });

  const customerIds = Array.from(
    new Set(
      series.flatMap((s) => [
        ...(s.customerId ? [s.customerId] : []),
        ...s.exceptions.map((ex) => ex.customerId).filter(Boolean),
      ])
    )
  ) as string[];

  const customers =
    customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
        })
      : [];

  const customerMap = new Map(customers.map((c) => [c.id, c]));

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
    for (const ex of s.exceptions) {
      exByKey.set(dateKeyLocal(ex.date), ex);
    }

    for (const o of occs) {
      const ex = exByKey.get(o.dateKey);
      if (ex?.isDeleted) continue;

      const customer =
        ex?.customerId
          ? customerMap.get(ex.customerId) || null
          : s.customerId
          ? customerMap.get(s.customerId) || s.customer || null
          : s.customer || null;

      const title =
        (ex?.title ?? s.title) ||
        (customer
          ? customer.company || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Klant"
          : "Afspraak");

      const startTime = ex?.startTime ?? s.startTime;
      const endTime = ex?.endTime ?? s.endTime;

      // Gebruik LOCAL naive datetime strings zodat 12:00 altijd 12:00 blijft
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
          description: ex?.description ?? s.description,
          notes: ex?.notes ?? s.notes,
          isRecurring: !!s.rrule,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, events });
}
