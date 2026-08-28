"""
ARAM Squad Stats - LCU Agent (Windows)
롤 클라이언트에서 ARAM Mayhem(queueId 2400) 전적을 읽어 서버로 전송합니다.

사용법:
  python lcu_agent.py          # 정상 실행 (서버로 전송)
  python lcu_agent.py --debug  # 진단 모드 (API 응답 raw 출력, 서버 전송 안 함)

필요:
  pip install requests psutil
"""

import sys
import os
import re
import json
import base64
import argparse
import psutil
import requests
from pathlib import Path

# ─── 설정 ────────────────────────────────────────────────────────────────────

SERVER_URL  = "https://aram-squad-stats.vercel.app/api/lcu-sync"
LCU_SECRET  = os.environ.get("LCU_SYNC_SECRET", "")  # 환경변수 or 직접 입력
QUEUE_ID    = 2400   # ARAM Mayhem
FETCH_COUNT = 200    # 최근 N경기 조회

TRACKED_PUUIDS = {
    "fMM-QQxR_KvThTZ-4xaqn_XzyPLrzBKx8qL-6lyw1OfyabCpv8NWGYMt_v836xmLJRhO1mO55RXilg",  # Hoodville
    "XqEwGu2HFUiWqO8AOrAPfCfKxSl1BzSLcFxV0HFfVan_YvQvfEdbfnXrVkfErFHtq27-la-U9e_ZgA",  # Interest Rate
    "Mx8gYVhZwzugCoBFQyoCfjESRpjTF6ZJN-8uTF1hqHwc9s9ke5rGTKnWFvfYGa6z8tAWnIxMdytYPg",  # Nunu and Lulu
    "ScCA2JAvEUDKOL83IF0jnELmmCoPIWfi6qhZ6h-sTR7V18ZFgt8y4XhHHny3j5MXdowQlgPcsLjy2Q",  # just won lotto
}

# ─── lockfile 읽기 ────────────────────────────────────────────────────────────

