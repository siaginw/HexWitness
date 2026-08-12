"""Binary Ninja exporter for HexWitness.

Run from Binary Ninja's Python console:
    exec(open(r"C:\path\to\HexWitness\adapters\binary-ninja\export_hexwitness.py").read())

Environment:
    HEXWITNESS_OUTPUT       output JSONL path
    HEXWITNESS_BUILD_ID     stable build label; SHA-256 is used when omitted
    HEXWITNESS_DECOMP=1     include HLIL text (off by default)
"""

import hashlib
import json
import os
from datetime import datetime, timezone

from binaryninja import BinaryView, core_version_info  # type: ignore


FORMAT = "hexwitness-jsonl-v1"


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def emit(stream, record, **fields):
    fields.update({"format": FORMAT, "record": record})
    stream.write(json.dumps(fields, sort_keys=True) + "\n")


def export(view):
    input_path = view.file.filename
    digest = sha256_file(input_path)
    build_id = os.environ.get("HEXWITNESS_BUILD_ID", "sha256:" + digest[:16])
    output = os.environ.get("HEXWITNESS_OUTPUT", input_path + ".hexwitness.jsonl")
    include_decomp = os.environ.get("HEXWITNESS_DECOMP") == "1"

    with open(output, "w", encoding="utf-8", newline="\n") as stream:
        emit(stream, "build", build_id=build_id, label=os.path.basename(input_path), sha256=digest,
             architecture=view.arch.name, image_base=hex(view.start), tool="binary-ninja",
             tool_version=str(core_version_info()), created_utc=datetime.now(timezone.utc).isoformat(),
             metadata={"decompilation_included": include_decomp})
        emit(stream, "artifact", build_id=build_id, role="executable", path_hint=os.path.basename(input_path),
             sha256=digest, size_bytes=os.path.getsize(input_path))

        for function in view.functions:
            stable_key = "fn:" + hex(function.start)
            fields = dict(build_id=build_id, kind="function", stable_key=stable_key,
                          name=function.name, address=hex(function.start),
                          size=max(0, function.highest_address - function.start),
                          signature=str(function.function_type))
            if include_decomp and function.hlil is not None:
                fields["decompiler"] = str(function.hlil)
            emit(stream, "entity", **fields)

        seen_strings = set()
        for string in view.strings:
            key = "str:" + hex(string.start)
            seen_strings.add(string.start)
            emit(stream, "entity", build_id=build_id, kind="string", stable_key=key,
                 name=str(string.value), address=hex(string.start), size=string.length,
                 metadata={"encoding": str(string.type)})

        for function in view.functions:
            source = "fn:" + hex(function.start)
            for callee in function.callees:
                emit(stream, "edge", build_id=build_id, kind="call", source=source,
                     target="fn:" + hex(callee.start), target_address=hex(callee.start))
            for reference in view.get_code_refs(function.start):
                caller = reference.function
                if caller and caller.start != function.start:
                    emit(stream, "edge", build_id=build_id, kind="code_reference",
                         source="fn:" + hex(caller.start), target=source,
                         source_address=hex(reference.address), target_address=hex(function.start))

    print("HexWitness export written:", output)


view = globals().get("bv")
if not isinstance(view, BinaryView):
    raise RuntimeError("Open a BinaryView and run this script from Binary Ninja's Python console")
export(view)
