/**
 * SmartPark - watchman login.
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../services/auth.jsx';
import { api } from '../services/api.js';
import { Alert, Spinner } from '../components/ui.jsx';
import {
  IconRadar,
  IconUser,
  IconShield,
  IconZap,
  IconNavigation,
  IconCamera,
  IconArrowRight,
} from '../data/icons.jsx';

const FEATURES = [
  { icon: <IconCamera size={16} />, title: 'ANPR at the gate', text: 'Camera → detection → OCR → validated number plate.' },
  { icon: <IconZap size={16} />, title: 'Automatic slot assignment', text: 'The nearest free bay to the gate is reserved instantly.' },
  { icon: <IconNavigation size={16} />, title: 'Indoor navigation', text: 'A* routing from the watchman room to any of the 48 bays.' },
];

export default function Login() {
  const { login, isAuthenticated, checking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('watchman');
  const [password, setPassword] = useState('watch123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api
      .demoAccounts()
      .then((res) => setAccounts(res.accounts || []))
      .catch(() => setAccounts([]));
  }, []);

  if (!checking && isAuthenticated) {
    return <Navigate to={location.state?.from || '/dashboard'} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-art">
        <div className="row" style={{ gap: 12 }}>
          <span className="brand-mark" style={{ width: 44, height: 44 }}>
            <IconRadar size={24} />
          </span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>SmartPark</div>
            <div className="brand-sub">ANPR Control Room</div>
          </div>
        </div>

        <div>
          <h2>Find any parked car in seconds.</h2>
          <p>
            Sunrise Apartments runs a 48-bay parking campus across four blocks. SmartPark reads the
            number plate at the gate, allocates the closest free bay and lets the watchman guide
            residents to their car with turn-by-turn directions.
          </p>

          <div className="feature-list">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <span className="fi">{f.icon}</span>
                <div>
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="row-wrap tiny muted">
          <span className="badge badge-mute">48 bays</span>
          <span className="badge badge-mute">4 blocks</span>
          <span className="badge badge-mute">A* pathfinding</span>
          <span className="badge badge-mute">OCR / ANPR</span>
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-card">
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <IconShield size={20} style={{ color: 'var(--brand-2)' }} />
            <span className="brand-sub">Watchman / Security Console</span>
          </div>
          <h1>Sign in to SmartPark</h1>
          <p className="login-sub">Use your watchman credentials to open the control room.</p>

          <form onSubmit={onSubmit} className="stack mt-3" style={{ gap: 14 }}>
            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="field">
              <label htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-mute)' }}>
                  <IconUser size={16} />
                </span>
                <input
                  id="username"
                  className="input"
                  style={{ paddingLeft: 38 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? 'Signing in' : 'Login'}
              {!busy ? <IconArrowRight size={17} /> : null}
            </button>
          </form>

          {accounts.length ? (
            <div className="demo-accounts">
              <div className="tiny muted">Demo accounts — tap to fill</div>
              {accounts.map((acc) => (
                <button
                  type="button"
                  key={acc.username}
                  className="demo-account"
                  onClick={() => {
                    setUsername(acc.username);
                    setPassword(acc.password);
                  }}
                >
                  <span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                    {acc.name.slice(0, 1)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="small strong">
                      {acc.username} <span className="muted">/ {acc.password}</span>
                    </div>
                    <div className="tiny muted truncate">{acc.name}</div>
                  </div>
                  <span className="badge badge-brand">{acc.role}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
