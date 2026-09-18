import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, getDb } from "./db";
import type { Role } from "./constants";

export type SessionUser = { id: string; name: string; email: string; role: Role };

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await getDb();
        const user = db
          .prepare(`SELECT id, name, email, password_hash, role, active FROM users WHERE email = ?`)
          .get(credentials.email) as
          | { id: string; name: string; email: string; password_hash: string; role: string; active: number }
          | undefined;
        if (!user || !user.active) return null;
        const ok = bcrypt.compareSync(credentials.password, user.password_hash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    }
  }
};

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function canManageFinance(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canEnterTransactions(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}
