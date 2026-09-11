import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sessionUserStillExists } from "@/lib/auth/requireUser";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  // Must also check the user row still exists: a stale session (deleted user
  // id, e.g. after a re-seed) would otherwise bounce here -> /chat -> back
  // here forever, since /chat's layout redirects on the same stale session.
  if (session?.user && (await sessionUserStillExists(session.user.id))) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">ZEN Knowledge</h1>
          <p className="mt-1 text-sm text-slate-500">
            Recherche documentaire interne — ZEN Group
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
