import React, { useState } from 'react';
import { Activity, ShieldCheck, Radio } from 'lucide-react';
import { publicApi } from '../api';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;

    setErr('');
    setMsg('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await publicApi('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            username: username.trim(),
            password,
            name: name.trim(),
          }),
        });

        setMode('login');
        setPassword('');
        setMsg('회원가입이 완료되었습니다. 로그인해 주세요.');
        return;
      }

      const data = await publicApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      // 토큰 저장과 화면 전환을 App에서 한 번에 처리
      onLogin(data.access_token, data.user);
    } catch (error) {
      setErr(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode() {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setErr('');
    setMsg('');
    setPassword('');
  }

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div className="brand-mark"><Radio size={24}/> KBU Monitor</div>
        <h1>교실과 실습실의<br/>환경 상태를 빠르게 파악하세요.</h1>
        <p>실시간 센서 · 이상치 감지 · AI 위험도 분석</p>
        <div className="feature-row">
          <span><Activity/> 실시간 관제</span>
          <span><ShieldCheck/> 시스템 이상 감지</span>
        </div>
      </section>

      <section className="login-panel">
        <form onSubmit={submit} className="auth-card">
          <h2>{mode === 'login' ? '로그인' : '관리자 등록'}</h2>
          <p>실내환경 AI 모니터링 콘솔</p>

          {mode === 'signup' && (
            <label>
              이름
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}

          <label>
            ID
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>

          {msg && <div className="success">{msg}</div>}
          {err && <div className="error">{err}</div>}

          <button disabled={submitting}>
            {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
          <button type="button" className="ghost" onClick={changeMode} disabled={submitting}>
            {mode === 'login' ? '회원가입' : '로그인으로'}
          </button>
        </form>
      </section>
    </div>
  );
}
