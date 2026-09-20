import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const EXPECTED = "76c8c1a72203aa8880a5c16539323753a3c9c604f8d05884c7d4fe840e4308bf";

function validToken(token: string | null) {
  if (!token) return false;
  const actual = createHash("sha256").update(token).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(EXPECTED));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!validToken(url.searchParams.get("token"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const table = url.searchParams.get("table") || "meta";
  const skip = Math.max(0, Number(url.searchParams.get("skip") || "0") || 0);
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") || "40") || 40));

  if (table === "meta") {
    const [customers, appointmentSeries, appointmentExceptions] = await Promise.all([
      prisma.customer.count(),
      prisma.appointmentSeries.count(),
      prisma.appointmentException.count(),
    ]);
    return NextResponse.json({ exportedAt: new Date().toISOString(), schemaVersion: "tdg-cleaning-agenda-prisma-20260303", counts: { customers, appointmentSeries, appointmentExceptions } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  if (table === "customers") {
    const items = await prisma.customer.findMany({ orderBy: { createdAt: "asc" }, skip, take });
    return NextResponse.json({ table, skip, take, items }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  if (table === "series") {
    const items = await prisma.appointmentSeries.findMany({ orderBy: { createdAt: "asc" }, skip, take });
    return NextResponse.json({ table, skip, take, items }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  if (table === "exceptions") {
    const items = await prisma.appointmentException.findMany({ orderBy: { createdAt: "asc" }, skip, take });
    return NextResponse.json({ table, skip, take, items }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  return new NextResponse("Not found", { status: 404 });
}
