export const EVIDENCE_SCHEMA_SQL = `
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS meta(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds(
  build_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sha256 TEXT,
  architecture TEXT,
  image_base TEXT,
  tool TEXT,
  tool_version TEXT,
  created_utc TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS artifacts(
  artifact_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL,
  role TEXT NOT NULL,
  path_hint TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entities(
  entity_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  stable_key TEXT NOT NULL,
  name TEXT,
  address TEXT,
  size INTEGER,
  namespace TEXT,
  signature TEXT,
  decompiler TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(build_id, stable_key),
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edges(
  edge_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  source_entity_id TEXT,
  target_entity_id TEXT,
  source_address TEXT,
  target_address TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE,
  FOREIGN KEY(source_entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE,
  FOREIGN KEY(target_entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence(
  evidence_id TEXT PRIMARY KEY,
  build_id TEXT,
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  observed_utc TEXT NOT NULL,
  confidence REAL NOT NULL,
  classification TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_sha256 TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entity_evidence(
  entity_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'supports',
  PRIMARY KEY(entity_id, evidence_id, relation),
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE,
  FOREIGN KEY(evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claims(
  claim_id TEXT PRIMARY KEY,
  build_id TEXT,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  confidence REAL NOT NULL,
  created_utc TEXT NOT NULL,
  updated_utc TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS claim_evidence(
  claim_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  stance TEXT NOT NULL DEFAULT 'supports',
  PRIMARY KEY(claim_id, evidence_id),
  FOREIGN KEY(claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE,
  FOREIGN KEY(evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS captures(
  capture_id TEXT PRIMARY KEY,
  build_id TEXT,
  scenario TEXT NOT NULL,
  started_utc TEXT,
  finished_utc TEXT,
  status TEXT NOT NULL,
  manifest_sha256 TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS events(
  event_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  ts_utc TEXT,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  direction TEXT,
  address TEXT,
  thread_id TEXT,
  body_len INTEGER,
  body_sha256 TEXT,
  confidence REAL NOT NULL,
  action_id TEXT,
  summary TEXT,
  fields_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(capture_id, ordinal),
  FOREIGN KEY(capture_id) REFERENCES captures(capture_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_runs(
  import_id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  started_utc TEXT NOT NULL,
  finished_utc TEXT,
  status TEXT NOT NULL,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_entities_build_address ON entities(build_id, address);
CREATE INDEX IF NOT EXISTS idx_entities_build_name ON entities(build_id, name);
CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(build_id, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(build_id, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_edges_source_key ON edges(build_id, source_key);
CREATE INDEX IF NOT EXISTS idx_edges_target_key ON edges(build_id, target_key);
CREATE INDEX IF NOT EXISTS idx_evidence_build ON evidence(build_id, observed_utc);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(build_id, subject, predicate);
CREATE INDEX IF NOT EXISTS idx_events_capture ON events(capture_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_events_address ON events(address);
`;

export const ACTIVITY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS activity(
  activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  transport TEXT NOT NULL,
  operation TEXT NOT NULL,
  args_sha256 TEXT NOT NULL,
  session_hash TEXT,
  duration_ms REAL NOT NULL,
  result_count INTEGER,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts_utc);
CREATE INDEX IF NOT EXISTS idx_activity_operation ON activity(operation, ts_utc);
`;
