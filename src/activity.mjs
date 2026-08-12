import { openActivityDb } from "./db.mjs";
import { nowUtc, sha256 } from "./util.mjs";

export class ActivityLog {
  constructor(path, { enabled = true, retentionDays = 30 } = {}) {
    this.enabled = enabled;
    this.retentionDays = retentionDays;
    this.db = enabled ? openActivityDb(path) : null;
  }

  record({ transport, operation, args, session, durationMs, resultCount, status }) {
    if (!this.db) return;
    this.db.prepare(`INSERT INTO activity(ts_utc,transport,operation,args_sha256,session_hash,duration_ms,result_count,status)
      VALUES(?,?,?,?,?,?,?,?)`).run(nowUtc(), transport, operation, sha256(JSON.stringify(args ?? {})),
      session ? sha256(session) : null, Number(durationMs), resultCount ?? null, status);
  }

  purge() {
    if (!this.db) return { deleted: 0 };
    const cutoff = new Date(Date.now() - this.retentionDays * 86400000).toISOString();
    const result = this.db.prepare("DELETE FROM activity WHERE ts_utc < ?").run(cutoff);
    return { deleted: Number(result.changes), cutoff };
  }

  summary(limit = 25) {
    if (!this.db) return { enabled: false, operations: [] };
    const operations = this.db.prepare(`SELECT operation,COUNT(*) AS calls,ROUND(AVG(duration_ms),2) AS avg_ms,
      SUM(CASE WHEN status='ok' THEN 0 ELSE 1 END) AS failures FROM activity GROUP BY operation ORDER BY calls DESC LIMIT ?`).all(limit);
    return { enabled: true, retention_days: this.retentionDays, operations };
  }

  close() { this.db?.close(); }
}
