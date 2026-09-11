import { redirect } from "next/navigation";
import Link from "next/link";
import { safeAuth, signOut } from "@/auth";
import { sessionUserStillExists } from "@/lib/auth/requireUser";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  // A stateless JWT can outlive the user row it points to (e.g. after a
  // re-seed). Catch it here, once, before any page underneath calls
  // requireUser() and throws mid-render.
  if (!(await sessionUserStillExists(session.user.id))) redirect("/login");

  const { user } = session;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-base font-bold text-slate-900">ZEN Knowledge</span>
            <nav className="flex gap-4 text-sm font-medium text-slate-600">
              <Link href="/chat" className="hover:text-indigo-600">
                Assistant
              </Link>
              <Link href="/documents" className="hover:text-indigo-600">
                Bibliothèque
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="hover:text-indigo-600">
                  Administration
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              {user.name} · {user.role === "ADMIN" ? "Admin" : "Membre"}
              {user.department ? ` · ${user.department}` : ""}
            </span>
            {!user.companyId && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Aucune société
              </span>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="hover:text-indigo-600">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {!user.companyId ? <NoCompanyNotice /> : children}
      </main>
    </div>
  );
}

function NoCompanyNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <h2 className="font-semibold">Aucune société associée à votre compte</h2>
      <p className="mt-1 text-sm">
        Votre compte n&apos;est rattaché à aucune société ZEN Group, vous n&apos;avez donc accès
        à aucun document. Contactez un administrateur pour faire rattacher votre compte.
      </p>
    </div>
  );
}
