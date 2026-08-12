import { resolve } from "node:path";

export function loadConfig(overrides = {}) {
  const home = resolve(overrides.home ?? process.env.HEXWITNESS_HOME ?? ".hexwitness");
  return {
    home,
    evidenceDb: resolve(overrides.evidenceDb ?? process.env.HEXWITNESS_DB ?? `${home}/evidence.db`),
    activityDb: resolve(overrides.activityDb ?? process.env.HEXWITNESS_ACTIVITY_DB ?? `${home}/activity.db`),
    host: overrides.host ?? process.env.HEXWITNESS_HOST ?? "127.0.0.1",
    port: Number(overrides.port ?? process.env.HEXWITNESS_PORT ?? 7878),
    apiToken: overrides.apiToken ?? process.env.HEXWITNESS_API_TOKEN ?? "",
    activityLog: String(overrides.activityLog ?? process.env.HEXWITNESS_ACTIVITY_LOG ?? "1") !== "0",
    retentionDays: Number(overrides.retentionDays ?? process.env.HEXWITNESS_ACTIVITY_RETENTION_DAYS ?? 30),
  };
}
