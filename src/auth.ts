import NextAuth, { AuthError, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          department: user.department,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as "ADMIN" | "MEMBER";
        token.companyId = (user.companyId as string | null) ?? null;
        token.department = (user.department as string | null) ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "ADMIN" | "MEMBER";
      session.user.companyId = token.companyId as string | null;
      session.user.department = token.department as string | null;
      return session;
    },
  },
});

/** auth() throws (not just returns null) when the session cookie can't be
 * decrypted with the current AUTH_SECRET — e.g. the secret was rotated while
 * a browser still held an old cookie. That's still "no session", not a
 * server error: treat it as such everywhere auth() is read.
 *
 * Only catch next-auth's own AuthError subclasses — never a blanket catch.
 * auth() also calls Next's cookies()/headers() internally, and during
 * `next build`'s static-generation pass Next signals "this route needs
 * request data, render it dynamically" by throwing its own internal error;
 * swallowing that too tricks Next into thinking the route is static, and the
 * build then fails for real when it tries to prerender a page that requires
 * a session. */
export async function safeAuth(): Promise<Session | null> {
  try {
    return await auth();
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}
