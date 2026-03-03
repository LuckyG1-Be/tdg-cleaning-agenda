import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const UpdateMode = z.enum(["ONLY_THIS", "FUTURE", "ALL"]);

const Patch = z.object({
  mode: UpdateMode,
  occurrenceDate: z.string().optional(), // YYYY-MM-DD required for ONLY_THIS/FUTURE
  patch: z.object({
    customerId: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    rrule: z.string().nullable().optional(),
    untilDate: z.string().nullable().optional(), // YYYY-MM-DD
  }),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { mode, occurrenceDate, patch } = Patch.parse(await req.json());
  const id = ctx.params.id;

  const series = await prisma.appointmentSeries.findUnique({ where: { id } });
  if (!series) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (mode === "ALL") {
    const untilDate = patch.untilDate === undefined ? undefined : (patch.untilDate ? new Date(patch.untilDate + "T00:00:00") : null);
    const updated = await prisma.appointmentSeries.update({
      where: { id },
      data: {
        customerId: patch.customerId ?? undefined,
        title: patch.title ?? undefined,
        description: patch.description ?? undefined,
        notes: patch.notes ?? undefined,
        startTime: patch.startTime ?? undefined,
        endTime: patch.endTime ?? undefined,
        rrule: patch.rrule ?? undefined,
        untilDate,
      },
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  if (!occurrenceDate) {
    return NextResponse.json({ ok: false, error: "occurrenceDate required" }, { status: 400 });
  }

  const occDate = new Date(occurrenceDate + "T00:00:00");

  if (mode === "ONLY_THIS") {
    const ex = await prisma.appointmentException.upsert({
      where: { seriesId_date: { seriesId: id, date: occDate } },
      create: {
        seriesId: id,
        date: occDate,
        isDeleted: false,
        customerId: patch.customerId ?? null,
        title: patch.title ?? null,
        description: patch.description ?? null,
        notes: patch.notes ?? null,
        startTime: patch.startTime ?? null,
        endTime: patch.endTime ?? null,
      },
      update: {
        isDeleted: false,
        customerId: patch.customerId ?? undefined,
        title: patch.title ?? undefined,
        description: patch.description ?? undefined,
        notes: patch.notes ?? undefined,
        startTime: patch.startTime ?? undefined,
        endTime: patch.endTime ?? undefined,
      },
    });
    return NextResponse.json({ ok: true, exception: ex });
  }

  // FUTURE: split series at occurrenceDate
  // 1) set current series untilDate = day before occurrenceDate
  // 2) create new series starting at occurrenceDate with updated fields (fallback to old fields)
  const dayBefore = new Date(occDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const untilOld = await prisma.appointmentSeries.update({
    where: { id },
    data: {
      untilDate: dayBefore,
    },
  });

  const newUntil = patch.untilDate === undefined ? series.untilDate : (patch.untilDate ? new Date(patch.untilDate + "T00:00:00") : null);

  const created = await prisma.appointmentSeries.create({
    data: {
      customerId: patch.customerId === undefined ? series.customerId : patch.customerId,
      title: patch.title === undefined ? series.title : patch.title,
      description: patch.description === undefined ? series.description : patch.description,
      notes: patch.notes === undefined ? series.notes : patch.notes,
      startDate: occDate,
      startTime: patch.startTime === undefined ? series.startTime : (patch.startTime ?? series.startTime),
      endTime: patch.endTime === undefined ? series.endTime : (patch.endTime ?? series.endTime),
      rrule: patch.rrule === undefined ? series.rrule : patch.rrule,
      untilDate: newUntil,
      timezone: "Europe/Brussels",
    },
  });

  return NextResponse.json({ ok: true, split: { old: untilOld, next: created } });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await prisma.appointmentSeries.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
