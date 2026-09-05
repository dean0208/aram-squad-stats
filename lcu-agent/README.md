# ARAM Squad Stats — LCU 에이전트 (Windows)

롤 클라이언트(LCU)에서 ARAM Mayhem(`queueId 2400`) 전적을 읽어
`https://aram-squad-stats.vercel.app/api/lcu-sync` 로 전송하는 로컬 스크립트입니다.

추적 대상 4명이 **모두 포함된 경기만** 전송하며, 4명 중 아무나 실행하면 됩니다.

## 실행 방법

1. 롤 클라이언트를 **로비 화면까지** 켜둡니다.
2. `실행.bat` (또는 영문 환경이면 `run.bat`)을 더블클릭합니다.

`.bat` 파일이 Python 확인 → 필요한 패키지 자동 설치 → 스크립트 실행까지 처리합니다.

## 사전 준비

| 항목 | 내용 |
| --- | --- |
| Python | 3.8 이상. [python.org](https://python.org) 설치 시 **"Add python.exe to PATH"** 체크 필수 |
| 패키지 | `requests`, `psutil` — `.bat` 실행 시 자동 설치 (`requirements.txt`) |
| 환경변수 | `LCU_SYNC_SECRET` — 서버와 공유하는 인증 키 |

환경변수 설정 (한 번만):

```bat
setx LCU_SYNC_SECRET <REPLACE_WITH_SECRET_MANAGER>
```

설정 후 명령 프롬프트를 새로 열어야 값이 반영됩니다.

## 파일 구성

| 파일 | 설명 |
| --- | --- |
| `lcu_agent.py` | 수집·전송 본체 |
| `requirements.txt` | Python 의존성 |
| `실행.bat` | 한글 실행 스크립트 (UTF-8, `chcp 65001`) |
| `run.bat` | 영문 실행 스크립트 (한글 깨짐 환경용) |

## 되짚어 복구하기

기본 실행은 최근 8경기만 확인합니다 (한 판 끝날 때마다 돌리는 사용 패턴 기준).
더 예전 경기가 누락됐다면 조회 구간을 넓혀서 실행하세요.

```bat
python lcu_agent.py --full
```

## 진단 모드

LCU 응답 원본을 확인하고 서버로는 전송하지 않습니다.

```bat
python lcu_agent.py --debug
```

## 알려진 데이터 이슈

CC 기여(`cc_score`)는 오랫동안 0으로 저장됐습니다. 에이전트가 Riot Match-V5 의
`totalTimeCCDealt` 만 읽었는데, LCU 응답은 `totalTimeCrowdControlDealt` 를 씁니다.
현재는 두 이름을 모두 읽습니다.

**이미 저장된 경기의 CC는 복구할 수 없습니다** — 원본 값이 남아 있지 않습니다.
수정 이후 수집된 경기부터 CC가 채워지고, 그때부터 꽁꽁이 메달과 CC 마일스톤이
정상 동작합니다.

## 자주 나는 오류

| 증상 | 원인 / 해결 |
| --- | --- |
| `ModuleNotFoundError: No module named 'psutil'` | 의존성 미설치. `.bat`으로 실행하면 자동 설치됩니다. 수동 설치는 `python -m pip install -r requirements.txt` |
| 패키지를 설치했는데도 `ModuleNotFoundError` | PC에 Python이 여러 개 있고 `.bat`이 다른 인터프리터를 잡은 경우. `.bat` 실행 시 첫 줄에 찍히는 "사용 중인 Python" 경로를 확인하고, 그 경로의 python으로 설치하세요: `"<그 경로>" -m pip install -r requirements.txt`. 현재 `.bat`은 이 경우를 자동으로 처리합니다 |
| `Python not found` | Python 미설치이거나 PATH 미등록. 재설치하며 "Add python.exe to PATH" 체크 |
| `League Client가 실행 중이지 않습니다` | 롤 클라이언트를 로비 화면까지 켠 뒤 재실행 |
| `'...'은 tracked 목록에 없습니다` | `lcu_agent.py`의 `TRACKED_PLAYERS`에 없는 계정으로 로그인된 상태 |
| `LCU_SYNC_SECRET 환경변수가 설정되지 않았습니다` | 위 `setx` 명령으로 설정 후 창을 새로 열기 |
| `skip OC1_... (4명 미충족: n/4)` | 정상 동작. 추적 대상 4명이 다 없는 경기는 전송하지 않습니다 |

## 동작 흐름

1. 실행 중인 `LeagueClient` 프로세스에서 `lockfile` 탐색 → 포트/비밀번호 획득
2. 현재 로그인 계정이 `TRACKED_PLAYERS`에 있는지 확인
3. `/api/last-sync`로 마지막 저장 시점 조회
4. 최근 `FETCH_COUNT`(8, `--full` 시 20)경기 중 `queueId 2400`만 필터
5. 경기별 game detail 조회 → 10명 전체 수집, LCU PUUID → Riot PUUID 변환
6. 4명 모두 포함된 경기만 3경기씩 배치로 POST (Vercel 10초 제한 대응)
