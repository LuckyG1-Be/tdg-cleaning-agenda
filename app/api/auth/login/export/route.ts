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

  const [customers, series, exceptions] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appointmentSeries.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appointmentException.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: "tdg-cleaning-agenda-prisma-20260303",
      counts: {
        customers: customers.length,
        appointmentSeries: series.length,
        appointmentExceptions: exceptions.length,
      },
      customers,
      appointmentSeries: series,
      appointmentExceptions: exceptions,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": 'attachment; filename="tdg-cleaning-db-export.json"',
      },
    }
  );
}
