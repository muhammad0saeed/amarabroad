import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Ask for a new one.",
  browser: "Open the sign-in link in the same browser where you asked for it, or ask for a new link here and open it in this browser.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin/");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-title font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-meta text-ink-muted">We email you a sign-in link. No password. Only addresses on the admin list get one.</p>
      {error && (
        <p role="alert" className="mt-4 rounded-tile bg-danger-soft p-3 text-meta font-semibold text-danger">
          {ERRORS[error] ?? ERRORS.link}
        </p>
      )}
      <LoginForm />
    </div>
  );
}