def find_lockfile():  # -> Optional[Path]
    """실행 중인 LeagueClient 프로세스에서 lockfile 경로를 찾습니다."""
    for proc in psutil.process_iter(['name', 'cmdline', 'cwd']):
        try:
            if proc.info['name'] and 'LeagueClient' in proc.info['name']:
                cwd = proc.info.get('cwd') or ''
                # cmdline에서 --app-dir 파싱
                cmdline = proc.info.get('cmdline') or []
                for arg in cmdline:
                    m = re.search(r'--app-dir=(.+?)(?:\s|$|")', arg)
                    if m:
                        return Path(m.group(1).strip('"')) / 'lockfile'
                if cwd:
                    lf = Path(cwd) / 'lockfile'
                    if lf.exists():
                        return lf
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # fallback: 일반적인 경로 탐색
    common_paths = [
        Path("C:/Riot Games/League of Legends/lockfile"),
        Path("C:/Program Files/Riot Games/League of Legends/lockfile"),
        Path("C:/Program Files (x86)/Riot Games/League of Legends/lockfile"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Riot Games/League of Legends/lockfile",
    ]
    for p in common_paths:
        if p.exists():
            return p
    return None


def parse_lockfile(path: Path) -> dict:
    """lockfile 파싱 → {name, pid, port, password, protocol}"""
    content = path.read_text(encoding='utf-8').strip()
    parts = content.split(':')
    return {
        'name':     parts[0],
        'pid':      parts[1],
        'port':     parts[2],
        'password': parts[3],
        'protocol': parts[4],
    }


def lcu_session(port: str, password: str) -> requests.Session:
    """LCU 전용 requests 세션 (SSL 무시, Basic 인증)"""
    s = requests.Session()
    s.verify = False
    token = base64.b64encode(f"riot:{password}".encode()).decode()
    s.headers.update({
        'Authorization': f'Basic {token}',
        'Accept': 'application/json',
    })
    s.__dict__['base_url'] = f"https://127.0.0.1:{port}"
    return s


def lcu_get(session: requests.Session, path: str):
    url = session.__dict__['base_url'] + path
    r = session.get(url, timeout=10)
    r.raise_for_status()
    return r.json()

# ─── 데이터 수집 ──────────────────────────────────────────────────────────────

def get_current_puuid(session: requests.Session) -> str:
    # 여러 엔드포인트 시도 (버전마다 다름)
    endpoints = [
        '/lol/summoner/v1/current-summoner',
        '/lol/login/v1/session',
        '/lol/lobby/v2/lobby',
    ]
    for ep in endpoints:
        try:
            data = lcu_get(session, ep)
            if isinstance(data, dict):
                puuid = data.get('puuid') or data.get('localPlayer', {}).get('puuid', '')
                if puuid:
                    return puuid
        except Exception:
            continue
    raise RuntimeError("PUUID를 가져올 수 없습니다. 모든 엔드포인트 실패")


def get_match_history(session: requests.Session, puuid: str, count: int = 200) -> list:
    """매치 히스토리 - LCU endpoint 시도 순서대로"""
    endpoints = [
        f'/lol/match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex={count}',
        f'/lol/match-history/v3/matchlist/account/{puuid}?begIndex=0&endIndex={count}',
    ]
    for ep in endpoints:
        try:
            data = lcu_get(session, ep)
            # 응답 구조 정규화
            if isinstance(data, dict):
                return data.get('games', {}).get('games', data.get('games', []))
            if isinstance(data, list):
                return data
        except Exception as e:
            print(f"  endpoint {ep} 실패: {e}")
    return []


def normalize_participant(p: dict):  # -> Optional[dict]
    """LCU participant → 서버 payload 형식으로 변환"""
    puuid = (
        p.get('puuid') or
        p.get('playerToken') or
        ''
    )
    if not puuid:
        return None

    stats = p.get('stats', p)  # stats 서브객체 or 루트

    augments = []
    for i in range(1, 5):
        v = stats.get(f'playerAugment{i}') or stats.get(f'augment{i}')
        if v and int(v) > 0:
            augments.append(int(v))

    return {
        'puuid':                        puuid,
        'championId':                   int(p.get('championId', 0)),
        'championName':                 p.get('championName', ''),
        'teamId':                       int(stats.get('teamId', p.get('teamId', 0))),
        'win':                          bool(stats.get('win', False)),
        'kills':                        int(stats.get('kills', 0)),
        'deaths':                       int(stats.get('deaths', 0)),
        'assists':                      int(stats.get('assists', 0)),
        'totalDamageDealtToChampions':  int(stats.get('totalDamageDealtToChampions', 0)),
        'totalDamageTaken':             int(stats.get('totalDamageTaken', 0)),
        'totalHeal':                    int(stats.get('totalHeal', 0)),
        'goldEarned':                   int(stats.get('goldEarned', 0)),
        'totalTimeCCDealt':             int(stats.get('totalTimeCCDealt', 0)),
        'augments':                     augments,
    }


def normalize_game(raw: dict):  # -> Optional[dict]
    """LCU game → 서버 payload 형식"""
    queue = int(raw.get('queueId', raw.get('queue', {}).get('id', -1)))
    if queue != QUEUE_ID:
        return None

    # gameId 조합
    game_id_raw = str(raw.get('gameId', ''))
    game_id = game_id_raw if game_id_raw.startswith('OC1_') else f'OC1_{game_id_raw}'

    participants = []
    for p in raw.get('participants', []):
        n = normalize_participant(p)
        if n:
            participants.append(n)

    if not participants:
        return None

    return {
        'gameId':       game_id,
        'queueId':      queue,
        'gameCreation': int(raw.get('gameCreation', 0)),
        'gameDuration': int(raw.get('gameDuration', 0)),
        'participants': participants,
    }

# ─── 디버그 모드 ──────────────────────────────────────────────────────────────

def run_debug(session: requests.Session, puuid: str):
    print("\n=== DEBUG MODE ===\n")

    # 1. /lol/login 확인
    print("[1] 현재 로그인 정보")
    try:
        # summoner 엔드포인트 시도
        for ep in ['/lol/summoner/v1/current-summoner', '/lol/login/v1/session']:
            try:
                me = lcu_get(session, ep)
                if isinstance(me, dict) and me.get('puuid'):
                    print(f"  endpoint: {ep}")
                    print(f"  puuid: {str(me.get('puuid', '?'))[:25]}...")
                    print(f"  displayName: {me.get('displayName', me.get('summonerName', '?'))}")
                    break
            except Exception:
                continue
    except Exception as e:
        print(f"  실패: {e}")

    # 2. match history raw
    print("\n[2] Match History (raw 첫 3경기)")
    raw_games = get_match_history(session, puuid, count=20)
    print(f"  총 {len(raw_games)}경기 반환")

    mayhem_games = []
    for i, g in enumerate(raw_games[:3]):
        queue = g.get('queueId', g.get('queue', {}).get('id', '?'))
        gid = g.get('gameId', '?')
        gc = g.get('gameCreation', 0)
        dur = g.get('gameDuration', 0)
        n_parts = len(g.get('participants', []))
        print(f"\n  Game {i+1}:")
        print(f"    gameId:       {gid}")
        print(f"    queueId:      {queue}")
        print(f"    gameCreation: {gc}")
        print(f"    gameDuration: {dur}s")
        print(f"    participants: {n_parts}명")
        if n_parts > 0:
            p0 = g['participants'][0]
            print(f"    participant[0] keys: {list(p0.keys())[:15]}")
            stats0 = p0.get('stats', {})
            print(f"    participant[0].stats keys: {list(stats0.keys())[:15]}")
        if int(queue) == QUEUE_ID:
            mayhem_games.append(g)

    # 3. Mayhem 전용 확인
    print(f"\n[3] queueId {QUEUE_ID} (ARAM Mayhem) 경기")
    all_games = get_match_history(session, puuid, count=FETCH_COUNT)
    mayhem_all = [g for g in all_games if int(g.get('queueId', g.get('queue', {}).get('id', -1))) == QUEUE_ID]
    print(f"  총 {len(mayhem_all)}경기 발견")
    if mayhem_all:
        g = mayhem_all[0]
        print(f"\n  최신 Mayhem 게임 raw dump:")
        print(json.dumps(g, indent=2, ensure_ascii=False)[:3000])

# ─── 메인 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--debug', action='store_true', help='진단 모드 (서버 전송 안 함)')
    args = parser.parse_args()

    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except ImportError:
        pass

    print("ARAM Squad Stats LCU Agent")
    print("-" * 40)

    # 1. lockfile
    print("[1] lockfile 탐색...")
    lf = find_lockfile()
    if not lf:
        print("  ✗ League Client가 실행 중이지 않습니다.")
        sys.exit(1)
    print(f"  ✓ {lf}")
    lock = parse_lockfile(lf)
    print(f"  port={lock['port']}")

    # 2. 세션
    print("[2] LCU 연결...")
    session = lcu_session(lock['port'], lock['password'])

    # 3. PUUID
    print("[3] 현재 계정 확인...")
    try:
        puuid = get_current_puuid(session)
        print(f"  puuid: {puuid[:25]}...")
    except Exception as e:
        print(f"  ✗ 로그인 정보 조회 실패: {e}")
        sys.exit(1)

    if puuid not in TRACKED_PUUIDS:
        print(f"  ✗ 이 계정은 tracked 목록에 없습니다. Hoodville 계정으로 로그인하세요.")
        sys.exit(1)
    print(f"  ✓ tracked 계정 확인")

    # debug 모드
    if args.debug:
        run_debug(session, puuid)
        return

    # 4. 매치 히스토리
    print(f"[4] 매치 히스토리 조회 (최근 {FETCH_COUNT}경기)...")
    raw_games = get_match_history(session, puuid, FETCH_COUNT)
    print(f"  전체 {len(raw_games)}경기")

    # 5. Mayhem 필터 + 정규화
    games_payload = []
    for raw in raw_games:
        norm = normalize_game(raw)
        if not norm:
            continue
        # 4명 다 있는지
        puuids_in_game = {p['puuid'] for p in norm['participants']}
        if not TRACKED_PUUIDS.issubset(puuids_in_game):
            print(f"  skip {norm['gameId']} (4명 미충족: {len(puuids_in_game & TRACKED_PUUIDS)}/4)")
            continue
        games_payload.append(norm)

    print(f"  Mayhem 4인 게임: {len(games_payload)}경기")

    if not games_payload:
        print("  전송할 게임 없음.")
        return

    # 6. 서버 전송
    if not LCU_SECRET:
        print("\n✗ LCU_SYNC_SECRET 환경변수가 설정되지 않았습니다.")
        print("  set LCU_SYNC_SECRET=your-secret 후 재실행하세요.")
        sys.exit(1)

    print(f"[5] 서버 전송 ({SERVER_URL})...")
    resp = requests.post(SERVER_URL, json={
        'secret': LCU_SECRET,
        'games': games_payload,
    }, timeout=30)

    print(f"  HTTP {resp.status_code}")
    result = resp.json()
    print(f"  synced:  {result.get('synced', '?')}")
    print(f"  skipped: {result.get('skipped', '?')}")
    if result.get('errors'):
        print(f"  errors:  {result['errors']}")
    print("\n완료!")


if __name__ == '__main__':
    main()
