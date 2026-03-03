import { NextResponse } from "next/server";
import { signSession, setSessionCookie, verifyLogin } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const ok = await verifyLogin(body.username, body.password);
    if (!ok) return NextResponse.json({ ok: false, error: "Ongeldige login" }, { status: 401 });

    const token = signSession();
    setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error" }, { status: 400 });
  }
}
