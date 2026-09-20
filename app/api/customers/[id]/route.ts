import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const clean = (max: number) => z.string().trim().max(max).optional().nullable();
const CustomerPatch = z.object({
  firstName: clean(120),
  lastName: clean(120),
  company: clean(180),
  street: clean(180),
  number: clean(40),
  box: clean(40),
  postal: clean(40),
  city: clean(120),
  country: clean(120),
  email: clean(180),
  phone: clean(80),
  vat: clean(80),
  type: z.enum(["PRIVATE", "BUSINESS"]).optional().nullable(),
  notes: clean(5000),
  defaultRecurrence: clean(120),
});

function normalize<T extends Record<string, any>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, typeof value === "string" && !value.trim() ? null : value])
  );
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const item = await prisma.customer.findUnique({
    where: { id: ctx.params.id },
    include: { _count: { select: { series: true } } },
  });
  if (!item) return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const parsed = CustomerPatch.parse(await req.json());
    const data = normalize(parsed);
    if (!data.company && !data.firstName && !data.lastName) {
      return NextResponse.json(
        { ok: false, error: "Vul minstens een bedrijfsnaam, voornaam of achternaam in." },
        { status: 400 }
      );
    }
    const item = await prisma.customer.update({ where: { id: ctx.params.id }, data: data as any });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Controleer de klantgegevens." }, { status: 400 });
    }
    console.error("customer update failed", e);
    return NextResponse.json({ ok: false, error: "De klant kon niet worden opgeslagen." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const count = await prisma.appointmentSeries.count({ where: { customerId: ctx.params.id } });
    if (count > 0) {
      return NextResponse.json(
        { ok: false, error: `Deze klant is gekoppeld aan ${count} afspraak${count === 1 ? "" : "reeksen"}. Verwijderen is daarom geblokkeerd.` },
        { status: 409 }
      );
    }
    await prisma.customer.delete({ where: { id: ctx.params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("customer delete failed", e);
    return NextResponse.json({ ok: false, error: "De klant kon niet worden verwijderd." }, { status: 500 });
  }
}
