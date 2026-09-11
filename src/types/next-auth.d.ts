import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "MEMBER";
    companyId: string | null;
    department: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      companyId: string | null;
      department: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "MEMBER";
    companyId: string | null;
    department: string | null;
  }
}
