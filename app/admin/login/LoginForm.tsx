"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, { status: "idle" });
  if (state.status === "sent") {
    return (
      <p role="status" className="mt-6 rounded-tile bg-success-soft p-4 text-meta text-success">
        <strong className="block">Check your email.</strong>
        If this address is on the admin list, a sign-in link is on its way. It works once and expires within an hour.
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3">
      <label htmlFor="email" className="block text-meta font-semibold">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="block min-h-tap w-full rounded-tile border border-border bg-surface px-3 focus:border-accent focus:outline-none"
      />
      {state.status === "error" && <p className="text-meta font-semibold text-danger">{state.message}</p>}
      <button disabled={pending} className="inline-flex min-h-tap w-full items-center justify-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
