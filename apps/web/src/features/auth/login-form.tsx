'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE, api, clearApiCache, isServiceUnavailable, userFacingError } from '@/lib/phase3-api';
import { BrandMark } from '@/components/shared/ui';

type BackendStatus = 'checking' | 'online' | 'offline';

const HEALTH_TIMEOUT_MS = 2500;
const RETRY_DELAYS_MS = [400, 800, 1500, 2500];

async function pingBackendHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/health`, {
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [healthCycle, setHealthCycle] = useState(0);

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    let attempt = 0;

    async function checkHealth() {
      const online = await pingBackendHealth();
      if (!active) return;

      if (online) {
        setBackendStatus('online');
        return;
      }

      setBackendStatus('offline');
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
      attempt += 1;
      retryTimer = window.setTimeout(() => void checkHealth(), delay);
    }

    void checkHealth();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [healthCycle]);

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
      setBackendStatus('online');
      router.replace('/admin');
    } catch (cause) {
      const message =
        cause instanceof Error && 'status' in cause && cause.status === 401
          ? 'The email or password was not accepted.'
          : userFacingError(cause, 'We could not sign you in. Please try again.');
      if (isServiceUnavailable(cause)) {
        setBackendStatus('offline');
        setHealthCycle((cycle) => cycle + 1);
      } else if (backendStatus === 'offline') {
        setBackendStatus('online');
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
      {backendStatus === 'checking' ? (
        <p className="auth-status auth-status-checking" role="status" aria-live="polite">
          Checking connection...
        </p>
      ) : null}
      {backendStatus === 'offline' ? (
        <p className="auth-status auth-status-offline" role="status" aria-live="polite">
          The service is starting or temporarily unavailable. You can still try signing in.
        </p>
      ) : null}
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
