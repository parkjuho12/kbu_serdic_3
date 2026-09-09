import React from 'react';

// PDF 위치를 기준으로 단순화한 공간도. 도형과 장치는 모두 React로 렌더링한다.
// 여백을 제거한 동일 좌표계를 SVG 배경과 HTML 장치 레이어가 공유한다.
export const mapX = percent => (percent * 3511 / 100 - 300) / 2950 * 100;
export const EDGE_POSITIONS = {
  3: [{x:1542.5,y:436}, {x:2450.5,y:546}, {x:939,y:547}],
  2: [{x:1559.3,y:421.6}, {x:1211.8,y:532.6}, {x:2455.9,y:532.6}],
};
const OUTLINES = {
  3: '3164,128 2465,128 2464,41 2083,41 2082,211 1908,216 1907,258 1844,257 1844,134 1654,134 1653,258 1591,258 1574,212 334,216 334,948 1477,948 1478,967 3164,948',
  2: '3170,111 2471,111 2470,23 2088,23 2088,193 1929,194 1912,241 1849,240 1849,117 1660,117 1659,241 1597,241 1580,194 339,199 361,220 361,909 339,931 3170,931 3148,909 3148,133',
};

// 실제로 EDC 센서가 배치된 두 공간(좌측 실습실 라인 / 우측 대형 강의실)
const ROOMS = {
  3: [
    { x: 526, y: 579, w: 1040, h: 300 },
    { x: 2114, y: 253, w: 674, h: 587 },
  ],
  2: [
    { x: 542, y: 565, w: 840, h: 261 },
    { x: 2119, y: 240, w: 675, h: 586 },
  ],
};

// 중앙 원형 아트리움(계단홀)
const ATRIUM = {
  3: { cx: 1749, cy: 582, r: 134 },
  2: { cx: 1756, cy: 578, r: 157 },
};

// 아트리움 남쪽의 삼각(V자) 진입 통로
const NOTCHES = {
  3: 'M1558,772 L1749,846 L1940,772',
  2: 'M1566,755 L1754.5,829 L1943,755',
};

// 우측 구역(메쉬/그레이팅) 구간
const HATCH = {
  3: { x: 2789, y: 217, w: 197, h: 638 },
  2: { x: 2794, y: 203, w: 195, h: 634 },
};


export default function FloorPlanSvg({ floor }) {
  const atrium = ATRIUM[floor];
  const hatch = HATCH[floor];
  return <svg viewBox="300 0 2950 986" preserveAspectRatio="xMidYMid meet" className="floorplan-svg" role="img" aria-label={`창조관 ${floor}층 공간 배치도`}>
    <defs>
      <pattern id={`grid-${floor}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dce6ef" strokeWidth="1.5"/></pattern>
      <pattern id={`terrace-${floor}`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 24L24 0" stroke="#92b1a8" strokeWidth="2"/></pattern>
    </defs>
    <rect x="300" width="2950" height="986" fill="#f8fafc"/>
    <polygon points={OUTLINES[floor]} fill="#fff" stroke="#667b92" strokeWidth="6" strokeLinejoin="round"/>
    <path d="M365 470H1570V365H2040V885H365Z" fill="#eaf0f6"/>
    {[0,1,2,3,4].map(i => <g key={i}>
      <rect x={530+i*202} y={floor===3?300:280} width="182" height="163" rx="2" fill="#fff" stroke="#aab9c9" strokeWidth="3"/>
    </g>)}
    {ROOMS[floor].map((r,i) => <g key={i}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="3" fill={i===0?'#eaf2ff':'#e8f4f0'} stroke={i===0?'#789ac6':'#76a99a'} strokeWidth="4"/>
      <text x={r.x+r.w/2} y={i===0?r.y+r.h-(floor===3?30:65):r.y+145} textAnchor="middle" className="space-label">{i===0?'서측 센서 구역':'동측 센서 구역'}</text>
    </g>)}
    <rect x={hatch.x} y={hatch.y} width={hatch.w} height={hatch.h} rx="2" fill={`url(#terrace-${floor})`} stroke="#92b1a8" strokeWidth="3"/>
    <circle cx={atrium.cx} cy={atrium.cy} r={atrium.r} fill="#f8fafc" stroke="#8499ae" strokeWidth="5"/>
    <circle cx={atrium.cx} cy={atrium.cy} r={atrium.r-22} fill="none" stroke="#c5d1dd" strokeWidth="2"/>
    <text x={atrium.cx} y={atrium.cy+9} textAnchor="middle" className="space-label">중앙 홀</text>
    <path d={NOTCHES[floor]} fill="none" stroke="#8499ae" strokeWidth="5"/>
    <rect x="1670" y="155" width="165" height="155" rx="2" fill="#e8edf3" stroke="#aab9c9" strokeWidth="3"/>
    {Array.from({length:7},(_,i)=><path key={i} d={`M1690 ${185+i*15}H1815`} stroke="#8c9eb2" strokeWidth="3"/>)}
    <text x="820" y="520" textAnchor="middle" className="space-caption">복도</text>
    
  </svg>;
}
