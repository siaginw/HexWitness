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
try:
    import ida_hexrays  # type: ignore
except ImportError:
    ida_hexrays = None


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
include_decomp = os.environ.get("HEXWITNESS_DECOMP") == "1"

with open(output, "w", encoding="utf-8", newline="\n") as stream:
    emit(stream, "build", build_id=build_id, label=os.path.basename(input_path), sha256=digest,
         architecture=ida_ida.inf_get_procname(), image_base=hex(image_base), tool="ida",
         tool_version=idaapi.get_kernel_version(), created_utc=datetime.now(timezone.utc).isoformat(),
         metadata={"decompilation_included": include_decomp and ida_hexrays is not None})
    emit(stream, "artifact", build_id=build_id, role="executable", path_hint=os.path.basename(input_path),
         sha256=digest, size_bytes=os.path.getsize(input_path))

    functions = list(idautils.Functions())
    function_starts = set(functions)
    for start in functions:
        function = ida_funcs.get_func(start)
        emit(stream, "entity", build_id=build_id, kind="function", stable_key="fn:" + hex(start),
             name=idc.get_func_name(start), address=hex(start), size=function.end_ea - start,
             signature=idc.get_type(start))
        if include_decomp and ida_hexrays is not None:
            try:
                text = str(ida_hexrays.decompile(start))
                emit(stream, "slice", build_id=build_id, entity_key="fn:" + hex(start), kind="pseudocode",
                     start_address=hex(start), end_address=hex(function.end_ea), text=text,
                     metadata={"tool": "ida-hexrays"})
            except Exception:
                pass
        flowchart = idaapi.FlowChart(function)
        blocks = list(flowchart)
        block_indexes = {block.start_ea: index for index, block in enumerate(blocks)}
        for index, block in enumerate(blocks):
            block_key = "bb:%s:%d" % (hex(start), index)
            emit(stream, "entity", build_id=build_id, kind="basic_block", stable_key=block_key,
                 name="%s:block_%d" % (idc.get_func_name(start), index), address=hex(block.start_ea),
                 size=block.end_ea - block.start_ea, metadata={"function": "fn:" + hex(start), "index": index})
            emit(stream, "edge", build_id=build_id, kind="contains", source="fn:" + hex(start), target=block_key)
            for successor in block.succs():
                target_index = block_indexes.get(successor.start_ea)
                if target_index is not None:
                    emit(stream, "edge", build_id=build_id, kind="control_flow", source=block_key,
                         target="bb:%s:%d" % (hex(start), target_index))

    for item in idautils.Strings():
        address = int(item.ea)
        key = "str:" + hex(address)
        emit(stream, "entity", build_id=build_id, kind="string", stable_key=key,
             name=str(item), address=hex(address), size=int(item.length), metadata={"encoding": str(item.strtype)})
        for reference in idautils.CodeRefsTo(address, False):
            owner = ida_funcs.get_func(reference)
            if owner:
                emit(stream, "edge", build_id=build_id, kind="references", source="fn:" + hex(owner.start_ea),
                     target=key, source_address=hex(reference), target_address=hex(address))

    def import_callback(ea, name, ordinal):
        stable = "import:" + (name or "ordinal_%d" % ordinal)
        emit(stream, "entity", build_id=build_id, kind="import", stable_key=stable,
             name=name or stable, address=hex(ea), metadata={"ordinal": ordinal})
        return True

    for module_index in range(ida_nalt.get_import_module_qty()):
        ida_nalt.enum_import_names(module_index, import_callback)

    for start in functions:
        for instruction in idautils.FuncItems(start):
            for target in idautils.CodeRefsFrom(instruction, False):
                target_function = ida_funcs.get_func(target)
                if target_function and target_function.start_ea in function_starts:
                    edge_kind = "call" if idc.is_call_insn(instruction) else "code_reference"
                    emit(stream, "edge", build_id=build_id, kind=edge_kind, source="fn:" + hex(start),
                         target="fn:" + hex(target_function.start_ea), source_address=hex(instruction),
                         target_address=hex(target_function.start_ea))

print("HexWitness export written:", output)
