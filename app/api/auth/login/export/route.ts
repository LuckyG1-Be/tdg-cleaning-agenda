import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { gzipSync } from "zlib";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const EXPECTED = "76c8c1a72203aa8880a5c16539323753a3c9c604f8d05884c7d4fe840e4308bf";
const SOURCE_COMMIT = "6e3417e375c4a3169cbfb05de36fb2292b40477f";

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

  const format = url.searchParams.get("format") || "meta";

  if (format === "db-gzip-base64") {
    const [customers, appointmentSeries, appointmentExceptions] = await Promise.all([
      prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appointmentSeries.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appointmentException.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    const payload = {
      exportedAt: "2026-09-20T17:50:00.000Z",
      schemaVersion: "tdg-cleaning-agenda-prisma-20260303",
      sourceCommit: SOURCE_COMMIT,
      counts: {
        customers: customers.length,
        appointmentSeries: appointmentSeries.length,
        appointmentExceptions: appointmentExceptions.length,
      },
      customers,
      appointmentSeries,
      appointmentExceptions,
    };
    const encoded = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"), { level: 9 }).toString("base64");
    return new NextResponse(encoded, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, max-age=0" },
    });
  }

  if (format === "db-json") {
    const [customers, appointmentSeries, appointmentExceptions] = await Promise.all([
      prisma.customer.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appointmentSeries.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.appointmentException.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    return NextResponse.json({
      exportedAt: "2026-09-20T17:50:00.000Z",
      schemaVersion: "tdg-cleaning-agenda-prisma-20260303",
      sourceCommit: SOURCE_COMMIT,
      counts: {
        customers: customers.length,
        appointmentSeries: appointmentSeries.length,
        appointmentExceptions: appointmentExceptions.length,
      },
      customers,
      appointmentSeries,
      appointmentExceptions,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  if (format === "source-zip-base64") {
    const sourceUrl = `https://codeload.github.com/LuckyG1-Be/tdg-cleaning-agenda/zip/${SOURCE_COMMIT}`;
    const source = await fetch(sourceUrl, { cache: "no-store" });
    if (!source.ok) return new NextResponse("Source fetch failed", { status: 502 });
    const bytes = Buffer.from(await source.arrayBuffer());
    return new NextResponse(bytes.toString("base64"), {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, max-age=0" },
    });
  }

  const [customers, appointmentSeries, appointmentExceptions] = await Promise.all([
    prisma.customer.count(),
    prisma.appointmentSeries.count(),
    prisma.appointmentException.count(),
  ]);
  return NextResponse.json({
    exportedAt: "2026-09-20T17:50:00.000Z",
    schemaVersion: "tdg-cleaning-agenda-prisma-20260303",
    sourceCommit: SOURCE_COMMIT,
    counts: { customers, appointmentSeries, appointmentExceptions },
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
