import React, { useEffect, useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { authApi } from './api';
import { PUBLIC_DEMO } from './deployment';

export default function App() {
  if (PUBLIC_DEMO) return <Dashboard token="public-demo" user={{ name: "시연 방문자", role: "demo" }} onLogout={() => {}} />;
  return <ConnectedApp />;
}

function ConnectedApp() {
  const [session, setSession] = useState(() => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }));
  const [checking, setChecking] = useState(Boolean(session.token));

  function login(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user || {}));
    setSession({ token, user: user || {} });
    setChecking(false);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession({ token: '', user: null });
    setChecking(false);
  }

  useEffect(() => {
    if (!session.token) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    authApi('/api/me', session.token)
      .then((user) => {
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(user || {}));
        setSession((prev) => ({ ...prev, user }));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 401) logout();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session.token]);

  if (checking) {
    return (
      <div className="boot-screen">
        <div className="boot-card">세션 확인 중...</div>
      </div>
    );
  }

  if (!session.token) {
    return <Login onLogin={login} />;
  }

  return (
    <Dashboard
      token={session.token}
      user={session.user}
      onLogout={logout}
    />
  );
}
