import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const UpdateMode = z.enum(["ONLY_THIS", "FUTURE", "ALL"]);

const Patch = z.object({
  mode: UpdateMode,
  occurrenceDate: z.string().regex(dateRe).optional(),
  patch: z.object({
    customerId: z.string().nullable().optional(),
    title: z.string().max(180).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    startTime: z.string().regex(timeRe).nullable().optional(),
    endTime: z.string().regex(timeRe).nullable().optional(),
    rrule: z.string().max(1000).nullable().optional(),
    untilDate: z.string().regex(dateRe).nullable().optional(),
    startDate: z.string().regex(dateRe).nullable().optional(),
  }),
});

function localDate(value: string) {
  return new Date(value + "T00:00:00");
}
function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const item = await prisma.appointmentSeries.findUnique({ where: { id: ctx.params.id } });
  if (!item) return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const { mode, occurrenceDate, patch } = Patch.parse(await req.json());
    const id = ctx.params.id;
    const series = await prisma.appointmentSeries.findUnique({ where: { id } });
    if (!series) return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });

    const nextStart = patch.startTime ?? series.startTime;
    const nextEnd = patch.endTime ?? series.endTime;
    if (nextStart && nextEnd && minutes(nextEnd) <= minutes(nextStart)) {
      return NextResponse.json(
        { ok: false, error: "De eindtijd moet na de starttijd liggen." },
        { status: 400 }
      );
    }

    const untilDate =
      patch.untilDate === undefined
        ? undefined
        : patch.untilDate
        ? localDate(patch.untilDate)
        : null;

    const startDate =
      patch.startDate === undefined
        ? undefined
        : patch.startDate
        ? localDate(patch.startDate)
        : null;

    if (untilDate && startDate && untilDate < startDate) {
      return NextResponse.json(
        { ok: false, error: "De einddatum kan niet vóór de startdatum liggen." },
        { status: 400 }
      );
    }

    if (mode === "ALL") {
      const updated = await prisma.appointmentSeries.update({
        where: { id },
        data: {
          customerId: patch.customerId ?? undefined,
          title: patch.title ?? undefined,
          description: patch.description ?? undefined,
          notes: patch.notes ?? undefined,
          startTime: patch.startTime ?? undefined,
          endTime: patch.endTime ?? undefined,
          rrule: patch.rrule === undefined ? undefined : patch.rrule,
          untilDate,
          startDate: startDate ?? undefined,
        },
      });
      return NextResponse.json({ ok: true, item: updated });
    }

    if (!occurrenceDate) {
      return NextResponse.json({ ok: false, error: "Datum van de afspraak ontbreekt." }, { status: 400 });
    }

    const occDate = localDate(occurrenceDate);

    if (mode === "ONLY_THIS") {
      const moving = Boolean(patch.startDate && patch.startDate !== occurrenceDate);
      if (moving) {
        const movedDate = localDate(patch.startDate!);
        const result = await prisma.$transaction(async (tx) => {
          await tx.appointmentException.upsert({
            where: { seriesId_date: { seriesId: id, date: occDate } },
            create: { seriesId: id, date: occDate, isDeleted: true },
            update: { isDeleted: true },
          });
          return tx.appointmentSeries.create({
            data: {
              customerId: patch.customerId === undefined ? series.customerId : patch.customerId,
              title: patch.title === undefined ? series.title : patch.title,
              description: patch.description === undefined ? series.description : patch.description,
              notes: patch.notes === undefined ? series.notes : patch.notes,
              startDate: movedDate,
              startTime: patch.startTime ?? series.startTime,
              endTime: patch.endTime ?? series.endTime,
              rrule: null,
              untilDate: null,
              timezone: series.timezone || "Europe/Brussels",
            },
          });
        });
        return NextResponse.json({ ok: true, moved: result });
      }

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

    const dayBefore = new Date(occDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const newUntil =
      patch.untilDate === undefined
        ? series.untilDate
        : patch.untilDate
        ? localDate(patch.untilDate)
        : null;

    if (newUntil && newUntil < occDate) {
      return NextResponse.json(
        { ok: false, error: "De nieuwe einddatum ligt vóór de start van de toekomstige reeks." },
        { status: 400 }
      );
    }

    const split = await prisma.$transaction(async (tx) => {
      const old = await tx.appointmentSeries.update({
        where: { id },
        data: { untilDate: dayBefore },
      });
      const next = await tx.appointmentSeries.create({
        data: {
          customerId: patch.customerId === undefined ? series.customerId : patch.customerId,
          title: patch.title === undefined ? series.title : patch.title,
          description: patch.description === undefined ? series.description : patch.description,
          notes: patch.notes === undefined ? series.notes : patch.notes,
          startDate: occDate,
          startTime: patch.startTime ?? series.startTime,
          endTime: patch.endTime ?? series.endTime,
          rrule: patch.rrule === undefined ? series.rrule : patch.rrule,
          untilDate: newUntil,
          timezone: series.timezone || "Europe/Brussels",
        },
      });
      return { old, next };
    });

    return NextResponse.json({ ok: true, split });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Controleer de ingevoerde afspraakgegevens." }, { status: 400 });
    }
    console.error("update series failed", e);
    return NextResponse.json({ ok: false, error: "De afspraak kon niet worden gewijzigd." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    await prisma.appointmentSeries.delete({ where: { id: ctx.params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("delete series failed", e);
    return NextResponse.json({ ok: false, error: "De afspraak kon niet worden verwijderd." }, { status: 500 });
  }
}
