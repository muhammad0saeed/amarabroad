import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin/");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-title font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-meta text-ink-muted">We email you a sign-in link. No password. Only addresses on the admin list get one.</p>
      {error && (
        <p role="alert" className="mt-4 rounded-tile bg-danger-soft p-3 text-meta font-semibold text-danger">
          {error === "link" ? "That sign-in link has expired or was already used. Ask for a new one." : "You're signed in, but this email isn't on the admin list."}
        </p>
      )}
      <LoginForm />
    </div>
  );
}
