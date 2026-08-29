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

SERVER_URL      = "https://aram-squad-stats.vercel.app/api/lcu-sync"
LAST_SYNC_URL   = "https://aram-squad-stats.vercel.app/api/last-sync"
LCU_SECRET  = os.environ.get("LCU_SYNC_SECRET", "")  # 환경변수 or 직접 입력
QUEUE_ID    = 2400   # ARAM Mayhem
FETCH_COUNT = 20     # 최근 N경기 조회 (LCU 타임아웃 방지)

# gameName → (LCU puuid, Riot puuid)
TRACKED_PLAYERS = {
    "Hoodville":     ("ea1d50c7-d4dd-56fd-be40-c663777c8af2", "fMM-QQxR_KvThTZ-4xaqn_XzyPLrzBKx8qL-6lyw1OfyabCpv8NWGYMt_v836xmLJRhO1mO55RXilg"),
    "Interest Rate": ("322c77e2-d392-53d2-bef9-4179b94f99f6", "XqEwGu2HFUiWqO8AOrAPfCfKxSl1BzSLcFxV0HFfVan_YvQvfEdbfnXrVkfErFHtq27-la-U9e_ZgA"),
    "Nunu and Lulu": ("698e63c8-3061-5e08-833f-04c661202c8d", "Mx8gYVhZwzugCoBFQyoCfjESRpjTF6ZJN-8uTF1hqHwc9s9ke5rGTKnWFvfYGa6z8tAWnIxMdytYPg"),
    "just won lotto":("348d1a1c-9935-5b19-8d7f-60284f8c8511", "ScCA2JAvEUDKOL83IF0jnELmmCoPIWfi6qhZ6h-sTR7V18ZFgt8y4XhHHny3j5MXdowQlgPcsLjy2Q"),
}
TRACKED_NAMES    = set(TRACKED_PLAYERS.keys())
LCU_TO_RIOT_PUUID = {v[0]: v[1] for v in TRACKED_PLAYERS.values()}
LCU_PUUID_SET    = set(LCU_TO_RIOT_PUUID.keys())

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

    # fallback: 일반적인 경로 탐색 (LeagueClient 우선, RiotClient 제외)
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
    r = session.get(url, timeout=30)
    r.raise_for_status()
    return r.json()

# ─── 데이터 수집 ──────────────────────────────────────────────────────────────

def get_current_account(session: requests.Session):
    """현재 로그인 계정의 (lcu_puuid, gameName) 반환"""
    endpoints = [
        '/lol-summoner/v1/current-summoner',
        '/lol-login/v1/session',
        '/lol-chat/v1/me',
        '/lol-lobby/v2/lobby',
    ]
    for ep in endpoints:
        try:
            data = lcu_get(session, ep)
            if isinstance(data, dict):
                puuid = data.get('puuid', '')
                name = data.get('gameName', data.get('displayName', data.get('name', '')))
                if puuid and name:
                    print(f"  ✓ endpoint: {ep}")
                    return puuid, name
                elif puuid:
                    print(f"  - {ep} → puuid있음, gameName없음. keys: {list(data.keys())[:10]}")
                else:
                    print(f"  - {ep} → 응답있음, puuid없음. keys: {list(data.keys())[:10]}")
        except Exception as e:
            print(f"  - {ep} → {e}")
    raise RuntimeError("계정 정보를 가져올 수 없습니다")


def get_match_history(session: requests.Session, puuid: str, count: int = 200) -> list:
    """매치 히스토리 - gameId 목록 반환"""
    endpoints = [
        f'/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex={count}',
        f'/lol-match-history/v3/matchlist/account/{puuid}?begIndex=0&endIndex={count}',
    ]
    for ep in endpoints:
        try:
            data = lcu_get(session, ep)
            if isinstance(data, dict):
                return data.get('games', {}).get('games', data.get('games', []))
            if isinstance(data, list):
                return data
        except Exception as e:
            print(f"  endpoint {ep} 실패: {e}")
    return []


def get_game_detail(session: requests.Session, game_id: int) -> dict:
    """gameId로 전체 참여자 데이터 조회"""
    endpoints = [
        f'/lol-match-history/v1/games/{game_id}',
        f'/lol-match-history/v2/games/{game_id}',
    ]
    for ep in endpoints:
        try:
            data = lcu_get(session, ep)
            if isinstance(data, dict) and data.get('participants'):
                return data
        except Exception as e:
            print(f"  game detail {ep} 실패: {e}")
    return {}


