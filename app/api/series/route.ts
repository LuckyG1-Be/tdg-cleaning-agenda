import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const SeriesInput = z.object({
  customerId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string(), // YYYY-MM-DD
  startTime: z.string(), // HH:mm
  endTime: z.string(),   // HH:mm
  rrule: z.string().nullable().optional(), // e.g. "FREQ=WEEKLY;INTERVAL=2" or full "RRULE:..."
  untilDate: z.string().nullable().optional(), // YYYY-MM-DD or null
});

export async function POST(req: Request) {
  const body = SeriesInput.parse(await req.json());
  const startDate = new Date(body.startDate + "T00:00:00");
  const untilDate = body.untilDate ? new Date(body.untilDate + "T00:00:00") : null;

  const item = await prisma.appointmentSeries.create({
    data: {
      customerId: body.customerId ?? null,
      title: body.title ?? null,
      description: body.description ?? null,
      notes: body.notes ?? null,
      startDate,
      startTime: body.startTime,
      endTime: body.endTime,
      rrule: body.rrule ?? null,
      untilDate,
      timezone: "Europe/Brussels",
    },
  });

  return NextResponse.json({ ok: true, item });
}
