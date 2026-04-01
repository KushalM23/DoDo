import React, {useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {cx, tw} from '@/lib/tw';
import {useAlert} from '@/providers/AlertContext';
import {useAuth} from '@/providers/AuthContext';

export function AuthScreen({mode}: {mode: 'login' | 'register'}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {showAlert} = useAlert();
  const {signIn, signUp} = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const title = mode === 'login' ? 'Sign In' : 'Create Account';
  const actionLabel = mode === 'login' ? 'Sign In' : 'Create Account';
  const from = searchParams.get('from') ?? '/tasks';
  const secondaryBaseHref = mode === 'login' ? '/register' : '/login';
  const secondaryHref = `${secondaryBaseHref}?from=${encodeURIComponent(from)}`;
  const secondaryLabel =
    mode === 'login' ? 'Create account' : 'Already have an account';

  const heroLines = useMemo(
    () =>
      mode === 'login'
        ? ['Tasks, habits, notes, and focus mode.', 'Same DoDo system, redesigned for desktop.']
        : ['Build your DoDo workspace on the web.', 'Everything syncs to the same backend as mobile.'],
    [mode],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === 'register' && !name.trim()) {
      showAlert('Name required', 'Please enter your name.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
      router.replace(from);
    } catch (error) {
      showAlert(
        mode === 'login' ? 'Login failed' : 'Registration failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 place-items-center gap-10 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
      <div className="w-full">
        <button type="button" className={cx(tw.brand, 'cursor-default')}>
          <img src="/dodo-icon.png" alt="" className="h-[34px] w-[34px] rounded-[10px]" />
          <span className={tw.brandText}>DODO</span>
        </button>
        <div className="mt-7 grid gap-2.5">
          <h1 className={tw.h1}>{title}</h1>
          {heroLines.map(line => (
            <p key={line} className={tw.muted}>{line}</p>
          ))}
        </div>
      </div>

      <form className={cx(tw.panel, 'grid w-full gap-[18px]')} onSubmit={onSubmit}>
        <div className="grid gap-2.5">
          <h2 className={tw.h2}>{title}</h2>
          <p className={tw.muted}>{mode === 'login' ? 'Welcome back.' : 'Start planning on a larger canvas.'}</p>
        </div>

        {mode === 'register' ? (
          <label className={tw.fieldWrap}>
            <span className={tw.fieldLabel}>Your Name</span>
            <input
              className={tw.fieldInput}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Alex"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className={tw.fieldWrap}>
          <span className={tw.fieldLabel}>Email</span>
          <input
            className={tw.fieldInput}
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className={tw.fieldWrap}>
          <span className={tw.fieldLabel}>Password</span>
          <div className="flex items-center gap-2 rounded-[18px] border border-border bg-surface-light pr-2">
            <input
              className="min-h-[46px] flex-1 border-0 bg-transparent px-4 text-text outline-none"
              ref={passwordRef}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className={tw.iconBtn}
              onClick={() => setShowPassword(value => !value)}>
              <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={18} color="var(--accent)" />
            </button>
          </div>
        </label>

        <button type="submit" className={cx(tw.action, tw.actionAccent, 'w-full')} disabled={busy}>
          {busy ? (mode === 'login' ? 'Signing in...' : 'Creating...') : actionLabel}
        </button>

        <Link className="inline-flex min-h-12 items-center justify-center gap-2" href={secondaryHref}>
          <span>{secondaryLabel}</span>
          <AppIcon
            name={mode === 'login' ? 'chevron-right' : 'chevron-left'}
            size={18}
          />
        </Link>
      </form>
    </div>
  );
}

