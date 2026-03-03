import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { occurrencesBetween, dateKeyLocal } from "@/lib/recurrence";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ ok: false, error: "Missing start/end" }, { status: 400 });

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);

  const series = await prisma.appointmentSeries.findMany({
    include: {
      customer: true,
      exceptions: true,
    },
  });

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
        ? await prisma.customer.findUnique({ where: { id: ex.customerId } })
        : s.customer;

      const title = (ex?.title ?? s.title) || (
        customer
          ? (customer.company || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Klant")
          : "Afspraak"
      );

      const startTime = ex?.startTime ?? s.startTime;
      const endTime = ex?.endTime ?? s.endTime;

      const baseDate = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());
      const startDt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), Number(startTime.slice(0,2)), Number(startTime.slice(3,5)));
      const endDt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), Number(endTime.slice(0,2)), Number(endTime.slice(3,5)));

      events.push({
        id: `${s.id}__${o.dateKey}`,
        seriesId: s.id,
        dateKey: o.dateKey,
        title,
        start: startDt.toISOString(),
        end: endDt.toISOString(),
        extendedProps: {
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
