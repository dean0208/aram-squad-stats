-- Store completed item IDs for future ARAM build analysis.
-- Existing rows remain valid with an empty array until the next LCU sync.
alter table game_results
  add column if not exists item_ids int[] not null default '{}';

create index if not exists idx_game_results_item_ids
  on game_results using gin(item_ids);
