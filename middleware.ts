import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const COOKIE_NAME = "tdg_session";

function b64urlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function decodePayload(value: string) {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(value)));
  } catch {
    return null;
  }
}

async function validSession(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(signature), data);
  if (!ok) return false;

  const body = decodePayload(payload);
  if (!body || body.sub !== "admin") return false;
  if (typeof body.exp === "number" && body.exp * 1000 <= Date.now()) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await validSession(token))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (!pathname.startsWith("/api/")) url.searchParams.set("next", pathname);
    return pathname.startsWith("/api/")
      ? NextResponse.json({ ok: false, error: "Niet aangemeld" }, { status: 401 })
      : NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
