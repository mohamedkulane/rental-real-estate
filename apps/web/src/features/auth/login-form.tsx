'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, clearApiCache, isServiceUnavailable, userFacingError } from '@/lib/phase3-api';
import { BrandMark } from '@/components/shared/ui';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);
  const [readinessCycle, setReadinessCycle] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function checkReadiness() {
      try {
        await api('/readiness', { cache: 'no-store' });
        if (active) setServiceReady(true);
      } catch {
        if (!active) return;
        setServiceReady(false);
        retryTimer = setTimeout(() => void checkReadiness(), 1000);
      }
    }

    void checkReadiness();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [readinessCycle]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceReady) return;
    setBusy(true);
    setError('');
    const values = new FormData(event.currentTarget);

    try {
      await api<{ expiresAt: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: values.get('email'), password: values.get('password') }),
      });
      clearApiCache();
      router.replace('/admin');
    } catch (cause) {
      const message =
        cause instanceof Error && 'status' in cause && cause.status === 401
          ? 'The email or password was not accepted.'
          : userFacingError(cause, 'We could not sign you in. Please try again.');
      if (isServiceUnavailable(cause)) {
        setServiceReady(false);
        setReadinessCycle((cycle) => cycle + 1);
      }
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={(event) => void submit(event)}>
      <div className="preparation-brand auth-brand">
        <BrandMark />
        <div>
          <strong>Rental Operations</strong>
          <span>Secure staff workspace</span>
        </div>
      </div>
      <div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your company and assigned branches.</p>
      </div>
      <label>
        Email address
        <span className="input-with-icon">
          <Mail aria-hidden="true" />
          <input name="email" type="email" autoComplete="username" required />
        </span>
      </label>
      <label>
        Password
        <span className="input-with-icon">
          <LockKeyhole aria-hidden="true" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            required
          />
        </span>
      </label>
      {!serviceReady ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-blue-600 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>Preparing secure sign-in. This page will reconnect automatically.</span>
        </div>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" disabled={busy || !serviceReady} aria-busy={busy}>
        {busy ? 'Signing in...' : serviceReady ? 'Sign in' : 'Preparing sign in...'}
      </button>
    </form>
  );
}
