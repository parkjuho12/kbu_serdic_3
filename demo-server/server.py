"""Bounded GPT explanation endpoint for fixed synthetic sensor snapshots. No school DB or control API."""
import json
import os
import threading
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.parse import urlsplit, unquote

DATA = Path(os.environ.get('DEMO_DATA', str(Path(__file__).parent.parent / 'dashboard/src/data/edcDemo.json')))
DEVICES = {d['device_id']: d for d in json.loads(DATA.read_text())['devices']}
MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4.1-mini')
LOCK = threading.Lock()
CACHE = {}
ATTEMPTS = []
SYSTEM = '''너는 실내 환경 관제 대시보드의 설명 모듈이다. 전달된 센서 수치와 상태만 근거로 한국어 2~3문장으로 설명한다.
상태는 이미 설정되어 있으므로 재판정하거나 위험 점수를 모델이 산출했다고 말하지 않는다.
재실 여부, 증가 추세, 원인, 에너지 절감 효과 등 입력에 없는 사실은 추측하지 않는다.
사용자에게 수치와 현재 상태, 필요한 확인 조치를 간결하게 안내한다. 메타 설명은 반복하지 않는다.
정상이면 상태 유지와 확인을 안내한다. 관찰이면 수치 확인을 권고한다.
환기를 권고할 때는 창문을 열어 외부 공기를 유입하도록 안내한다. 에어컨 송풍은 외기 환기를 대신하지 않는다.
가스 반응값을 특정 유해가스 농도나 화재로 단정하지 않는다. 외부 센서는 실내 평가에서 제외한다.'''

class ServiceError(Exception):
    def __init__(self, status, message): self.status, self.message = status, message

def explain(device_id):
    if device_id not in DEVICES: raise ServiceError(404, '등록되지 않은 센서입니다.')
    with LOCK:
        if device_id in CACHE: return {**CACHE[device_id], 'cached': True}
        key = os.environ.get('OPENAI_API_KEY', '').strip()
        if not key: raise ServiceError(503, 'AI 연결 설정을 확인해 주세요.')
        now = time.time()
        ATTEMPTS[:] = [t for t in ATTEMPTS if now-t < 86400]
        if len(ATTEMPTS) >= 100 or sum(now-t < 60 for t in ATTEMPTS) >= 12:
            raise ServiceError(429, 'AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.')
        ATTEMPTS.append(now)
        d = DEVICES[device_id]
        snapshot = {k:d.get(k) for k in ('device_id','co2','aerosol','temp','hum','gas','risk_level','risk_score','is_external')}
        body = {'model':MODEL, 'max_completion_tokens':400, 'temperature':0.2,
                'messages':[{'role':'system','content':SYSTEM}, {'role':'user','content':json.dumps(snapshot,ensure_ascii=False)}]}
        req=Request('https://api.openai.com/v1/chat/completions', data=json.dumps(body).encode(),
                    headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
        try:
            with urlopen(req,timeout=30) as response: result=json.load(response)
            text=result['choices'][0]['message']['content'].strip()
            if not text: raise ValueError('empty output')
        except Exception as exc:
            print('AI request failed:', type(exc).__name__, flush=True)
            raise ServiceError(502,'AI 설명을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.') from None
        answer={'device_id':device_id,'explanation':text,'provider':'openai','model':result.get('model',MODEL),
                'response_id':result.get('id'),'cached':False}
        CACHE[device_id]=answer
        return answer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path
        try:
            if path=='/health': self.reply(200,{'status':'ok','ai_configured':bool(os.environ.get('OPENAI_API_KEY'))});return
            if not path.startswith('/api/demo-ai/'):
                raise ServiceError(404,'경로를 확인하세요.')
            self.reply(200,explain(unquote(path[len('/api/demo-ai/'):])) )
        except ServiceError as e: self.reply(e.status,{'detail':e.message})
    def reply(self,status,data):
        raw=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers()
        self.wfile.write(raw)

if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('PORT','8089'))),Handler).serve_forever()
