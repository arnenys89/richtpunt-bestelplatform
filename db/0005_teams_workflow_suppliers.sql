-- Richtpunt Bestelplatform: teams, workflow, leverancierkoppelingen en historiek.
-- Uitvoeren als een eenmalige D1-migratie nadat de bestaande basisschema's
-- en migraties 0002 t.e.m. 0004 zijn toegepast.

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  campus TEXT NOT NULL CHECK (campus IN ('Ninove','Zottegem','Beide campussen')),
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('member','coordinator')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(team_id,user_id)
);

CREATE TABLE IF NOT EXISTS supplier_proposals (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 3),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_item_id,rank),
  UNIQUE(order_item_id,supplier_id)
);

CREATE TABLE IF NOT EXISTS information_request_events (
  id TEXT PRIMARY KEY,
  information_request_id TEXT NOT NULL REFERENCES information_requests(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_proposals_item ON supplier_proposals(order_item_id,rank);
CREATE INDEX IF NOT EXISTS idx_information_requests_item ON information_requests(order_item_id,requested_at);
