import { loadConfig } from "./config.mjs";

export class DaemonClient {
  constructor(overrides = {}) {
    const config = loadConfig(overrides);
    this.baseUrl = overrides.baseUrl ?? process.env.HEXWITNESS_URL ?? `http://${config.host}:${config.port}`;
    this.token = overrides.apiToken ?? config.apiToken;
    this.session = process.env.HEXWITNESS_AGENT_SESSION ?? `mcp-${process.pid}`;
  }

  async get(path, params = {}) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) if (value != null && value !== "") url.searchParams.set(key, String(value));
    const headers = { "x-hexwitness-session": this.session };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const response = await fetch(url, { headers });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `daemon returned ${response.status}`);
    return body;
  }
}
