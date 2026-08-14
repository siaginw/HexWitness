import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, delimiter, extname, isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { nowUtc } from "./util.mjs";
import { hashFileStreaming } from "./file-io.mjs";

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function findExecutable(name, base = process.cwd()) {
  if (isAbsolute(name)) return existsSync(name) ? realpathSync(resolve(name)) : null;
  if (name.includes("/") || name.includes("\\") || name.startsWith(".")) {
    const local = resolve(base, name);
    return existsSync(local) ? realpathSync(local) : null;
  }
  const extensions = process.platform === "win32" && !extname(name) ? String(process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const directory of String(process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      for (const suffix of new Set([extension, extension.toLowerCase(), extension.toUpperCase()])) {
        const candidate = resolve(directory, `${name}${suffix}`);
        if (existsSync(candidate)) return realpathSync(candidate);
      }
    }
  }
  return null;
}

function fileSha256(path) {
  return hashFileStreaming(path);
}

function scrubbedEnvironment() {
  const env = { ...process.env }; let removed = 0;
  const secretName = /(?:api[_-]?key|token|secret|password|passwd|private[_-]?key|credential|^openai|^anthropic|^github|^gitlab|^aws_|^azure_|^google_)/i;
  for (const name of Object.keys(env)) if (secretName.test(name)) { delete env[name]; removed += 1; }
  return { env, removed };
}

export function executionPolicy(overrides = {}) {
  const root = realpathSync(resolve(overrides.root ?? process.cwd()));
  const source = overrides.allow ?? ["file", "strings", "objdump", "llvm-objdump", "dumpbin", "readelf", "nm", "hexdump", "xxd", "radare2", "r2", "rabin2", "rz-bin", "binwalk", "tshark", "capinfos", "capa", "floss", "yara", "sigcheck", "python", "python3", "node"];
  const allow = (Array.isArray(source) ? source : String(source).split(",")).map((item) => String(item).trim()).filter(Boolean);
  return {
    enabled: true, root, allow,
    timeout_ms: Math.max(100, Math.min(Number(overrides.timeoutMs ?? 60000), 600000)),
    max_output_bytes: Math.max(4096, Math.min(Number(overrides.maxOutputBytes ?? 1048576), 16777216)),
    contract: { shell: false, allowlist_required: true, cwd_bounded_to_root: true, process_filesystem_sandboxed: false, secrets_allowed: false, persistence: "explicit-cli-observation-only" },
  };
}

export function localToolStatus(overrides = {}) {
  const policy = executionPolicy(overrides);
  return { ...policy, allow: policy.allow.map((name) => ({ name, resolved: findExecutable(name, policy.root) })), project_local_executables: "allowed when their real path remains inside root", warning: "Agent-callable local execution runs with the current user's permissions. Commands are argv-only, allowlisted or project-local, cwd-rooted, receipt-producing, and observation-only, but not OS-sandboxed. Never pass credentials as arguments." };
}

