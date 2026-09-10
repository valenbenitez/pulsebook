"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useActionState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");

      if (!email || !password) {
        return "Completá email y contraseña.";
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        return "Email o contraseña incorrectos.";
      }

      router.push("/dashboard");
      router.refresh();
      return null;
    },
    null,
  );

  return (
    <div className="rounded-xl bg-surface p-8 shadow-card">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Entrar a PulseBook
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Accedé al dashboard de tu negocio.
        </p>
      </div>

      <form action={submitAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-[0.8125rem] font-medium text-ink-muted"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 rounded-md border border-border bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-subtle"
            placeholder="vos@estudio.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-[0.8125rem] font-medium text-ink-muted"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            className="h-11 rounded-md border border-border bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-subtle"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 h-11 rounded-pill bg-ink px-[18px] text-[0.8125rem] font-medium text-inverse transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        ¿No tenés cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
