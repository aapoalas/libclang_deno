import { libclang } from "../ffi.ts";
import { throwIfError } from "../include/ErrorCode.h.ts";
import {
  CXGlobalOptFlags,
  CXTranslationUnit_Flags,
NULL,
NULLBUF,
} from "../include/typeDefinitions.ts";
import { cstr, CStringArray } from "../utils.ts";
import { CXTranslationUnit } from "./CXTranslationUnit.ts";

const OUT = new Uint8Array(8);
const OUT_64 = new BigUint64Array(OUT.buffer);

interface GlobalOptions {
  threadBackgroundPriorityForIndexing: boolean;
  threadBackgroundPriorityForEditing: boolean;
}

export class CXIndex {
  #pointer: Deno.PointerValue;

  translationUnits = new Map<string, CXTranslationUnit>();

  constructor(excludeDeclarationsFromPCH = false, displayDiagnostics = false) {
    this.#pointer = libclang.symbols.clang_createIndex(
      Number(excludeDeclarationsFromPCH),
      Number(displayDiagnostics),
    );
    if (this.#pointer === 0) {
      throw new Error("Creating CXIndex failed: Unknown error occurred");
    }
  }

  get options(): GlobalOptions {
    const opts = libclang.symbols.clang_CXIndex_getGlobalOptions(this.#pointer);
    return {
      threadBackgroundPriorityForIndexing: (opts &
        CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForIndexing) ===
        CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForIndexing,
      threadBackgroundPriorityForEditing: (opts &
        CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForEditing) ===
        CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForEditing,
    };
  }

  set options(opts: GlobalOptions) {
    libclang.symbols.clang_CXIndex_setGlobalOptions(
      this.#pointer,
      (opts.threadBackgroundPriorityForIndexing
        ? CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForIndexing
        : CXGlobalOptFlags.CXGlobalOpt_None) |
        (opts.threadBackgroundPriorityForEditing
          ? CXGlobalOptFlags.CXGlobalOpt_ThreadBackgroundPriorityForEditing
          : CXGlobalOptFlags.CXGlobalOpt_None),
    );
  }

  parseTranslationUnit(
    fileName: string,
    commandLineArguments: string[] = [],
    flags?: CXTranslationUnit_Flags[],
  ) {
    const source_filename = cstr(fileName);
    const command_line_args = new CStringArray(commandLineArguments);
    let options = 0;
    if (flags) {
      for (const option of flags) {
        options |= option;
      }
    }
    const result = libclang.symbols.clang_parseTranslationUnit2(
      this.#pointer,
      source_filename,
      command_line_args,
      command_line_args.arrayLength,
      NULL,
      0,
      options,
      OUT,
    );

    throwIfError(result, "Parsing CXTranslationUnit failed");

    const pointer = Number(OUT_64[0]);
    const tu = new CXTranslationUnit(pointer);
    this.translationUnits.set(fileName, tu);
    return tu;
  }

  setInvocationEmissionPathOption(path: null | string = null) {
    libclang.symbols.clang_CXIndex_setInvocationEmissionPathOption(
      this.#pointer,
      typeof path === "string" ? cstr(path) : path,
    );
  }

  dispose() {
    for (const tu of this.translationUnits.values()) {
      tu.dispose();
    }
    this.translationUnits.clear();
    libclang.symbols.clang_disposeIndex(this.#pointer);
  }
}
