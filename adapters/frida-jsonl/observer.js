/* Generic HexWitness Frida observer.
 *
 * Load with Frida, then call rpc.exports.configure({ hooks: [...] }). Hooks may
 * identify a module export or a module-relative offset. The observer emits
 * semantic metadata only; it never reads arbitrary payload bytes.
 */

const installed = [];

function utcNow() { return new Date().toISOString(); }

function pointerValue(value, type) {
  try {
    if (type === "u32") return value.toUInt32();
    if (type === "i32") return value.toInt32();
    if (type === "u64") return value.toString();
    if (type === "cstring") return value.isNull() ? null : value.readCString();
    return value.toString();
  } catch (error) { return { error: String(error) }; }
}

function resolveHook(hook) {
  if (hook.export) {
    return Module.getGlobalExportByName(hook.export);
  }
  if (!hook.module || hook.offset == null) throw new Error("hook requires export or module + offset");
  const module = Process.getModuleByName(hook.module);
  return module.base.add(ptr(hook.offset));
}

function install(hook) {
  const address = resolveHook(hook);
  const listener = Interceptor.attach(address, {
    onEnter(args) {
      this.started = Date.now();
      this.fields = {};
      for (const argument of hook.arguments ?? []) this.fields[argument.name] = pointerValue(args[argument.index], argument.type);
      send({ ts_utc: utcNow(), source: "frida-semantic", kind: "call-enter", name: hook.name,
        address: address.toString(), thread_id: Process.getCurrentThreadId(), fields: this.fields });
    },
    onLeave(retval) {
      send({ ts_utc: utcNow(), source: "frida-semantic", kind: "call-leave", name: hook.name,
        address: address.toString(), thread_id: Process.getCurrentThreadId(),
        fields: { duration_ms: Date.now() - this.started, return_value: pointerValue(retval, hook.return_type) } });
    },
  });
  installed.push(listener);
  return { name: hook.name, address: address.toString() };
}

rpc.exports = {
  configure(config) {
    if (!config || !Array.isArray(config.hooks)) throw new Error("configure requires hooks[]");
    return config.hooks.map(install);
  },
  marker(name, note) {
    send({ ts_utc: utcNow(), source: "frida-semantic", kind: "operator-marker", name, summary: note ?? null });
    return true;
  },
  detach() {
    while (installed.length) installed.pop().detach();
    return true;
  },
};
