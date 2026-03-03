import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CustomerInput = z.object({
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  box: z.string().optional().nullable(),
  postal: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  vat: z.string().optional().nullable(),
  type: z.enum(["PRIVATE","BUSINESS"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  defaultRecurrence: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { company: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
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
}

export async function POST(req: Request) {
  const data = CustomerInput.parse(await req.json());
  const created = await prisma.customer.create({ data: data as any });
  return NextResponse.json({ ok: true, item: created });
}
