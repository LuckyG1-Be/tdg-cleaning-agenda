import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CustomerPatch = z.object({
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

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const item = await prisma.customer.findUnique({ where: { id: ctx.params.id } });
  if (!item) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const data = CustomerPatch.parse(await req.json());
  const item = await prisma.customer.update({ where: { id: ctx.params.id }, data: data as any });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await prisma.customer.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
