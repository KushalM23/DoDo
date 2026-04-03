import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/common/AppIcon";
import { useAlert } from "@/providers/AlertContext";
import { useAuth } from "@/providers/AuthContext";
import { sanitizeRedirectPath } from "@/utils/navigation";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="pl-4 text-[11px] font-sans-bold uppercase tracking-[0.22em] text-muted-text">
      {children}
    </span>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();
  const { signIn, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const from = sanitizeRedirectPath(searchParams.get("from"), "/tasks");
  const isLogin = mode === "login";
  const title = isLogin ? "Sign In" : "Create Account";
  const submitLabel = isLogin ? "Sign In" : "Create Account";
  const busyLabel = isLogin ? "Signing in..." : "Creating...";
  const secondaryHref = `${
    isLogin ? "/register" : "/login"
  }?from=${encodeURIComponent(from)}`;
  const secondaryLabel = isLogin ? "Create account" : "Already have an account";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!isLogin && !name.trim()) {
      showAlert("Name required", "Please enter your name.");
      return;
    }

    setBusy(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
      router.replace(from);
    } catch (error) {
      showAlert(
        isLogin ? "Login failed" : "Registration failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background">
      <div className="mx-auto grid h-[100dvh] w-full max-w-[460px] content-center px-6 py-8 sm:px-8">
        <div className="grid w-full gap-10">
          <div className="grid gap-2">
            <h1 className="m-0 font-display text-[42px] tracking-[-0.6px] text-text sm:text-[46px]">
              {title}
            </h1>
          </div>

          <form className="grid gap-4" onSubmit={onSubmit}>
            {!isLogin ? (
              <label className="grid gap-2">
                <FieldLabel>Your Name</FieldLabel>
                <span className="flex items-center rounded-full bg-surface-light px-5">
                  <input
                    className="h-12.5 flex-1 rounded-full border-0 bg-transparent px-2 font-sans-bold text-base text-text placeholder:text-muted-text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Alex"
                    autoComplete="name"
                  />
                </span>
              </label>
            ) : null}

            <label className="grid gap-2">
              <FieldLabel>Email</FieldLabel>
              <span className="flex items-center rounded-full bg-surface-light px-5">
                <input
                  className="h-12.5 flex-1 rounded-full border-0 bg-transparent px-2 font-sans-bold text-base text-text placeholder:text-muted-text"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  type="email"
                />
              </span>
            </label>

            <label className="grid gap-2">
              <FieldLabel>Password</FieldLabel>
              <span className="flex items-center gap-2 rounded-full bg-surface-light px-5 pr-2">
                <input
                  className="h-12.5 rounded-full flex-1 border-0 bg-transparent px-2 font-sans-bold text-base text-text placeholder:text-muted-text"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    isLogin ? "Enter your password" : "Create a password"
                  }
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />

                <button
                  type="button"
                  className="inline-grid h-8 w-8 place-items-center rounded-full text-text"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <AppIcon
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color="var(--accent)"
                  />
                </button>
              </span>
            </label>

            <button
              type="submit"
              className="mt-2 inline-flex min-h-13 items-center justify-center rounded-full bg-accent px-6 font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none"
              disabled={busy}
            >
              {busy ? busyLabel : submitLabel}
            </button>
          </form>

          <Link
            className="inline-flex min-h-13 items-center justify-center gap-2 font-sans-semibold text-text"
            href={secondaryHref}
          >
            <span>{secondaryLabel}</span>
            <AppIcon
              name={isLogin ? "chevron-right" : "chevron-left"}
              size={18}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
