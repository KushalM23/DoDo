import React, {useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
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
    <div className="auth-page">
      <div className="auth-hero">
        <button type="button" className="brand-mark static">
          <img src="/dodo-icon.png" alt="" />
          <span>DODO</span>
        </button>
        <div className="auth-copy">
          <h1>{title}</h1>
          {heroLines.map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-card-header">
          <h2>{title}</h2>
          <p>{mode === 'login' ? 'Welcome back.' : 'Start planning on a larger canvas.'}</p>
        </div>

        {mode === 'register' ? (
          <label className="field">
            <span>Your Name</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Alex"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <div className="field-inline">
            <input
              ref={passwordRef}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="icon-button subtle"
              onClick={() => setShowPassword(value => !value)}>
              <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={18} color="var(--accent)" />
            </button>
          </div>
        </label>

        <button type="submit" className="action-pill accent wide" disabled={busy}>
          {busy ? (mode === 'login' ? 'Signing in...' : 'Creating...') : actionLabel}
        </button>

        <Link className="auth-secondary-link" href={secondaryHref}>
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
