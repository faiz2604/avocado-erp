import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, persistDb } from "@/lib/db";
import type { Role } from "@/lib/constants";

export async function requireUser(): Promise<{ id: string; name: string; email: string; role: Role }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  return session.user as any;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("Anda tidak memiliki akses untuk aksi ini.");
  return user;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function wrap<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    await getDb();
    const data = await fn();
    await persistDb();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Terjadi kesalahan." };
  }
}
