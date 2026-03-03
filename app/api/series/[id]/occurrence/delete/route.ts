import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
  date: z.string(), // YYYY-MM-DD
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { date } = Body.parse(await req.json());
  const d = new Date(date + "T00:00:00");

  const ex = await prisma.appointmentException.upsert({
    where: { seriesId_date: { seriesId: ctx.params.id, date: d } },
    create: { seriesId: ctx.params.id, date: d, isDeleted: true },
    update: { isDeleted: true },
  });

  return NextResponse.json({ ok: true, exception: ex });
}
