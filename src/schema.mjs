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
  metadata_uuid TEXT,
  metadata_owner TEXT,
  metadata_offset INTEGER,
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

CREATE TABLE IF NOT EXISTS capture_artifacts(
  artifact_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL,
  role TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  media_type TEXT,
  event_count INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(capture_id,path),
  FOREIGN KEY(capture_id) REFERENCES captures(capture_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS markers(
  marker_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  ts_utc TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(capture_id,ordinal),
  FOREIGN KEY(capture_id) REFERENCES captures(capture_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships(
  relationship_id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(capture_id) REFERENCES captures(capture_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_slices(
  slice_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_address TEXT,
  end_address TEXT,
  text TEXT,
  operations_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gaps(
  gap_id TEXT PRIMARY KEY,
  build_id TEXT,
  capture_id TEXT,
  subject TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  missing_json TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT,
  created_utc TEXT NOT NULL,
  updated_utc TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE SET NULL,
  FOREIGN KEY(capture_id) REFERENCES captures(capture_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS investigations(
  investigation_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','blocked','complete','abandoned')),
  priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 0 AND 4),
  playbook_id TEXT,
  operation_budget INTEGER CHECK(operation_budget IS NULL OR operation_budget > 0),
  created_utc TEXT NOT NULL,
  updated_utc TEXT NOT NULL,
  completed_utc TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS investigation_items(
  item_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('objective','check','decision','note','entity','evidence','claim','gap','capture','attempt')),
  ref_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done','blocked','skipped')),
  ordinal INTEGER NOT NULL,
  required INTEGER NOT NULL DEFAULT 0 CHECK(required IN (0,1)),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_utc TEXT NOT NULL,
  updated_utc TEXT NOT NULL,
  UNIQUE(investigation_id,ordinal),
  FOREIGN KEY(investigation_id) REFERENCES investigations(investigation_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS failed_attempts(
  attempt_id TEXT PRIMARY KEY,
  investigation_id TEXT,
  build_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  method TEXT NOT NULL,
  expected_result TEXT NOT NULL,
  actual_result TEXT NOT NULL,
  lesson TEXT NOT NULL,
  tool TEXT,
  tool_version TEXT,
  observed_utc TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(investigation_id) REFERENCES investigations(investigation_id) ON DELETE SET NULL,
  FOREIGN KEY(build_id) REFERENCES builds(build_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS failed_attempt_evidence(
  attempt_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  PRIMARY KEY(attempt_id,evidence_id),
  FOREIGN KEY(attempt_id) REFERENCES failed_attempts(attempt_id) ON DELETE CASCADE,
  FOREIGN KEY(evidence_id) REFERENCES evidence(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS investigation_usage(
  usage_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  units INTEGER NOT NULL CHECK(units > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  ts_utc TEXT NOT NULL,
  FOREIGN KEY(investigation_id) REFERENCES investigations(investigation_id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_entities_build_kind_address ON entities(build_id,kind,address);
CREATE INDEX IF NOT EXISTS idx_entities_metadata_uuid ON entities(build_id,metadata_uuid COLLATE NOCASE) WHERE metadata_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_metadata_owner_offset ON entities(build_id,metadata_owner,metadata_offset) WHERE metadata_owner IS NOT NULL OR metadata_offset IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(build_id, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(build_id, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_edges_source_key ON edges(build_id, source_key);
CREATE INDEX IF NOT EXISTS idx_edges_target_key ON edges(build_id, target_key);
CREATE INDEX IF NOT EXISTS idx_edges_unresolved_source ON edges(build_id,source_key) WHERE source_entity_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_edges_unresolved_target ON edges(build_id,target_key) WHERE target_entity_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_build ON evidence(build_id, observed_utc);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(build_id, subject, predicate);
CREATE INDEX IF NOT EXISTS idx_events_address ON events(address);
CREATE INDEX IF NOT EXISTS idx_events_kind_name ON events(capture_id,kind,name);
CREATE INDEX IF NOT EXISTS idx_capture_artifacts_role ON capture_artifacts(capture_id,role);
CREATE INDEX IF NOT EXISTS idx_relationships_capture ON relationships(capture_id,kind);
CREATE INDEX IF NOT EXISTS idx_slices_entity ON analysis_slices(build_id,entity_key,kind);
CREATE INDEX IF NOT EXISTS idx_gaps_status ON gaps(status,priority,updated_utc);
CREATE INDEX IF NOT EXISTS idx_captures_build ON captures(build_id);
CREATE INDEX IF NOT EXISTS idx_gaps_build_status ON gaps(build_id,status,priority,updated_utc);
CREATE INDEX IF NOT EXISTS idx_investigations_build_status ON investigations(build_id,status,priority,updated_utc);
CREATE INDEX IF NOT EXISTS idx_investigation_items_kind ON investigation_items(investigation_id,kind,status);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_scope ON failed_attempts(build_id,investigation_id,observed_utc);
CREATE INDEX IF NOT EXISTS idx_investigation_usage ON investigation_usage(investigation_id,ts_utc);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  entity_id UNINDEXED, build_id UNINDEXED, kind UNINDEXED,
  name, stable_key, signature, decompiler, metadata
);
CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
  event_id UNINDEXED, capture_id UNINDEXED, source UNINDEXED, kind UNINDEXED, direction UNINDEXED,
  name, summary, fields
);
CREATE VIRTUAL TABLE IF NOT EXISTS discovery_fts USING fts5(
  ref UNINDEXED, build_id UNINDEXED, kind UNINDEXED, title, text, metadata
);

CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(entity_id,build_id,kind,name,stable_key,signature,decompiler,metadata)
  VALUES(new.entity_id,new.build_id,new.kind,new.name,new.stable_key,new.signature,new.decompiler,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities BEGIN
  DELETE FROM entities_fts WHERE entity_id=old.entity_id;
END;
CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities BEGIN
  DELETE FROM entities_fts WHERE entity_id=old.entity_id;
  INSERT INTO entities_fts(entity_id,build_id,kind,name,stable_key,signature,decompiler,metadata)
  VALUES(new.entity_id,new.build_id,new.kind,new.name,new.stable_key,new.signature,new.decompiler,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(event_id,capture_id,source,kind,direction,name,summary,fields)
  VALUES(new.event_id,new.capture_id,new.source,new.kind,new.direction,new.name,new.summary,new.fields_json);
END;
CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
  DELETE FROM events_fts WHERE event_id=old.event_id;
END;
CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
  DELETE FROM events_fts WHERE event_id=old.event_id;
  INSERT INTO events_fts(event_id,capture_id,source,kind,direction,name,summary,fields)
  VALUES(new.event_id,new.capture_id,new.source,new.kind,new.direction,new.name,new.summary,new.fields_json);
END;

CREATE TRIGGER IF NOT EXISTS discovery_entity_insert AFTER INSERT ON entities BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.entity_id,new.build_id,'entity',COALESCE(new.name,new.stable_key),COALESCE(new.signature,'')||' '||COALESCE(new.decompiler,'')||' '||new.stable_key,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS discovery_entity_delete AFTER DELETE ON entities BEGIN DELETE FROM discovery_fts WHERE ref=old.entity_id AND kind='entity'; END;
CREATE TRIGGER IF NOT EXISTS discovery_entity_update AFTER UPDATE ON entities BEGIN
  DELETE FROM discovery_fts WHERE ref=old.entity_id AND kind='entity';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.entity_id,new.build_id,'entity',COALESCE(new.name,new.stable_key),COALESCE(new.signature,'')||' '||COALESCE(new.decompiler,'')||' '||new.stable_key,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS discovery_evidence_insert AFTER INSERT ON evidence BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.evidence_id,new.build_id,'evidence',new.summary,new.source||' '||new.source_ref||' '||new.summary,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS discovery_evidence_delete AFTER DELETE ON evidence BEGIN DELETE FROM discovery_fts WHERE ref=old.evidence_id AND kind='evidence'; END;
CREATE TRIGGER IF NOT EXISTS discovery_evidence_update AFTER UPDATE ON evidence BEGIN
  DELETE FROM discovery_fts WHERE ref=old.evidence_id AND kind='evidence';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.evidence_id,new.build_id,'evidence',new.summary,new.source||' '||new.source_ref||' '||new.summary,new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS discovery_claim_insert AFTER INSERT ON claims BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.claim_id,new.build_id,'claim',new.subject||' '||new.predicate,new.subject||' '||new.predicate||' '||new.object_json,json_object('subject',new.subject,'status',new.status));
END;
CREATE TRIGGER IF NOT EXISTS discovery_claim_delete AFTER DELETE ON claims BEGIN DELETE FROM discovery_fts WHERE ref=old.claim_id AND kind='claim'; END;
CREATE TRIGGER IF NOT EXISTS discovery_claim_update AFTER UPDATE ON claims BEGIN
  DELETE FROM discovery_fts WHERE ref=old.claim_id AND kind='claim';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.claim_id,new.build_id,'claim',new.subject||' '||new.predicate,new.subject||' '||new.predicate||' '||new.object_json,json_object('subject',new.subject,'status',new.status));
END;
CREATE TRIGGER IF NOT EXISTS discovery_event_insert AFTER INSERT ON events BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.event_id,(SELECT build_id FROM captures WHERE capture_id=new.capture_id),'capture_event',new.name,new.source||' '||new.kind||' '||new.name||' '||COALESCE(new.summary,'')||' '||new.fields_json,json_object('capture_id',new.capture_id,'ordinal',new.ordinal));
END;
CREATE TRIGGER IF NOT EXISTS discovery_event_delete AFTER DELETE ON events BEGIN DELETE FROM discovery_fts WHERE ref=old.event_id AND kind='capture_event'; END;
CREATE TRIGGER IF NOT EXISTS discovery_event_update AFTER UPDATE ON events BEGIN
  DELETE FROM discovery_fts WHERE ref=old.event_id AND kind='capture_event';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.event_id,(SELECT build_id FROM captures WHERE capture_id=new.capture_id),'capture_event',new.name,new.source||' '||new.kind||' '||new.name||' '||COALESCE(new.summary,'')||' '||new.fields_json,json_object('capture_id',new.capture_id,'ordinal',new.ordinal));
END;
CREATE TRIGGER IF NOT EXISTS discovery_investigation_insert AFTER INSERT ON investigations BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.investigation_id,new.build_id,'investigation',new.title,new.question||' '||new.title,json_object('status',new.status,'playbook_id',new.playbook_id));
END;
CREATE TRIGGER IF NOT EXISTS discovery_investigation_delete AFTER DELETE ON investigations BEGIN DELETE FROM discovery_fts WHERE ref=old.investigation_id AND kind='investigation'; END;
CREATE TRIGGER IF NOT EXISTS discovery_investigation_update AFTER UPDATE ON investigations BEGIN
  DELETE FROM discovery_fts WHERE ref=old.investigation_id AND kind='investigation';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.investigation_id,new.build_id,'investigation',new.title,new.question||' '||new.title,json_object('status',new.status,'playbook_id',new.playbook_id));
END;
CREATE TRIGGER IF NOT EXISTS discovery_attempt_insert AFTER INSERT ON failed_attempts BEGIN
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.attempt_id,new.build_id,'failed_attempt',new.subject||' — '||new.method,new.subject||' '||new.method||' '||new.expected_result||' '||new.actual_result||' '||new.lesson,json_object('investigation_id',new.investigation_id,'tool',new.tool,'tool_version',new.tool_version));
END;
CREATE TRIGGER IF NOT EXISTS discovery_attempt_delete AFTER DELETE ON failed_attempts BEGIN DELETE FROM discovery_fts WHERE ref=old.attempt_id AND kind='failed_attempt'; END;
CREATE TRIGGER IF NOT EXISTS discovery_attempt_update AFTER UPDATE ON failed_attempts BEGIN
  DELETE FROM discovery_fts WHERE ref=old.attempt_id AND kind='failed_attempt';
  INSERT INTO discovery_fts(ref,build_id,kind,title,text,metadata) VALUES(new.attempt_id,new.build_id,'failed_attempt',new.subject||' — '||new.method,new.subject||' '||new.method||' '||new.expected_result||' '||new.actual_result||' '||new.lesson,json_object('investigation_id',new.investigation_id,'tool',new.tool,'tool_version',new.tool_version));
END;

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
