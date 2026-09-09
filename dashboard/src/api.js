import { PUBLIC_DEMO } from './deployment';
const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function publicApi(path, options = {}) {
  if (PUBLIC_DEMO) throw new Error('공개 시연에서는 실제 서버 연결을 사용하지 않습니다.');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    const error = new Error(data.detail || '요청에 실패했습니다.');
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function authApi(path, token, options = {}) {
  if (!token) {
    const error = new Error('로그인이 필요합니다.');
    error.status = 401;
    throw error;
  }

  if (PUBLIC_DEMO) throw new Error('공개 시연에서는 실제 서버 연결을 사용하지 않습니다.');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    const error = new Error(
      data.detail ||
      (res.status === 401 ? '세션이 만료되었습니다.' : '요청에 실패했습니다.')
    );
    error.status = res.status;
    throw error;
  }

  return data;
}

export async function demoAi(deviceId) {
  const base = import.meta.env.VITE_DEMO_AI_URL || `${import.meta.env.BASE_URL}api/demo-ai`;
  const res = await fetch(`${base}/${encodeURIComponent(deviceId)}`, { signal: AbortSignal.timeout(40000) });
  const data = await parseResponse(res);
  if (!res.ok) throw new Error(data.detail || 'AI 설명 요청에 실패했습니다.');
  return data;
}
