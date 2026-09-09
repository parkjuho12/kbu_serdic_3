import { PUBLIC_DEMO } from '../deployment';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Cpu,
  Database,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
  Wind,
  Moon,
  Sun,
} from 'lucide-react';
import { authApi, demoAi } from '../api';
import HvacPanel from '../components/HvacPanel';
import FloorPlanSvg, { mapX, EDGE_POSITIONS } from '../components/FloorPlanSvg';
import contextCatalog from '../data/contextSensors.json';
import contextDemo from '../data/contextDemo.json';
import edcDemo from '../data/edcDemo.json';

const levelLabel = {
  NORMAL: '정상',
  WATCH: '관찰',
  HIGH: '주의',
  CRITICAL: '긴급',
};

// 2026-09 새로 받은 실제 CAD 도면(경복대학교 2·3층 도면 PDF)에 그려진
// 복합환경센서(EDC) 초록 다이아몬드 아이콘의 실제 픽셀 중심 좌표를 도면에서
// 직접 추출해 %로 변환한 값. (도면 원본을 기준으로 계산 — 임의 추정값 아님)
// 이전 버전에는 23번 센서 좌표가 누락돼 있었는데, 이번 도면에서 확인되어 추가함.
const FLOOR_MARKERS = {
  3: {
    1: [16.22, 81.82], 2: [27.79, 62.03], 3: [43.67, 62.02], 4: [43.67, 81.82],
    5: [45.07, 44.23], 6: [60.86, 82.17], 7: [69.39, 82.10], 8: [78.10, 82.05],
    9: [60.89, 28.86], 10: [69.42, 28.79], 11: [78.13, 28.74],
  },
  2: {
    12: [38.25, 60.62], 13: [38.25, 80.41], 14: [27.95, 60.62], 15: [16.38, 80.41],
    16: [45.55, 42.74], 17: [61.25, 80.53], 18: [69.78, 80.53], 19: [78.31, 80.53],
    20: [78.31, 27.22], 21: [69.81, 27.22], 22: [61.28, 27.22], 23: [30.88, 21.52],
  },
};

// Display offsets only; original sensor coordinates remain unchanged.
const WEST_3F_DISPLAY = {
  'RDC-KBU-06': [18.4, 68.5], 'RDC-KBU-01': [24.3, 68.5],
  'RDC-KBU-18': [18.4, 77], 'RDC-KBU-19': [24.3, 77],
  'RDC-KBU-20': [38.45, 73],
};

