'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import '../pipeline/pipeline.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Already signed in? Don't make them do it twice.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.href = '/pipeline';
    });
  }, []);

  async function signIn() {
    if (!email.trim() || !password) { setErr('Enter your email and password.'); return; }
    setBusy(true); setErr('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setBusy(false);
      setErr(
        error.message.toLowerCase().includes('invalid')
          ? 'That email and password combination was not recognised.'
          : error.message
      );
      return;
    }
    window.location.href = '/pipeline';
  }

  return (
    <div className="pl pl-login">
      <div className="pl-login-card">
        <h1>Anupam Paints</h1>
        <p className="pl-login-sub">Sales pipeline</p>

        <div className="fld">
          <label htmlFor="em">Email</label>
          <input id="em" type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && signIn()} />
        </div>

        <div className="fld">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && signIn()} />
        </div>

        {err && <div className="pl-note stop">{err}</div>}

        <button className="btn btn-primary" style={{ width: '100%', padding: 11 }}
                onClick={signIn} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="pl-login-foot">
          Forgotten your password? Ask the office to reset it.
        </p>
      </div>
    </div>
  );
}
