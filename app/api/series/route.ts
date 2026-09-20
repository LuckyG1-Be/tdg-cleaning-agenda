import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const SeriesInput = z.object({
  customerId: z.string().nullable().optional(),
  title: z.string().max(180).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  startDate: z.string().regex(dateRe),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  rrule: z.string().max(1000).nullable().optional(),
  untilDate: z.string().regex(dateRe).nullable().optional(),
});

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function localDate(value: string) {
  return new Date(value + "T00:00:00");
}

export async function POST(req: Request) {
  try {
    const body = SeriesInput.parse(await req.json());

    if (minutes(body.endTime) <= minutes(body.startTime)) {
      return NextResponse.json(
        { ok: false, error: "De eindtijd moet na de starttijd liggen." },
        { status: 400 }
      );
    }

    const startDate = localDate(body.startDate);
    const untilDate = body.untilDate ? localDate(body.untilDate) : null;
    if (untilDate && untilDate < startDate) {
      return NextResponse.json(
        { ok: false, error: "De einddatum van de reeks kan niet vóór de startdatum liggen." },
        { status: 400 }
      );
    }

    if (body.customerId) {
      const exists = await prisma.customer.findUnique({
        where: { id: body.customerId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 400 });
      }
    }

    const item = await prisma.appointmentSeries.create({
      data: {
        customerId: body.customerId ?? null,
        title: body.title?.trim() || null,
        description: body.description?.trim() || null,
        notes: body.notes?.trim() || null,
        startDate,
        startTime: body.startTime,
        endTime: body.endTime,
        rrule: body.rrule?.trim() || null,
        untilDate,
        timezone: "Europe/Brussels",
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Controleer datum, tijd en ingevoerde gegevens." },
        { status: 400 }
      );
    }
    console.error("create series failed", e);
    return NextResponse.json(
      { ok: false, error: "De afspraak kon niet worden opgeslagen." },
      { status: 500 }
    );
  }
}
