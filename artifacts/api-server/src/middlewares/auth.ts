import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
};

export function getCurrentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new Error("Authenticated user id is missing");
  return userId;
}

export function hasAnyRole(req: Request, allowedRoles: string[]): boolean {
  const claims = getAuth(req).sessionClaims as Record<string, unknown> | null;
  const publicMetadata = (claims?.public_metadata ?? claims?.publicMetadata) as
    | Record<string, unknown>
    | undefined;
  const metadata = claims?.metadata as Record<string, unknown> | undefined;
  const role = publicMetadata?.role ?? metadata?.role ?? claims?.role;
  return typeof role === "string" && allowedRoles.includes(role);
}

export const requireRole =
  (...allowedRoles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    if (!hasAnyRole(req, allowedRoles)) {
      res.status(403).json({ error: "This account does not have permission." });
      return;
    }
    next();
  };
