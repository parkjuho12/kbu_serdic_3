import { PUBLIC_DEMO } from '../deployment';
import React, { useEffect, useState } from 'react';
import { Wind, Power, RefreshCw } from 'lucide-react';
import { authApi } from '../api';

const SPACES = [
  ['3F-LEFT', '3층 왼쪽 강의실'], ['3F-HALL', '3층 중앙 홀'], ['3F-RIGHT', '3층 오른쪽 강의실'],
  ['2F-LEFT', '2층 왼쪽 강의실'], ['2F-HALL', '2층 중앙 홀'], ['2F-RIGHT', '2층 오른쪽 강의실'],
];
const MODES = { COOL: '냉방', FAN: '송풍', POWER_OFF: '꺼짐', AIR_DRY: '제습', SKIP: '판단 보류' };
export default function HvacPanel({ token, user }) {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (PUBLIC_DEMO) {
      setRooms(SPACES.map(([room_id]) => ({ room_id, hasAC: false })));
      setError('');
      return;
    }
    let active = true;
    setRooms(null); setError('');
    authApi('/api/rooms', token).then(data => {
      if (!Array.isArray(data)) throw new Error('공간 응답 형식을 확인하세요.');
      if (active) setRooms(data);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token, revision]);
  return <section className="hvac-panel" aria-label="공간 HVAC 제어">
    <header><div><Wind size={18}/><b>공간 HVAC 제어</b><span>{PUBLIC_DEMO ? '전체 장치 모의 제어 · 실제 에어컨 연결 없음' : '실제 연결 장치 · 나머지는 더미 시연'}</span></div><button onClick={() => setRevision(n => n + 1)} aria-label="HVAC 상태 새로고침"><RefreshCw size={14}/></button></header>
    <div className="ventilation-notice"><Wind size={16}/><span><b>환기가 필요하면 창문을 열어주세요.</b> 에어컨 송풍은 실내 공기 순환이며 외기를 도입하는 환기를 대신하지 않습니다.</span></div>
    {error && <p className="error" role="alert">실제 연결 확인 실패: {error} · 연결 확인 전 제어할 수 없습니다.</p>}
    {[2, 3].map(floor => <section key={floor} className="hvac-floor" aria-label={`${floor}층 HVAC`}>
      <h3><span>{floor}F</span> {floor}층 설비 제어 <small>3개 공간</small></h3>
      <div className="hvac-floor-grid">{SPACES.filter(([id]) => id.startsWith(`${floor}F`)).map(([id, name]) => {
        const room = rooms?.find(r => r.room_id === id);
        return <HvacCard key={`${token}-${id}-${revision}`} room={room} name={name} id={id} ready={rooms !== null} token={token} admin={user?.role === 'admin'}/>;
      })}</div>
    </section>)}
  </section>;
}
function HvacCard({ room, name, id, ready, token, admin }) {
  // A room must be confirmed by the backend before it can be classified as a demo.
  const real = !PUBLIC_DEMO && room?.hasAC === true;
  const confirmed = ready && !!room;
  const [demo, setDemo] = useState({ mode: 'POWER_OFF', target_temp: 24, known: true });
  const [actual, setActual] = useState(null);
  const [temp, setTemp] = useState(24);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const state = real ? (actual || room.acStatus) : demo;
  const disabled = !confirmed || pending || (real && !admin);
  async function control(action) {
    setMessage(''); setPending(true);
    try {
      if (!real) {
        setDemo({ mode: action === 'off' ? 'POWER_OFF' : action === 'fan' ? 'FAN' : 'COOL', target_temp: temp, known: true });
        setMessage('더미에 적용됨 · 실제 장치 동작 없음');
      } else {
        const data = await authApi(`/api/rooms/${encodeURIComponent(id)}/ac/${action}`, token,
          { method: 'POST', ...(action === 'temp' ? { body: JSON.stringify({target_temp: temp}) } : {}) });
        setActual(data.ac_status);
        setMessage(data.status === 'partial' ? '일부 장치만 적용됨 · 상태를 확인하세요.' : '제어 요청 성공 · 마지막 명령 기준');
      }
    } catch (e) { setMessage(`제어 실패: ${e.message}`); }
    finally { setPending(false); }
  }
  const recommendation = room?.ac_recommendation;
  return <article aria-label={name} className={`hvac-card ${real ? 'real' : ''}`}>
    <div className="hvac-card-title"><b>{name}</b><span className={`connection-tag ${real ? 'real' : ''}`}>{!confirmed ? '연결 확인 중' : real ? '실제 연결' : '더미'}</span></div>
    <div className="hvac-state"><Power size={13}/><strong>{confirmed ? (state?.known ? (MODES[state.mode] || '상태 미확인') : '상태 미확인') : '확인 대기'}</strong><span>{real ? '마지막 제어 기록' : '시연 상태'}{state?.mode === 'COOL' && state?.target_temp != null ? ` · ${state.target_temp}℃` : ''}</span></div>
    <div className="hvac-actions"><button disabled={disabled} onClick={() => control('on')}>켜기</button><button disabled={disabled} onClick={() => control('off')}>끄기</button><button disabled={disabled} onClick={() => control('fan')}>송풍</button><button onClick={() => setMessage('창문을 열어 외부 공기가 들어오도록 환기해 주세요. 창문 자동 개폐 장치는 연결되어 있지 않습니다.')}>창문 환기 안내</button></div>
    <div className="hvac-temperature"><label htmlFor={`temp-${id}`}>설정 온도</label><select id={`temp-${id}`} value={temp} disabled={disabled} onChange={e => setTemp(Number(e.target.value))}>{Array.from({length:13}, (_, i) => <option key={i} value={18+i}>{18+i}℃</option>)}</select><button disabled={disabled} onClick={() => control('temp')}>냉방 적용</button></div>
    <div className="hvac-guidance">{real && !admin ? '실제 장치 제어는 관리자에게 제공됩니다.' : recommendation ? `규칙 권고: ${MODES[recommendation.mode] || recommendation.mode}${recommendation.temp ? ` ${recommendation.temp}℃` : ''}` : '창문 환기: 직접 개방 · 자동 개폐 미연결'}</div>
    <div className="hvac-feedback" role="status">{pending ? '제어 요청 중…' : message}</div>
  </article>;
}
