function ftsQuery(query) {
  return String(query ?? "").trim().split(/\s+/).filter(Boolean).map((term) => `"${term.replaceAll('"', '""')}"*`).join(" OR ");
}

export function discover(db, { query, buildId = null, kinds = [], limit = 50 } = {}) {
  const text = String(query ?? "").trim();
  if (text.length < 2) throw new Error("discovery query must contain at least two characters");
  const allowed = Array.isArray(kinds) ? kinds.filter(Boolean) : String(kinds ?? "").split(",").filter(Boolean);
  const csv = allowed.join(",");
  const maximum = Math.max(1, Math.min(Number(limit) || 50, 250));
  const rows = db.prepare(`SELECT ref,build_id,kind,title,text,metadata,bm25(discovery_fts) AS rank FROM discovery_fts
    WHERE discovery_fts MATCH ? AND (? IS NULL OR build_id=?) AND (?='' OR INSTR(','||?||',',','||kind||',')>0)
    ORDER BY rank LIMIT ?`).all(ftsQuery(text), buildId, buildId, csv, csv, maximum);
  return {
    query: text, build_id: buildId, authority: "discovery-only",
    warning: "Retrieval similarity proposes candidates. Resolve exact build identity and query the source record before treating any result as evidence.",
    results: rows.map((row) => ({ ...row, metadata: (() => { try { return JSON.parse(row.metadata || "{}"); } catch { return {}; } })(), exact_followup: followup(row) })),
  };
}

function followup(row) {
  if (row.kind === "entity") return { tool: "hexwitness_explain", arguments: { build_id: row.build_id, entity_id: row.ref } };
  if (row.kind === "capture_event") return { tool: "hexwitness_capture_timeline", arguments: { capture_id: row.metadata ? (() => { try { return JSON.parse(row.metadata).capture_id; } catch { return null; } })() : null } };
  if (row.kind === "investigation") return { tool: "hexwitness_investigation_detail", arguments: { investigation_id: row.ref } };
  if (row.kind === "failed_attempt") return { tool: "hexwitness_failed_attempts", arguments: { build_id: row.build_id } };
  if (row.kind === "claim") return { tool: "hexwitness_evidence_challenge", arguments: { build_id: row.build_id, subject: row.metadata ? (() => { try { return JSON.parse(row.metadata).subject; } catch { return null; } })() : null } };
  return { tool: "hexwitness_evidence", arguments: { build_id: row.build_id } };
}

export function discoveryContext(db, options = {}) {
  const discovered = discover(db, options);
  const maxChars = Math.max(1000, Math.min(Number(options.maxChars) || 12000, 50000));
  const selected = []; let used = 0;
  for (const result of discovered.results) {
    const size = result.title.length + result.text.length + 200;
    if (selected.length && used + size > maxChars) break;
    selected.push(result); used += size;
  }
  return { ...discovered, results: selected, context_chars: used, truncated: selected.length < discovered.results.length, augmentation_policy: ["discovery only", "follow exact query", "inspect provenance", "challenge claims", "never infer cross-build identity"] };
}
