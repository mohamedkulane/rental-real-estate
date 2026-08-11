'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, clearApiCache, userFacingError } from '@/lib/phase3-api';
import { BrandMark } from '@/components/shared/ui';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" disabled={busy} aria-busy={busy}>
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
