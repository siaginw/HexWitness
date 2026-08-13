export function downgradeFixtureToSchema1(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS entities_fts_insert;
    DROP TRIGGER IF EXISTS entities_fts_delete;
    DROP TRIGGER IF EXISTS entities_fts_update;
    DROP TRIGGER IF EXISTS events_fts_insert;
    DROP TRIGGER IF EXISTS events_fts_delete;
    DROP TRIGGER IF EXISTS events_fts_update;
    DROP TRIGGER IF EXISTS discovery_entity_insert;
    DROP TRIGGER IF EXISTS discovery_entity_delete;
    DROP TRIGGER IF EXISTS discovery_entity_update;
    DROP TRIGGER IF EXISTS discovery_evidence_insert;
    DROP TRIGGER IF EXISTS discovery_evidence_delete;
    DROP TRIGGER IF EXISTS discovery_evidence_update;
    DROP TRIGGER IF EXISTS discovery_claim_insert;
    DROP TRIGGER IF EXISTS discovery_claim_delete;
    DROP TRIGGER IF EXISTS discovery_claim_update;
    DROP TRIGGER IF EXISTS discovery_event_insert;
    DROP TRIGGER IF EXISTS discovery_event_delete;
    DROP TRIGGER IF EXISTS discovery_event_update;
    DROP TRIGGER IF EXISTS discovery_investigation_insert;
    DROP TRIGGER IF EXISTS discovery_investigation_delete;
    DROP TRIGGER IF EXISTS discovery_investigation_update;
    DROP TRIGGER IF EXISTS discovery_attempt_insert;
    DROP TRIGGER IF EXISTS discovery_attempt_delete;
    DROP TRIGGER IF EXISTS discovery_attempt_update;
    DROP TABLE IF EXISTS entities_fts;
    DROP TABLE IF EXISTS events_fts;
    DROP TABLE IF EXISTS discovery_fts;
    DROP TABLE IF EXISTS capture_artifacts;
    DROP TABLE IF EXISTS markers;
    DROP TABLE IF EXISTS relationships;
    DROP TABLE IF EXISTS analysis_slices;
    DROP TABLE IF EXISTS gaps;
    DROP TABLE IF EXISTS investigation_usage;
    DROP TABLE IF EXISTS failed_attempt_evidence;
    DROP TABLE IF EXISTS failed_attempts;
    DROP TABLE IF EXISTS investigation_items;
    DROP TABLE IF EXISTS investigations;
    DROP INDEX IF EXISTS idx_events_kind_name;
    DELETE FROM meta WHERE key='fts_backfill_v1';
    DELETE FROM meta WHERE key='discovery_backfill_v1';
    UPDATE meta SET value='1' WHERE key='schema_version';
    PRAGMA user_version=1;
  `);
}

export function downgradeFixtureToSchema2(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS discovery_entity_insert;
    DROP TRIGGER IF EXISTS discovery_entity_delete;
    DROP TRIGGER IF EXISTS discovery_entity_update;
    DROP TRIGGER IF EXISTS discovery_evidence_insert;
    DROP TRIGGER IF EXISTS discovery_evidence_delete;
    DROP TRIGGER IF EXISTS discovery_evidence_update;
    DROP TRIGGER IF EXISTS discovery_claim_insert;
    DROP TRIGGER IF EXISTS discovery_claim_delete;
    DROP TRIGGER IF EXISTS discovery_claim_update;
    DROP TRIGGER IF EXISTS discovery_event_insert;
    DROP TRIGGER IF EXISTS discovery_event_delete;
    DROP TRIGGER IF EXISTS discovery_event_update;
    DROP TRIGGER IF EXISTS discovery_investigation_insert;
    DROP TRIGGER IF EXISTS discovery_investigation_delete;
    DROP TRIGGER IF EXISTS discovery_investigation_update;
    DROP TRIGGER IF EXISTS discovery_attempt_insert;
    DROP TRIGGER IF EXISTS discovery_attempt_delete;
    DROP TRIGGER IF EXISTS discovery_attempt_update;
    DROP TABLE IF EXISTS discovery_fts;
    DROP TABLE IF EXISTS investigation_usage;
    DROP TABLE IF EXISTS failed_attempt_evidence;
    DROP TABLE IF EXISTS failed_attempts;
    DROP TABLE IF EXISTS investigation_items;
    DROP TABLE IF EXISTS investigations;
    DELETE FROM meta WHERE key='discovery_backfill_v1';
    UPDATE meta SET value='2' WHERE key='schema_version';
    PRAGMA user_version=2;
  `);
}
