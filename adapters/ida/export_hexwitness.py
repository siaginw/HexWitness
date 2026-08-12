"""IDA Pro / IDAPython exporter for HexWitness.

Use File -> Script file, or:
    IDAPython> exec(open(r"C:\path\to\HexWitness\adapters\ida\export_hexwitness.py").read())
"""

import hashlib
import json
import os
from datetime import datetime, timezone

import ida_funcs  # type: ignore
import ida_ida  # type: ignore
import ida_nalt  # type: ignore
import idaapi  # type: ignore
import idautils  # type: ignore
import idc  # type: ignore


FORMAT = "hexwitness-jsonl-v1"


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def emit(stream, record, **fields):
    fields.update({"format": FORMAT, "record": record})
    stream.write(json.dumps(fields, sort_keys=True) + "\n")


input_path = ida_nalt.get_input_file_path()
digest = sha256_file(input_path)
build_id = os.environ.get("HEXWITNESS_BUILD_ID", "sha256:" + digest[:16])
output = os.environ.get("HEXWITNESS_OUTPUT", input_path + ".hexwitness.jsonl")
image_base = ida_nalt.get_imagebase()

with open(output, "w", encoding="utf-8", newline="\n") as stream:
    emit(stream, "build", build_id=build_id, label=os.path.basename(input_path), sha256=digest,
         architecture=ida_ida.inf_get_procname(), image_base=hex(image_base), tool="ida",
         tool_version=idaapi.get_kernel_version(), created_utc=datetime.now(timezone.utc).isoformat(),
         metadata={"decompilation_included": False})
    emit(stream, "artifact", build_id=build_id, role="executable", path_hint=os.path.basename(input_path),
         sha256=digest, size_bytes=os.path.getsize(input_path))

    functions = list(idautils.Functions())
    function_starts = set(functions)
    for start in functions:
        function = ida_funcs.get_func(start)
        emit(stream, "entity", build_id=build_id, kind="function", stable_key="fn:" + hex(start),
             name=idc.get_func_name(start), address=hex(start), size=function.end_ea - start,
             signature=idc.get_type(start))

    for start in functions:
        for instruction in idautils.FuncItems(start):
            if not idc.is_call_insn(instruction):
                continue
            for target in idautils.CodeRefsFrom(instruction, False):
                target_function = ida_funcs.get_func(target)
                if target_function and target_function.start_ea in function_starts:
                    emit(stream, "edge", build_id=build_id, kind="call", source="fn:" + hex(start),
                         target="fn:" + hex(target_function.start_ea), source_address=hex(instruction),
                         target_address=hex(target_function.start_ea))

print("HexWitness export written:", output)