def normalize_game_detail(raw: dict) -> dict:
    """game detail (10명 전체) → 서버 payload 형식"""
    queue = int(raw.get('queueId', -1))

    # participantId → gameName/LCU puuid 매핑
    pid_to_player = {}
    for ident in raw.get('participantIdentities', []):
        pid = ident['participantId']
        player = ident.get('player', {})
        pid_to_player[pid] = {
            'gameName': player.get('gameName', '').strip(),
            'lcu_puuid': player.get('puuid', ''),
        }

    participants = []
    for p in raw.get('participants', []):
        pid = p['participantId']
        player_info = pid_to_player.get(pid, {})
        game_name = player_info.get('gameName', '')
        lcu_puuid = player_info.get('lcu_puuid', '')

        # Riot PUUID로 변환 (tracked 플레이어만)
        riot_puuid = LCU_TO_RIOT_PUUID.get(lcu_puuid, lcu_puuid)

        stats = p.get('stats', {})
        augments = []
        for i in range(1, 5):
            v = stats.get(f'playerAugment{i}') or stats.get(f'augment{i}')
            if v and int(v) > 0:
                augments.append(int(v))

        item_ids = [
            int(stats.get(f'item{i}', 0) or 0)
            for i in range(6)
            if int(stats.get(f'item{i}', 0) or 0) > 0
        ]

        participants.append({
            'puuid':                       riot_puuid,
            'gameName':                    game_name,
            'championId':                  int(p.get('championId', 0)),
            'championName':                '',  # 서버에서 DDragon으로 채움
            'teamId':                      int(stats.get('teamId', p.get('teamId', 0))),
            'win':                         bool(stats.get('win', False)),
            'kills':                       int(stats.get('kills', 0)),
            'deaths':                      int(stats.get('deaths', 0)),
            'assists':                     int(stats.get('assists', 0)),
            'totalDamageDealtToChampions': int(stats.get('totalDamageDealtToChampions', 0)),
            'totalDamageTaken':            int(stats.get('totalDamageTaken', 0)),
            'totalHeal':                   int(stats.get('totalHeal', 0)),
            'goldEarned':                  int(stats.get('goldEarned', 0)),
            'totalTimeCCDealt':            int(stats.get('totalTimeCCDealt', 0)),
            'augments':                    augments,
            'itemIds':                     item_ids,
        })

    return {
        'gameId':       f'OC1_{raw["gameId"]}',
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
        for ep in ['/lol-summoner/v1/current-summoner', '/lol-login/v1/session']:
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
        game_id = g.get('gameId')
        print(f"\n  최신 Mayhem 게임 raw dump:")
        print(json.dumps(g, indent=2, ensure_ascii=False)[:3000])

        # 4. game detail 시도
        print(f"\n[4] game detail 조회 (gameId={game_id})")
        detail = get_game_detail(session, game_id)
        if detail:
            n_parts = len(detail.get('participants', []))
            n_ids = len(detail.get('participantIdentities', []))
            print(f"  participants: {n_parts}명")
            print(f"  participantIdentities: {n_ids}명")
            # 참여자 이름 출력
            for ident in detail.get('participantIdentities', []):
                player = ident.get('player', {})
                print(f"    participantId:{ident.get('participantId')} gameName:{player.get('gameName')} tag:{player.get('tagLine')}")
            print(f"\n  game detail raw dump:")
            print(json.dumps(detail, indent=2, ensure_ascii=False)[:2000])
        else:
            print(f"  ✗ game detail 조회 실패 (두 엔드포인트 모두 실패)")

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
    # 실행 중인 Riot/League 프로세스 먼저 출력
    print("  실행 중인 관련 프로세스:")
    found_league = False
    for proc in psutil.process_iter(['name', 'pid']):
        try:
            name = proc.info['name'] or ''
            if any(x in name.lower() for x in ['league', 'riot', 'lol']):
                print(f"    {name} (pid={proc.info['pid']})")
                if 'leagueclient' in name.lower() and 'ux' not in name.lower():
                    found_league = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    if not found_league:
        print("  ⚠ LeagueClient.exe가 안 보여요. 롤 클라이언트(로비 화면)까지 실행해주세요.")
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

    # 3. 현재 계정 gameName 확인
    print("[3] 현재 계정 확인...")
    try:
        puuid, game_name = get_current_account(session)
        print(f"  gameName: {game_name}")
        print(f"  puuid(LCU): {puuid[:25]}...")
    except Exception as e:
        print(f"  ✗ {e}")
        sys.exit(1)

    if game_name not in TRACKED_NAMES:
        print(f"  ✗ '{game_name}'은 tracked 목록에 없습니다.")
        print(f"  tracked: {TRACKED_NAMES}")
        sys.exit(1)
    print(f"  ✓ tracked 계정 확인 ({game_name})")

    # debug 모드
    if args.debug:
        run_debug(session, puuid)
        return

    # 4. 마지막 저장 시점 조회
    print("[4] 마지막 저장 시점 확인...")
    last_game_creation = 0
    try:
        r = requests.get(LAST_SYNC_URL, timeout=10)
        data = r.json()
        if data.get('last_played_at'):
            from datetime import datetime, timezone
            dt = datetime.fromisoformat(data['last_played_at'].replace('Z', '+00:00'))
            last_game_creation = int(dt.timestamp() * 1000)
            print(f"  마지막 저장: {data['last_played_at'][:10]} ({data['last_match_id']})")
        else:
            print("  저장된 게임 없음 → 전체 조회")
    except Exception as e:
        print(f"  확인 실패 ({e}) → 전체 조회")

    # 5. 매치 히스토리
    print(f"[5] 매치 히스토리 조회 (최근 {FETCH_COUNT}경기)...")
    raw_games = get_match_history(session, puuid, FETCH_COUNT)
    print(f"  전체 {len(raw_games)}경기")

    # 6. Mayhem 필터 → 마지막 저장 시점 이후 → game detail → 4인 확인
    games_payload = []
    mayhem_games = [g for g in raw_games
                    if int(g.get('queueId', g.get('queue', {}).get('id', -1))) == QUEUE_ID]
    # 마지막 저장 시점 이후 게임만
    if last_game_creation > 0:
        new_games = [g for g in mayhem_games if int(g.get('gameCreation', 0)) > last_game_creation]
        print(f"  Mayhem 전체:{len(mayhem_games)}개 → 새 게임:{len(new_games)}개 (마지막 저장 이후)")
        mayhem_games = new_games
    else:
        print(f"  Mayhem 경기: {len(mayhem_games)}개")

    for raw in mayhem_games:
        game_id = raw.get('gameId')
        detail = get_game_detail(session, game_id)
        if not detail:
            print(f"  skip OC1_{game_id} (game detail 조회 실패)")
            continue

        # 4명 다 있는지 LCU puuid 기준 확인
        lcu_puuids_in_game = {
            ident['player']['puuid']
            for ident in detail.get('participantIdentities', [])
        }
        if not LCU_PUUID_SET.issubset(lcu_puuids_in_game):
            found = len(LCU_PUUID_SET & lcu_puuids_in_game)
            print(f"  skip OC1_{game_id} (4명 미충족: {found}/4)")
            continue

        norm = normalize_game_detail(detail)
        games_payload.append(norm)
        print(f"  ✓ OC1_{game_id} 포함")

    print(f"  Mayhem 4인 게임: {len(games_payload)}경기")

    # payload 샘플 출력 (디버그용)
    if games_payload:
        sample = games_payload[0]
        print(f"\n  [payload 샘플] gameId: {sample['gameId']}")
        for p in sample['participants']:
            if p['gameName'] in TRACKED_NAMES:
                print(f"    {p['gameName']} | puuid:{p['puuid'][:20]}... | {p['kills']}/{p['deaths']}/{p['assists']}")

    if not games_payload:
        print("  전송할 게임 없음.")
        return

    # 6. 서버 전송 (배치로 나눠서)
    if not LCU_SECRET:
        print("\n✗ LCU_SYNC_SECRET 환경변수가 설정되지 않았습니다.")
        print("  set LCU_SYNC_SECRET=your-secret 후 재실행하세요.")
        sys.exit(1)

    BATCH_SIZE = 3
    total_synced = 0
    total_skipped = 0
    total_errors = []

    batches = [games_payload[i:i+BATCH_SIZE] for i in range(0, len(games_payload), BATCH_SIZE)]
    print(f"[5] 서버 전송 ({len(batches)}배치 × {BATCH_SIZE}경기씩)...")

    for i, batch in enumerate(batches):
        print(f"  배치 {i+1}/{len(batches)} ({len(batch)}경기)...", end=' ', flush=True)
        try:
            resp = requests.post(SERVER_URL, json={
                'secret': LCU_SECRET,
                'games': batch,
            }, timeout=60)
            result = resp.json()
            synced  = result.get('synced', 0)
            skipped = result.get('skipped', 0)
            errors  = result.get('errors', [])
            total_synced  += synced
            total_skipped += skipped
            total_errors  += errors
            print(f"✓ synced:{synced} skipped:{skipped} HTTP:{resp.status_code}")
            if errors:
                print(f"    errors: {errors[:3]}")
        except Exception as e:
            print(f"✗ {e}")
            total_errors.append(str(e))

    print(f"\n완료! 총 synced:{total_synced} / skipped:{total_skipped}")
    if total_errors:
        print(f"errors: {total_errors[:5]}")


if __name__ == '__main__':
    main()
