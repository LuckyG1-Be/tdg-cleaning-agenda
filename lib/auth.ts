import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "tdg_session";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function getAdminUsername() {
  return mustEnv("ADMIN_USERNAME");
}

export function getAdminPasswordHash() {
  return mustEnv("ADMIN_PASSWORD_HASH");
}

export function getJwtSecret() {
  return mustEnv("JWT_SECRET");
}

export function signSession() {
  const token = jwt.sign({ sub: "admin" }, getJwtSecret(), { expiresIn: "30d" });
  return token;
}

export function verifySessionToken(token: string) {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string") return null;
  if ((payload as any)?.sub !== "admin") return null;
  return payload;
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function isAuthedFromRequest(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    return !!verifySessionToken(token);
  } catch {
    return false;
  }
}

export async function verifyLogin(username: string, password: string) {
  if (username !== getAdminUsername()) return false;
  return bcrypt.compare(password, getAdminPasswordHash());
}
