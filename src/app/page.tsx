import { redirect } from "next/navigation";
import { safeAuth } from "@/auth";

export default async function HomePage() {
  const session = await safeAuth();
  redirect(session?.user ? "/chat" : "/login");
}
