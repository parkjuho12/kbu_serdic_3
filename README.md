# KBU SERDIC 3

KBU Monitor 센서 관제 및 HVAC 모의 제어 웹 애플리케이션입니다.
EDC·IRC·RDC 합성 데이터로 화면을 제공하고, 선택한 EDC 센서의 설명은 서버에서 OpenAI GPT를 호출하여 생성합니다. 학교 DB와 실제 에어컨에는 연결하지 않습니다.

## 구성

- dashboard: React/Vite 도면, 센서 목록, 다크모드, HVAC 모의 제어
- demo-server: Python 표준 라이브러리 기반 GPT 설명 API
- deploy: 기존 Nginx HTTPS를 유지하면서 Apache에 배포하는 스크립트

## 로컬 실행

Python 3.10 이상, Node.js 18 이상을 사용합니다.

첫 번째 터미널에서 실제 키를 환경변수로 설정하고 서버를 실행합니다. 키는 GitHub에 커밋하지 않습니다.

```sh
export OPENAI_API_KEY='본인의 API 키'
export OPENAI_MODEL=gpt-4.1-mini
python3 demo-server/server.py
```

두 번째 터미널:

```sh
cd dashboard
npm ci
npm run dev
```

Vite 개발 프록시가 설명 요청을 127.0.0.1:8089로 전달합니다. 입력 데이터는 합성값이고 설명은 실제 GPT 생성 결과입니다. AI 호출 실패 시 오류를 표시하며 고정 문장으로 대체하지 않습니다.

## 확인 및 빌드

```sh
python3 demo-server/test_server.py
cd dashboard
npm run build
```


## 동작 범위

- 실제 센서값과 합성값을 구분하는 안내는 화면 상단에 표시합니다.
- 상태 및 점수는 사전 구성된 시나리오이며 GPT가 위험도를 산출한 결과가 아닙니다.
- GPT는 등록된 센서의 서버 보관 값만 설명합니다. 사용자가 임의의 프롬프트를 전송하는 API는 제공하지 않습니다.
- GPT 설명을 프로세스 메모리에 캐시합니다. 최초 생성 요청은 분당 12회·24시간 100회로 제한하며, 서비스 재시작 시 캐시와 제한 카운터는 초기화됩니다.
- HVAC 제어는 브라우저 메모리의 모의 상태만 변경합니다. 새로고침하면 초기화됩니다.
- 학교 DB 접속정보, 개인키, 실제 측정 자료, 보고서는 포함하지 않았습니다.

실제 OpenAI 호출은 유효한 API 키와 계정 사용 가능량이 필요합니다. 업로드 시점의 자동 테스트는 모의 응답으로 호출·캐시·오류 처리를 검증한 테스트입니다.