export async function runLocalTool({ executable, args = [], cwd = null, timeoutMs = null }, overrides = {}) {
  const policy = executionPolicy(overrides);
  const requested = String(executable ?? "").trim();
  if (!requested) throw new Error("executable is required");
  const workingDirectory = realpathSync(resolve(cwd ?? policy.root));
  if (!inside(policy.root, workingDirectory)) throw new Error(`working directory escapes execution root: ${workingDirectory}`);
  const resolvedExecutable = findExecutable(requested, workingDirectory);
  const requestedAbsolute = isAbsolute(requested);
  const allowedByList = policy.allow.some((entry) => {
    if (requestedAbsolute) return isAbsolute(entry) && resolve(entry).toLowerCase() === resolve(requested).toLowerCase();
    return !isAbsolute(entry) && basename(entry).toLowerCase() === basename(requested).toLowerCase();
  });
  const allowedProjectLocal = Boolean(resolvedExecutable && inside(policy.root, resolvedExecutable));
  if (!allowedByList && !allowedProjectLocal) throw new Error(`executable is neither allowlisted nor project-local: ${requested}`);
  if (!resolvedExecutable) throw new Error(`executable not found: ${requested}`);
  const executableStat = statSync(resolvedExecutable);
  const safeArgs = args.map((arg) => String(arg));
  if (safeArgs.length > 256) throw new Error("refusing more than 256 command arguments");
  if (safeArgs.some((arg) => arg.length > 32768)) throw new Error("refusing command argument longer than 32768 characters");
  if (safeArgs.some((arg) => /(?:api[_-]?key|token|password|secret)=/i.test(arg))) throw new Error("refusing credential-like command argument");
  const artifacts = [];
  for (const arg of safeArgs) {
    const unresolved = resolve(workingDirectory, arg);
    const candidate = existsSync(unresolved) ? realpathSync(unresolved) : unresolved;
    if (!inside(policy.root, candidate) || !existsSync(candidate)) continue;
    const stat = statSync(candidate);
    if (stat.isFile()) artifacts.push({ path: relative(policy.root, candidate) || basename(candidate), size_bytes: stat.size, sha256: fileSha256(candidate) });
  }
  const startedUtc = nowUtc(); const started = performance.now();
  const limit = policy.max_output_bytes; const timeout = Math.max(100, Math.min(Number(timeoutMs ?? policy.timeout_ms), 600000));
  const environment = scrubbedEnvironment();
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(resolvedExecutable, safeArgs, { cwd: workingDirectory, shell: false, windowsHide: true, env: environment.env });
    const stdout = []; const stderr = []; let stdoutBytes = 0; let stderrBytes = 0; let stdoutTruncated = false; let stderrTruncated = false; let timedOut = false;
    const collect = (chunks, chunk, which) => {
      const current = which === "stdout" ? stdoutBytes : stderrBytes;
      const remaining = Math.max(0, limit - current);
      if (remaining) chunks.push(chunk.subarray(0, remaining));
      if (which === "stdout") { stdoutBytes += Math.min(chunk.length, remaining); stdoutTruncated ||= chunk.length > remaining; }
      else { stderrBytes += Math.min(chunk.length, remaining); stderrTruncated ||= chunk.length > remaining; }
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk, "stdout"));
    child.stderr.on("data", (chunk) => collect(stderr, chunk, "stderr"));
    child.once("error", reject);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolveResult({ code, signal, timedOut, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), stdoutTruncated, stderrTruncated });
    });
  });
  const finishedUtc = nowUtc();
  const outputHash = createHash("sha256").update(result.stdout).update("\u001f").update(result.stderr).digest("hex");
  return {
    receipt_id: `exec_${randomUUID()}`, started_utc: startedUtc, finished_utc: finishedUtc, duration_ms: Math.round((performance.now() - started) * 100) / 100,
    executable: resolvedExecutable, executable_sha256: fileSha256(resolvedExecutable), executable_size_bytes: executableStat.size, executable_mtime_utc: executableStat.mtime.toISOString(),
    argv: safeArgs, cwd: relative(policy.root, workingDirectory) || ".", exit_code: result.code, signal: result.signal,
    timed_out: result.timedOut, stdout: result.stdout, stderr: result.stderr, stdout_truncated: result.stdoutTruncated, stderr_truncated: result.stderrTruncated,
    output_sha256: outputHash, input_artifacts: artifacts, environment_policy: "credential-shaped variables removed", environment_variables_removed: environment.removed, observation_only: true, creates_claim: false,
  };
}

export function recordToolObservation(db, buildId, receipt, summary = null) {
  if (!db.prepare("SELECT 1 FROM builds WHERE build_id=?").get(buildId)) throw new Error(`unknown build: ${buildId}`);
  const evidenceId = `evidence_${randomUUID()}`;
  const text = summary?.trim() || `${basename(receipt.executable)} exited ${receipt.exit_code ?? receipt.signal ?? "unknown"}; output retained by SHA-256 receipt.`;
  db.prepare(`INSERT INTO evidence(evidence_id,build_id,source,source_ref,observed_utc,confidence,classification,summary,payload_sha256,metadata_json)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(evidenceId, buildId, `local-tool:${basename(receipt.executable)}`, receipt.receipt_id, receipt.finished_utc, 1,
    "tool-observation", text, receipt.output_sha256, JSON.stringify({ receipt_id: receipt.receipt_id, started_utc: receipt.started_utc, finished_utc: receipt.finished_utc, duration_ms: receipt.duration_ms,
      executable: receipt.executable, executable_sha256: receipt.executable_sha256, executable_size_bytes: receipt.executable_size_bytes, executable_mtime_utc: receipt.executable_mtime_utc, argv: receipt.argv, cwd: receipt.cwd, exit_code: receipt.exit_code,
      signal: receipt.signal, timed_out: receipt.timed_out, input_artifacts: receipt.input_artifacts, stdout_truncated: receipt.stdout_truncated, stderr_truncated: receipt.stderr_truncated,
      output_sha256: receipt.output_sha256, output_retained: false, environment_policy: receipt.environment_policy, environment_variables_removed: receipt.environment_variables_removed,
      semantic_authority: false, freshness: receipt.finished_utc }));
  return { evidence_id: evidenceId, build_id: buildId, classification: "tool-observation", observation_only: true, claim_created: false };
}
