import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const clean = (max: number) => z.string().trim().max(max).optional().nullable();
const CustomerInput = z.object({
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { postal: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

    const items = await prisma.customer.findMany({
      where,
      orderBy: [{ company: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("customers list failed", e);
    return NextResponse.json({ ok: false, error: "Klanten konden niet worden geladen." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parsed = CustomerInput.parse(await req.json());
    const data = normalize(parsed);
    if (!data.company && !data.firstName && !data.lastName) {
      return NextResponse.json(
        { ok: false, error: "Vul minstens een bedrijfsnaam, voornaam of achternaam in." },
        { status: 400 }
      );
    }

    const created = await prisma.customer.create({ data: data as any });
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Controleer de klantgegevens." }, { status: 400 });
    }
    console.error("customer create failed", e);
    return NextResponse.json({ ok: false, error: "De klant kon niet worden aangemaakt." }, { status: 500 });
  }
}
