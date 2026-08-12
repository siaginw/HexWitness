export function downgradeFixtureToSchema1(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS entities_fts_insert;
    DROP TRIGGER IF EXISTS entities_fts_delete;
    DROP TRIGGER IF EXISTS entities_fts_update;
    DROP TRIGGER IF EXISTS events_fts_insert;
    DROP TRIGGER IF EXISTS events_fts_delete;
    DROP TRIGGER IF EXISTS events_fts_update;
    DROP TABLE IF EXISTS entities_fts;
    DROP TABLE IF EXISTS events_fts;
    DROP TABLE IF EXISTS capture_artifacts;
    DROP TABLE IF EXISTS markers;
    DROP TABLE IF EXISTS relationships;
    DROP TABLE IF EXISTS analysis_slices;
    DROP TABLE IF EXISTS gaps;
    DROP INDEX IF EXISTS idx_events_kind_name;
    DELETE FROM meta WHERE key='fts_backfill_v1';
    UPDATE meta SET value='1' WHERE key='schema_version';
    PRAGMA user_version=1;
  `);
}