function sensorNo(deviceId = '') {
  const m = String(deviceId).match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

function sensorFloor(deviceId = '') {
  const n = sensorNo(deviceId);
  if (n >= 1 && n <= 11) return 3;
  if (n >= 12 && n <= 23) return 2;
  return null;
}

function statusClass(device) {
  if (device?.is_external || sensorNo(device?.device_id) === 23) return 'external';
  if (!device || !device.risk_level) return 'offline';
  if (device.event_type === 'DATA_GAP') return 'offline';
  if (device.event_type === 'SENSOR_OUTLIER') return 'warning';
  return (device.risk_level || 'NORMAL').toLowerCase();
}

function statusText(device) {
  if (device?.is_external || sensorNo(device?.device_id) === 23) return '외부 센서';
  if (!device) return '데이터 없음';
  if (!device.risk_level) return '판단 불가';
  if (device.event_type === 'DATA_GAP') return '수신 이상';
  if (device.event_type === 'SENSOR_OUTLIER') return '센서 이상';
  return levelLabel[device.risk_level] || '정상';
}

function indoorDashboard(payload) {
  const devices = payload.devices.map(d => sensorNo(d.device_id) === 23 ? {...d, is_external:true, risk_score:null, risk_level:null} : d);
  const indoor = devices.filter(d => !d.is_external);
  return {...payload, devices, summary:{total:indoor.length, normal:indoor.filter(d=>d.risk_level==='NORMAL').length, watch:indoor.filter(d=>d.risk_level==='WATCH').length, high:indoor.filter(d=>['HIGH','CRITICAL'].includes(d.risk_level)).length}};
}

export default function Dashboard({ token, user, onLogout }) {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('kbu-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    try { localStorage.setItem('kbu-theme', theme); } catch (_) {}
  }, [theme]);

  async function deleteAccount() {
    if (!window.confirm('정말 계정을 삭제하시겠습니까? (테스트 계정 정리용)')) return;
    try {
      await authApi('/api/auth/me', token, { method: 'DELETE' });
    } catch (e) {
      // 삭제 실패해도 로그아웃은 진행
    }
    onLogout();
  }

  const [data, setData] = useState(() => indoorDashboard(edcDemo));
  const [selected, setSelected] = useState(null);
  const [contextDevices, setContextDevices] = useState(contextDemo.devices);
  const [contextSource, setContextSource] = useState('demo');
  const contextRequest = useRef(0);
  const aiRequest = useRef(0);
  const edcRequest = useRef(0);
  const [selectedContext, setSelectedContext] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [contextError, setContextError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sensorType, setSensorType] = useState('ALL');
  const [zoom, setZoom] = useState(1);
  const [viewTab, setViewTab] = useState('map');
  const [ai, setAi] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [floor, setFloor] = useState(2);


  const [query, setQuery] = useState('');
  const previousAlerts = useRef(new Set());

  async function load() {
    const requestId = ++edcRequest.current;
    setLoading(true);
    setSelected(null); setAi(null); setAiOpen(false);
    setData({summary:{total:0,normal:0,watch:0,high:0}, devices:[]});
    try {
      const payload = contextSource === 'demo' ? edcDemo : await authApi('/api/dashboard', token);
      if (requestId !== edcRequest.current) return;
      const next = indoorDashboard(payload);
      setData(next);
      setLoadError('');
      setSelected(current => current ? next.devices.find(d => d.device_id === current.device_id) || null : null);

      // 새 경고가 처음 발생했을 때만 짧은 경고음 재생.
      const currentAlerts = new Set(
        (next.devices || [])
          .filter((d) => !d.is_external && (d.event_type !== 'NORMAL' || ['HIGH', 'CRITICAL'].includes(d.risk_level)))
          .map((d) => `${d.device_id}:${d.event_type}:${d.risk_level}`)
      );

      const hasNewAlert = [...currentAlerts].some((key) => !previousAlerts.current.has(key));
      if (hasNewAlert && previousAlerts.current.size > 0) playAlertTone();
      previousAlerts.current = currentAlerts;
    } catch (error) {
      if (requestId !== edcRequest.current) return;
      setLoadError('EDC 조회 실패: ' + error.message);
      if (error.status === 401) {
        onLogout();
      }
    } finally {
      if (requestId === edcRequest.current) setLoading(false);
    }
  }

  // 지금은 자동 실시간 폴링 없이, 진입 시 최신 데이터를 한 번만 불러온다.
  // (필요하면 상단 "새로고침" 버튼으로 수동으로 다시 불러올 수 있음)
  useEffect(() => {
    load();
    return () => { edcRequest.current += 1; };
  }, [token, contextSource]);

  useEffect(() => {
    loadContext();
    return () => { contextRequest.current += 1; };
  }, [token, contextSource]);

  async function loadContext() {
    const requestId = ++contextRequest.current;
    setContextDevices(contextSource === 'demo' ? contextDemo.devices : contextCatalog);
    setSelectedContext(null);
    setContextError('');
    try {
      const result = contextSource === 'demo' ? contextDemo : await authApi('/api/context-sensors', token);
      if (requestId !== contextRequest.current) return;
      setContextDevices(result.devices);
      setContextError('');
      setSelectedContext(current => current ? result.devices.find(d => d.device_id === current.device_id) || null : null);
    } catch (error) {
      if (requestId !== contextRequest.current) return;
      setContextError('IRC·RDC 조회 실패: ' + error.message);
      if (error.status === 401) onLogout();
    }
  }

  function selectContext(device) {
    aiRequest.current++;
    setSelectedEdge(null);
    setSelected(null);
    setSelectedContext(device);
    setFloor(device.floor);
    setAiOpen(false);
  }

  function selectDevice(device) {
    aiRequest.current++;
    setSelectedEdge(null);
    setSelected(device);
    setSelectedContext(null);
    const f = sensorFloor(device.device_id);
    if (f) setFloor(f);
    // 센서 선택은 즉시(가벼움) - AI 설명은 원할 때만 별도로 불러온다.
    setAi(null);
    setAiOpen(false);
  }

  async function loadAi(device) {
    const requestId = ++aiRequest.current;
    setAiOpen(true);
    if (device.is_external && device.data_source !== 'SIMULATED') { setAi({device_id:device.device_id, explanation:'23번은 외부 센서로 실내 위험도 평가에서 제외합니다.'}); return; }
    if (device.data_source === 'SIMULATED') {
      setAi({ device_id: device.device_id, explanation: 'AI 분석 중...' });
      try {
        const response = await demoAi(device.device_id);
        if (requestId === aiRequest.current) setAi(response);
      } catch (error) {
        if (requestId === aiRequest.current) setAi({ device_id: device.device_id, error: true, explanation: error.message });
      }
      return;
    }
    if (ai && ai.device_id === device.device_id && !ai.error) return; // 이미 불러온 설명 재사용
    setAi({ explanation: 'AI 분석 중...' });
    try {
      setAi(await authApi(`/api/devices/${device.device_id}/ai`, token));
    } catch (e) {
      if (e.status === 401) {
        onLogout();
        return;
      }
      setAi({ explanation: e.message, error: true });
    }
  }

  const byNumber = useMemo(() => {
    const map = new Map();
    (data.devices || []).forEach((d) => {
      const n = sensorNo(d.device_id);
      if (n != null) map.set(n, d);
    });
    return map;
  }, [data.devices]);

  const floorDevices = useMemo(() => {
    return (data.devices || [])
      .filter((d) => sensorFloor(d.device_id) === floor)
      .filter((d) => !query || d.device_id.toLowerCase().includes(query.toLowerCase()));
  }, [data.devices, floor, query]);

  const alertCount = (data.devices || []).filter(
    (d) => !d.is_external && (d.event_type !== 'NORMAL' || ['HIGH', 'CRITICAL'].includes(d.risk_level))
  ).length;

  return (
    <div className="console-shell" data-theme={theme}>
      <TopBar onLogout={onLogout} theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} onDeleteAccount={PUBLIC_DEMO ? undefined : deleteAccount} />

      <div className={`console-body ${viewTab === 'hvac' ? 'hvac-view' : ''}`}>
        <aside className="directory-pane">
          <div className="dir-title">디렉토리 <span>{data.summary.total}</span></div>
          <button className="dir-item active"><Building2 size={16}/> 창조관</button>
          <button className={`dir-sub ${floor === 2 ? 'selected' : ''}`} aria-label="2층 선택" aria-current={floor === 2 ? 'true' : undefined} onClick={() => setFloor(2)}>2층</button>
          <button className={`dir-sub ${floor === 3 ? 'selected' : ''}`} aria-label="3층 선택" aria-current={floor === 3 ? 'true' : undefined} onClick={() => setFloor(3)}>3층</button>
          <div className="dir-divider" />
          <div className="dir-note">
            <ShieldAlert size={16}/>
            <div><b>AI 공간 관제</b><span>위험도 · 이상치 · 데이터 유실</span></div>
          </div>
        </aside>

        <main className="monitor-main">
          <section className="toolbar-row">
            <div className="view-title">
              <MapIcon size={18}/>
              <b>창조관 {floor}층 환경 모니터링</b>
            </div>
            <div className="toolbar-actions">
              <div className="floor-select">
                <button onClick={() => setFloor(floor === 2 ? 3 : 2)}>{floor}층 <ChevronDown size={15}/></button>
              </div>
              <label className="console-search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="센서 ID 검색"/></label>
              <button className="refresh-btn" disabled={loading} onClick={() => { load(); loadContext(); }}><RefreshCw size={17} className={loading ? 'spin' : ''}/> 새로고침</button>
            </div>
          </section>

          {loadError && <div role="alert" className="error">{loadError} · 표시값은 마지막 조회 결과입니다.</div>}
          {contextError && <div role="alert" className="error">{contextError} · 이전 결과가 남아 있을 수 있습니다.</div>}
          {viewTab !== 'hvac' && <div className="context-source-bar">
            <div><b>{contextSource === 'demo' ? '전체 센서 더미 시연 중' : '전체 센서 실제 DB 조회'}</b><span>{contextSource === 'demo' ? `EDC·IRC·RDC 합성값 기준 ${contextDemo.generated_at.replace('T', ' ')} · 실측·모델 성능 결과 아님` : 'DB 수신 상태에 따라 값이 없을 수 있습니다.'}</span></div>
            {!PUBLIC_DEMO && <div role="group" aria-label="센서 데이터 소스"><button aria-pressed={contextSource === 'demo'} onClick={() => setContextSource('demo')}>더미 데이터</button><button aria-pressed={contextSource === 'database'} onClick={() => setContextSource('database')}>실제 데이터</button></div>}
          </div>}
          <section className="status-strip">
            <StatusChip label="실내 EDC" value={data.summary.total} tone="all" />
            <StatusChip label="정상" value={data.summary.normal} tone="normal" />
            <StatusChip label="관찰" value={data.summary.watch} tone="watch" />
            <StatusChip label="주의 이상" value={data.summary.high} tone="high" />
            <StatusChip label="시스템 경고" value={alertCount} tone="offline" />
          </section>

          <div className="workspace-tabs" role="tablist" aria-label="관제 화면">
            {[['map', '도면'], ['list', '센서 목록'], ['hvac', 'HVAC 제어']].map(([id, label]) => <button key={id} type="button" role="tab" id={`view-tab-${id}`} aria-selected={viewTab === id} aria-controls={`view-panel-${id}`} tabIndex={viewTab === id ? 0 : -1} onClick={() => setViewTab(id)} onKeyDown={event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const tabs = ['map', 'list', 'hvac'];
                const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(tabs.indexOf(id) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
                setViewTab(next);
                document.getElementById(`view-tab-${next}`)?.focus();
              }
            }}>{id === 'map' ? <MapIcon size={16}/> : id === 'hvac' ? <Wind size={16}/> : <Database size={16}/>} {label}</button>)}
          </div>
          <section className="floor-workspace">
            <div className="floor-canvas-card" role="tabpanel" id="view-panel-map" aria-labelledby="view-tab-map" hidden={viewTab !== 'map'}>
              <div className="floor-card-head">
                <div>
                  <b>센서 배치도</b>
                  <span>전체 도면 맞춤 · 장치를 선택하거나 확대해 상세 확인</span>
                </div>
                <div className="legend-row">
                  <span><i className="legend-dot normal"/> 정상</span>
                  <span><i className="legend-dot watch"/> 관찰</span>
                  <span><i className="legend-dot high"/> 주의</span>
                  <span><i className="legend-dot offline"/> 수신 이상</span>
                </div>
              </div>

              <div className="map-controls">
                <div className="sensor-filters">{['ALL', 'EDC', 'IRC', 'RDC'].map(type => <button key={type} aria-pressed={sensorType === type} className={sensorType === type ? 'active' : ''} onClick={() => setSensorType(type)}>{type === 'ALL' ? '전체' : type}</button>)}</div>
                <div className="zoom-controls"><button aria-label="도면 축소" onClick={() => setZoom(z => Math.max(1, z - .5))}>−</button><button onClick={() => setZoom(1)}>화면 맞춤</button><span>{Math.round(zoom * 100)}%</span><button aria-label="도면 확대" onClick={() => setZoom(z => Math.min(3, z + .5))}>+</button></div>
              </div>
              <div className="floorplan-stage">
                <div className="floorplan-inner" data-zoomed={zoom > 1} style={{'--zoom-width': `${zoom * 100}%`, width: `${zoom * 100}%`, maxWidth: 'none', flexShrink: 0}}>
                  <FloorPlanSvg floor={floor} />
              <div className="device-type-legend" role="group" aria-label="장치 종류 범례">
                <span><i className="type-symbol type-edc" aria-hidden="true"/>복합환경센서 <b>EDC</b></span>
                <span><i className="type-symbol type-irc" aria-hidden="true"/>열화상 센서 <b>IRC</b></span>
                <span><i className="type-symbol type-rdc" aria-hidden="true"/>레이더 센서 <b>RDC</b></span>
                <span><Cpu size={17} aria-hidden="true"/>에지 컴퓨터 <b>EDGE</b></span>
              </div>

                  <div className="fp-markers-layer">
                    {Object.entries(FLOOR_MARKERS[floor]).map(([num, [x, y]]) => {
                      const device = byNumber.get(Number(num));
                      const hiddenBySearch = (sensorType !== 'ALL' && sensorType !== 'EDC') || (query && !`EDC-KBU-${String(num).padStart(2, '0')}`.toLowerCase().includes(query.toLowerCase()));
                      const selectedMarker = selected && sensorNo(selected.device_id) === Number(num);
                      return (
                        <button
                          key={num}
                          className={`sensor-marker ${statusClass(device)} ${selectedMarker ? 'selected' : ''} ${hiddenBySearch ? 'dimmed' : ''}`}
                          style={{ left: `${mapX(x)}%`, top: `${y}%` }}
                          onClick={() => selectDevice(device || {device_id: `EDC-KBU-${String(num).padStart(2, '0')}`, risk_level: null, data_status: 'NO_DATA', event_type: 'DATA_GAP'})}
                          aria-label={`EDC-KBU-${String(num).padStart(2, '0')} 상세`}
                          title={device ? `${device.device_id} · ${statusText(device)} · Risk ${device.risk_score}` : `EDC ${num} · 데이터 없음`}
                        >
                          <span className="diamond" />
                          <b>{num}</b>
                          {device && <small>{device.risk_score == null ? '—' : Math.round(device.risk_score)}</small>}
                        </button>
                      );
                    })}
                    {EDGE_POSITIONS[floor].map((edge, index) => <div key={`edge-${index}`} className="edge-anchor" style={{left: `${mapX(edge.x / 3511 * 100)}%`, top: `${edge.y / 986 * 100}%`}}>
                      <span className="edge-location"/><span className="edge-leader"/>
                      <button className={`edge-device ${selectedEdge?.floor === floor && selectedEdge?.index === index ? 'selected' : ''}`} aria-label={`${floor}층 에지 컴퓨터 ${index + 1} 상세`} onClick={() => {setSelected(null); setSelectedContext(null); setSelectedEdge({floor,index});}}><Cpu size={20}/><span><b>EDGE {index+1}</b><small>에지 컴퓨터</small></span></button>
                    </div>)}
                    {contextDevices.filter(d => d.floor === floor).map(d => {
                      const dimmed = (sensorType !== 'ALL' && sensorType !== d.sensor_type) || (query && !d.device_id.toLowerCase().includes(query.toLowerCase()));
                      const offset = floor === 3 ? WEST_3F_DISPLAY[d.device_id] : null;
                      const [displayX, displayY] = offset || [d.x, d.y];
                      return <React.Fragment key={d.device_id}>{offset && <svg className={`sensor-position-leader ${dimmed ? 'dimmed' : ''}`} viewBox="300 0 2950 986" preserveAspectRatio="none" aria-hidden="true"><line x1={d.x * 35.11} y1={d.y * 9.86} x2={displayX * 35.11} y2={displayY * 9.86}/><circle cx={d.x * 35.11} cy={d.y * 9.86} r="4"/></svg>}<button className={`context-marker ${d.sensor_type.toLowerCase()} ${selectedContext?.device_id === d.device_id ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`} style={{left: `${mapX(displayX)}%`, top: `${displayY}%`}} onClick={() => selectContext(d)} aria-label={`${d.device_id} 상세`} title={`${d.device_id} · ${d.data_status || 'NO_DATA'}`}><b>{d.number}</b></button></React.Fragment>;
                    })}
                  </div>
                </div>
              </div>
              <div className="map-footnote">◆ EDC 환경 · ● IRC 열화상 · ▲ RDC 재실 · ▣ 에지 컴퓨터 (연결선 끝이 설치 위치){floor === 3 && <span> · 서측 레이더의 작은 점은 설치 위치, 연결된 마커는 선택용 표시입니다.</span>}<br/>센서별 재실값을 합산해 공간 인원으로 해석하지 않습니다. EDC 23번은 외부 센서로 실내 집계에서 제외합니다.</div>
            </div>

            <div className="floor-list-card sensor-list-panel" role="tabpanel" id="view-panel-list" aria-labelledby="view-tab-list" hidden={viewTab !== 'list'}>
              <div className="list-head"><div><b>센서 목록</b><p>창조관 {floor}층 · 센서를 선택하면 오른쪽에 상세 정보가 표시됩니다.</p></div><span>EDC {floorDevices.length}개</span></div>
              <div className="map-controls"><div className="sensor-filters">{['ALL', 'EDC', 'IRC', 'RDC'].map(type => <button key={type} aria-pressed={sensorType === type} className={sensorType === type ? 'active' : ''} onClick={() => setSensorType(type)}>{type === 'ALL' ? '전체' : type}</button>)}</div></div>
              <div className="compact-device-list">
                {(sensorType === 'ALL' || sensorType === 'EDC') && floorDevices.map((d) => (
                  <button key={d.device_id} onClick={() => selectDevice(d)} className={selected?.device_id === d.device_id ? 'active' : ''}>
                    <span className={`state-pip ${statusClass(d)}`}/>
                    <span className="device-name"><b>{d.device_id}</b><small>{statusText(d)}</small><small>{d.created_at?.replace('T', ' ') || '측정 시각 없음'}</small></span>
                    <span className="device-risk"><small>Risk</small><b>{d.risk_score ?? '-'}</b></span>
                  </button>
                ))}
                {contextDevices.filter(d => d.floor === floor && (sensorType === 'ALL' || sensorType === d.sensor_type) && (!query || d.device_id.toLowerCase().includes(query.toLowerCase()))).map(d => <button key={d.device_id} className={selectedContext?.device_id === d.device_id ? 'active' : ''} onClick={() => selectContext(d)}><span className={`context-pip ${d.sensor_type.toLowerCase()}`}/><span className="device-name"><b>{d.device_id}</b><small>{d.data_source === 'SIMULATED' ? (d.sensor_type === 'RDC' ? '레이더 센서' : '열화상 센서') : d.data_status === 'AVAILABLE' ? '저장 데이터' : d.data_status === 'STALE' ? '오래된 데이터' : '데이터 없음'}</small></span></button>)}
                {(sensorType === 'ALL' || sensorType === 'EDC') && floorDevices.length === 0 && <div className="empty-list">검색 조건에 맞는 EDC 수신 데이터가 없습니다.</div>}
              </div>
            </div>
            <div role="tabpanel" id="view-panel-hvac" aria-labelledby="view-tab-hvac" hidden={viewTab !== 'hvac'}>
              <HvacPanel token={token} user={user} />
            </div>
          </section>
        </main>

        <aside className="insight-pane">
          <div className="panel-title">센서 상세</div>
          {selectedEdge ? <><div className="selected-head"><div><span>{selectedEdge.floor}층 · 에지 컴퓨터</span><h2>EDGE {selectedEdge.index + 1}</h2></div><Cpu size={28}/></div><div className="context-description"><b>장치 상태 미연동</b><p>도면의 설치 위치를 표시합니다. EDGE 번호는 화면에서 구분하기 위한 번호입니다.</p><p>실제 장치 ID, 연결 센서와 heartbeat 데이터는 아직 연결되지 않았습니다.</p></div></> : selectedContext ? <ContextDetails device={selectedContext} /> : selected ? (
            <>
              <div className="selected-head">
                <div><span>선택 센서</span><h2>{selected.device_id}</h2></div>
                <span className={`status-pill ${statusClass(selected)}`}>{statusText(selected)}</span>
              </div>

              <div className={`risk-card ${statusClass(selected)}`}>
                <span>{selected.is_external ? '외부 센서 · 실내 평가 제외' : selected.data_source === 'SIMULATED' ? '환경 상태 점수' : 'AI Risk Score'}</span>
                <strong>{selected.risk_score ?? '-'}<small>/100</small></strong>
                <b>{statusText(selected)}</b>
              </div>

              
              <div className="sensor-metrics">
                <Metric label="CO₂" value={selected.co2} unit="ppm" />
                <Metric label="PM2.5" value={selected.aerosol} unit="" />
                <Metric label="Gas response" value={selected.gas} unit="" />
                <Metric label="온도" value={selected.temp} unit="℃" />
                <Metric label="습도" value={selected.hum} unit="%" />
              </div>

              <div className="ai-explanation">
                <div className="ai-explanation-head" onClick={() => selected.created_at && (aiOpen ? setAiOpen(false) : loadAi(selected))}>
                  <span><Sparkles size={16}/><b>{'통제형 AI 설명'}</b></span>
                  <button type="button" className="ai-toggle" disabled={!selected.created_at}>{!selected.created_at ? '데이터 없음' : aiOpen ? '접기 ▲' : 'AI 분석 보기 ▼'}</button>
                </div>
                {aiOpen && <p>{ai?.explanation || '불러오는 중입니다...'}</p>}
              </div>

              <div className="system-health">
                <div><Wifi size={16}/><span>데이터 수신</span><b>{!selected.created_at ? '데이터 없음' : selected.event_type === 'DATA_GAP' ? '확인 필요' : '정상'}</b></div>
                <div><Cpu size={16}/><span>센서 상태</span><b>{!selected.created_at ? '확인 불가' : selected.event_type === 'SENSOR_OUTLIER' ? '이상치 감지' : '정상'}</b></div>
              </div>
            </>
          ) : (
            <div className="insight-empty">
              <Sparkles size={38}/>
              <h3>공간 센서를 선택하세요</h3>
              <p>도면의 EDC · IRC · RDC 마커를 선택해 환경값, 재실 정보, 열화상 통계를 확인하세요.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TopBar({ onLogout, theme, onToggleTheme, onDeleteAccount }) {
  const user = (() => {
    if (PUBLIC_DEMO) return { name: '공개 시연', role: 'DEMO' };
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  return (
    <header className="console-topbar">
      <div className="console-brand"><span className="brand-icon">◉</span><div><b>KBU Monitor</b><small>AI Facility Console</small></div></div>
      <div className="top-user"><button className="theme-toggle" onClick={onToggleTheme} aria-pressed={theme === 'dark'} aria-label="다크모드" title={theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환'}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span>{theme === 'dark' ? '라이트모드' : '다크모드'}</span></button><span className="online-dot"/><b>{user.name || '관리자'}</b><small>{user.role || 'admin'}</small>{onDeleteAccount && <button onClick={onDeleteAccount} title="테스트 계정 정리용 삭제" className="ghost-danger">계정 삭제</button>}{!PUBLIC_DEMO && <button onClick={onLogout}><LogOut size={16}/> 로그아웃</button>}</div>
    </header>
  );
}

function StatusChip({ label, value, tone }) {
  return <div className={`status-chip ${tone}`}><span className="chip-dot"/><b>{label}</b><strong>{value}</strong></div>;
}

function Metric({ label, value, unit }) {
  return <div><span>{label}</span><b>{value ?? '-'}<small>{value == null ? '' : unit}</small></b></div>;
}

function playAlertTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {}
}

function ContextDetails({ device }) {
  const available = device.created_at != null;
  return <>
    <div className="selected-head"><div><span>{device.floor}층 · {device.sensor_type === 'RDC' ? '레이더 재실 센서' : '적외선 열화상 센서'}</span><h2>{device.device_id}</h2></div></div>
    {device.data_source !== 'SIMULATED' && <div className="demo-tag">{device.source_table ? `DB · ${device.source_table}` : '조회 연결 확인 필요'}</div>}
    <div className="context-value"><span>{device.sensor_type === 'RDC' ? '감지 대상 수' : '평균 표면 온도'}</span><strong>{(device.sensor_type === 'RDC' ? device.target_count : device.thermal_mean) ?? '—'}<small>{device.sensor_type === 'RDC' ? '명' : '℃'}</small></strong></div>
    {device.sensor_type === 'IRC' && <div className="sensor-metrics"><Metric label="최저 표면 온도" value={device.thermal_min} unit="℃"/><Metric label="최고 표면 온도" value={device.thermal_max} unit="℃"/></div>}
    <div className="context-description"><b>{device.data_source === 'SIMULATED' ? '센서 정보' : device.data_status === 'STALE' ? '오래된 데이터' : available ? 'DB 저장 데이터' : '데이터 없음'}</b><p>기준 시각: {device.created_at?.replace('T', ' ') || '—'}</p><p>{device.sensor_type === 'RDC' ? '센서별 감지 대상 수입니다. 여러 센서의 값을 합산하면 중복 집계될 수 있습니다.' : '열화상 통계입니다. 실내 기온이나 인체 온도로 해석하지 않습니다.'}</p>{!available && <p>{device.data_status === 'NOT_CONFIGURED' ? 'IRC 측정값 테이블 연결이 필요합니다.' : device.data_status === 'UNMAPPED' ? 'room_sensors의 실제 장치 ID와 도면 ID 매핑이 필요합니다.' : '저장된 측정 데이터가 없습니다.'}</p>}</div>
    <div className="future-card"><b>공간 설비 제어</b><p>HVAC 제어 탭에서 확인하세요.</p></div>
  </>;
}
