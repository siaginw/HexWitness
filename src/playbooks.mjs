const PLAYBOOKS = Object.freeze([
  {
    id: "binary",
    title: "Binary behavior investigation",
    purpose: "Resolve one build-scoped binary behavior from identity through static structure and bounded runtime proof.",
    preferred_adapters: ["binary-ninja", "ida", "ghidra", "frida-semantic", "frida-normalizer"],
    phases: [
      { id: "pin-build", title: "Pin exact artifact hash, architecture, image base, and analysis-tool version", required: true, evidence_classes: ["artifact", "static"] },
      { id: "resolve-subject", title: "Resolve subject identity, address, stable key, signature, and direct references", required: true, evidence_classes: ["static"] },
      { id: "bound-structure", title: "Retain the smallest call, dataflow, object-model, or IL slice that explains the candidate behavior", required: true, evidence_classes: ["static"] },
      { id: "runtime-proof", title: "Capture one controlled positive or negative runtime observation tied to the same build", required: true, evidence_classes: ["dynamic", "capture"] },
      { id: "challenge", title: "Challenge claims against supporting evidence, opposing evidence, contradictions, and open gaps", required: true, evidence_classes: ["documentary"] },
    ],
  },
  {
    id: "firmware",
    title: "Firmware image investigation",
    purpose: "Map one firmware behavior without losing container, component, architecture, or extracted-artifact provenance.",
    preferred_adapters: ["ghidra", "binary-ninja", "ida"],
    phases: [
      { id: "pin-image", title: "Hash the original firmware image and identify container, architecture, and extraction tool versions", required: true, evidence_classes: ["artifact"] },
      { id: "map-components", title: "Record extracted component hashes and parent-child provenance", required: true, evidence_classes: ["static"] },
      { id: "resolve-subject", title: "Resolve the target component and bounded static behavior", required: true, evidence_classes: ["static"] },
      { id: "validate", title: "Validate behavior with an authorized emulator, hardware observation, or reproducible negative result", required: true, evidence_classes: ["dynamic", "capture"] },
      { id: "challenge", title: "Challenge claims and record unresolved hardware or environment assumptions", required: true, evidence_classes: ["documentary"] },
    ],
  },
  {
    id: "network",
    title: "Network behavior investigation",
    purpose: "Correlate one isolated network action with exact endpoints, directions, messages, consumers, and outcomes.",
    preferred_adapters: ["frida-semantic", "frida-normalizer", "binary-ninja", "ida", "ghidra"],
    phases: [
      { id: "pin-build", title: "Pin endpoint build and capture context without retaining credentials or raw secrets", required: true, evidence_classes: ["artifact", "capture"] },
      { id: "isolate-action", title: "Record a marker-aligned bidirectional positive or negative scenario", required: true, evidence_classes: ["dynamic", "capture"] },
      { id: "normalize", title: "Normalize directions, message identities, lengths, hashes, correlations, and semantic hooks", required: true, evidence_classes: ["capture"] },
      { id: "resolve-consumer", title: "Resolve the smallest static producer or consumer needed to explain the event", required: true, evidence_classes: ["static"] },
      { id: "challenge", title: "Challenge ordering, causality, retry, and missing-response claims", required: true, evidence_classes: ["documentary"] },
    ],
  },
  {
    id: "protocol",
    title: "Protocol reconstruction",
    purpose: "Prove one protocol field or message contract across wire shape, semantic consumer, and boundary behavior.",
    preferred_adapters: ["frida-semantic", "frida-normalizer", "binary-ninja", "ida", "ghidra"],
    phases: [
      { id: "pin-build", title: "Pin every compared endpoint and artifact build", required: true, evidence_classes: ["artifact"] },
      { id: "positive-negative", title: "Retain isolated positive and negative message observations with markers", required: true, evidence_classes: ["capture"] },
      { id: "codec-slice", title: "Retain bounded encode/decode and validation slices", required: true, evidence_classes: ["static"] },
      { id: "roundtrip", title: "Prove field boundaries, direction, optionality, and roundtrip behavior with synthetic fixtures", required: true, evidence_classes: ["synthetic"] },
      { id: "challenge", title: "Challenge inferred semantics and list every unproven field", required: true, evidence_classes: ["documentary"] },
    ],
  },
  {
    id: "runtime",
    title: "Runtime-state investigation",
    purpose: "Reconstruct one state transition from operator action through runtime publications and terminal cleanup.",
    preferred_adapters: ["frida-semantic", "frida-normalizer", "binary-ninja", "ida"],
    phases: [
      { id: "preconditions", title: "Record exact build, actor/object identity, starting state, and controlled preconditions", required: true, evidence_classes: ["artifact", "capture"] },
      { id: "action", title: "Mark one bounded action and retain safe semantic and directional events", required: true, evidence_classes: ["dynamic", "capture"] },
      { id: "transition", title: "Correlate request, state mutation, publications, rejection paths, and terminal cleanup", required: true, evidence_classes: ["capture"] },
      { id: "static-owner", title: "Resolve the smallest static state owner or condition evaluator", required: true, evidence_classes: ["static"] },
      { id: "challenge", title: "Challenge causality, persistence, cleanup, and observer-visible effects", required: true, evidence_classes: ["documentary"] },
    ],
  },
]);

export function listPlaybooks() {
  return PLAYBOOKS.map(({ phases, ...playbook }) => ({ ...playbook, phase_count: phases.length, required_checks: phases.filter((phase) => phase.required).length }));
}

export function getPlaybook(id) {
  const playbook = PLAYBOOKS.find((entry) => entry.id === id);
  if (!playbook) throw new Error(`unknown playbook: ${id}`);
  return structuredClone(playbook);
}
