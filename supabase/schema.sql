-- ARAM Squad Stats Schema

-- Players
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  puuid text unique not null,
  game_name text not null,
  tag_line text not null,
  created_at timestamptz default now()
);

-- Games (one row per ARAM match)
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  match_id text unique not null,
  played_at timestamptz not null,
  duration_seconds int not null,
  our_team_win boolean not null,
  our_team_id int not null,
  created_at timestamptz default now()
);

-- Per-player per-game stats
create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  player_id uuid references players(id),
  champion_id int not null,
  champion_name text not null,
  kills int default 0,
  deaths int default 0,
  assists int default 0,
  damage_dealt int default 0,
  damage_taken int default 0,
  healing int default 0,
  gold_earned int default 0,
  cc_score real default 0,
  augment_ids int[] default '{}',
  item_ids int[] not null default '{}',
  -- Computed scores (stored for fast queries)
  perf_score real default 0,
  contribution_score real default 0,
  created_at timestamptz default now(),
  unique(game_id, player_id)
);

-- Champion role metadata (for synergy/composition analysis)
create table if not exists champion_roles (
  champion_id int primary key,
  champion_name text not null,
  primary_role text not null, -- CARRY, TANK, ENGAGE, PEEL, HEALER, UTILITY
  provides text[] default '{}', -- CC, FRONT, HEAL, PEEL, RANGE_DMG, ENGAGE
  needs text[] default '{}'
);

-- Indexes for performance
create index if not exists idx_game_results_game_id on game_results(game_id);
create index if not exists idx_game_results_player_id on game_results(player_id);
create index if not exists idx_games_played_at on games(played_at desc);
create index if not exists idx_games_match_id on games(match_id);
