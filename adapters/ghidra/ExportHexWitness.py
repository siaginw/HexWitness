# Ghidra Jython script: exports functions and call edges without executable bytes.
# @category HexWitness

import hashlib
import json
import os
from java.io import File
from ghidra.program.model.block import BasicBlockModel
from ghidra.program.model.data import Enum, Structure


FORMAT = "hexwitness-jsonl-v1"


def sha256_file(path):
    digest = hashlib.sha256()
    stream = open(path, "rb")
    try:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    finally:
        stream.close()
    return digest.hexdigest()


def emit(stream, record, fields):
    fields["format"] = FORMAT
    fields["record"] = record
    stream.write(json.dumps(fields, sort_keys=True) + "\n")


input_path = currentProgram.getExecutablePath()
if not input_path or not File(input_path).exists():
    raise RuntimeError("Program executable path is unavailable")
digest = sha256_file(input_path)
build_id = os.environ.get("HEXWITNESS_BUILD_ID", "sha256:" + digest[:16])
output = os.environ.get("HEXWITNESS_OUTPUT", input_path + ".hexwitness.jsonl")

stream = open(output, "w")
try:
    emit(stream, "build", {
        "build_id": build_id,
        "label": os.path.basename(input_path),
        "sha256": digest,
        "architecture": str(currentProgram.getLanguageID()),
        "image_base": "0x" + currentProgram.getImageBase().toString(),
        "tool": "ghidra",
        "tool_version": str(getGhidraVersion()),
        "metadata": {"decompilation_included": False}
    })
    emit(stream, "artifact", {
        "build_id": build_id,
        "role": "executable",
        "path_hint": os.path.basename(input_path),
        "sha256": digest,
        "size_bytes": os.path.getsize(input_path)
    })

    manager = currentProgram.getFunctionManager()
    functions = list(manager.getFunctions(True))
    for function in functions:
        start = function.getEntryPoint()
        emit(stream, "entity", {
            "build_id": build_id,
            "kind": "function",
            "stable_key": "fn:0x" + start.toString(),
            "name": function.getName(),
            "address": "0x" + start.toString(),
            "size": int(function.getBody().getNumAddresses()),
            "signature": function.getSignature().getPrototypeString()
        })
        blocks = list(BasicBlockModel(currentProgram).getCodeBlocksContaining(function.getBody(), monitor))
        for index, block in enumerate(blocks):
            block_key = "bb:0x%s:%d" % (start.toString(), index)
            emit(stream, "entity", {
                "build_id": build_id, "kind": "basic_block", "stable_key": block_key,
                "name": "%s:block_%d" % (function.getName(), index),
                "address": "0x" + block.getFirstStartAddress().toString(),
                "size": int(block.getNumAddresses()), "metadata": {"function": "fn:0x" + start.toString(), "index": index}
            })
            emit(stream, "edge", {"build_id": build_id, "kind": "contains", "source": "fn:0x" + start.toString(), "target": block_key})

    for function in functions:
        source = "fn:0x" + function.getEntryPoint().toString()
        for callee in function.getCalledFunctions(monitor):
            emit(stream, "edge", {
                "build_id": build_id,
                "kind": "call",
                "source": source,
                "target": "fn:0x" + callee.getEntryPoint().toString(),
                "target_address": "0x" + callee.getEntryPoint().toString()
            })

    data_manager = currentProgram.getDataTypeManager()
    data_types = data_manager.getAllDataTypes()
    while data_types.hasNext():
        data_type = data_types.next()
        kind = "class" if isinstance(data_type, Structure) else ("enum" if isinstance(data_type, Enum) else "type")
        key = "type:" + data_type.getPathName()
        emit(stream, "entity", {"build_id": build_id, "kind": kind, "stable_key": key,
             "name": data_type.getName(), "size": max(0, int(data_type.getLength())),
             "signature": data_type.getDisplayName(), "metadata": {"category": str(data_type.getCategoryPath())}})
        if isinstance(data_type, Structure):
            for component in data_type.getComponents():
                member_key = "%s:field:%d:%s" % (key, component.getOffset(), component.getFieldName() or "unnamed")
                emit(stream, "entity", {"build_id": build_id, "kind": "field", "stable_key": member_key,
                     "name": component.getFieldName() or "unnamed", "size": int(component.getLength()),
                     "signature": component.getDataType().getDisplayName(), "metadata": {"offset": int(component.getOffset()), "owner": key}})
                emit(stream, "edge", {"build_id": build_id, "kind": "field", "source": key, "target": member_key})
finally:
    stream.close()

print("HexWitness export written: " + output)
