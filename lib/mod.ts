import { libclang } from "./ffi.ts";
import { throwIfError } from "./include/ErrorCode.h.ts";
import {
  CXAvailabilityKind,
  CXChildVisitResult,
  CXCommentInlineCommandRenderKind,
  CXCommentKind,
  CXCommentParamPassDirection,
  CXCursorKind,
  CXCursorVisitorCallbackDefinition,
  CXDiagnosticDisplayOptions,
  CXDiagnosticSeverity,
  CXGlobalOptFlags,
  CXLanguageKind,
  CXLinkageKind,
  CXLoadDiag_Error,
  CXNameRefFlags,
  CXPrintingPolicyProperty,
  CXReparse_Flags,
  CXSaveError,
  CXTLSKind,
  CXTokenKind,
  CXTranslationUnit_Flags,
  CXTUResourceUsageKind,
  CXVisibilityKind,
  NULL,
  NULLBUF,
} from "./include/typeDefinitions.ts";
import {
  charBufferToString,
  cstr,
  CStringArray,
  cxstringSetToStringArray,
  cxstringToString,
} from "./utils.ts";

const CONSTRUCTOR = Symbol("[[constructor]]");
const POINTER = Symbol("[[pointer]]");
const BUFFER = Symbol("[[buffer]]");
const DISPOSE = Symbol("[[dispose]]");
const REGISTER = Symbol("[[register]]");
const DEREGISTER = Symbol("[[deregister]]");

const OUT = new Uint8Array(16);
const OUT_64 = new BigUint64Array(OUT.buffer);

let CURRENT_TU: null | CXTranslationUnit = null;
const INVALID_VISITOR_CALLBACK = () => CXChildVisitResult.CXChildVisit_Break;
let CURRENT_VISITOR_CALLBACK: (
  cursor: CXCursor,
  parent: CXCursor,
) => CXChildVisitResult = INVALID_VISITOR_CALLBACK;
const CX_CURSOR_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXCursorVisitorCallbackDefinition,
  (cursor, parent, _client_data) => {
    return CURRENT_VISITOR_CALLBACK(
      CXCursor[CONSTRUCTOR](CURRENT_TU, cursor),
      CXCursor[CONSTRUCTOR](CURRENT_TU, parent),
    );
  },
);

export interface GlobalOptions {
  threadBackgroundPriorityForIndexing: boolean;
  threadBackgroundPriorityForEditing: boolean;
}

const INDEX_FINALIZATION_REGISTRY = new FinalizationRegistry<Deno.PointerValue>(
  (pointer) => libclang.symbols.clang_disposeIndex(pointer),
);
export class CXIndex {
  #pointer: Deno.PointerValue;
  #disposed = false;

  translationUnits = new Map<string, CXTranslationUnit>();

  constructor(excludeDeclarationsFromPCH = false, displayDiagnostics = false) {
    this.#pointer = libclang.symbols.clang_createIndex(
      Number(excludeDeclarationsFromPCH),
      Number(displayDiagnostics),
    );
    if (this.#pointer === NULL) {
      throw new Error("Creating CXIndex failed: Unknown error occurred");
    }
    INDEX_FINALIZATION_REGISTRY.register(this, this.#pointer, this);
  }

  get options(): GlobalOptions {
    if (this.#disposed) {
      throw new Error("Cannot set options of disposed CXIndex");
    }
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
    if (this.#disposed) {
      throw new Error("Cannot get options of disposed CXIndex");
    }
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
    if (this.#disposed) {
      throw new Error("Cannot parse translation unit of disposed CXIndex");
    }
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
      commandLineArguments.length,
      NULL,
      0,
      options,
      OUT,
    );

    throwIfError(result, "Parsing CXTranslationUnit failed");

    const pointer = Number(OUT_64[0]);
    const tu = CXTranslationUnit[CONSTRUCTOR](pointer);
    this.translationUnits.set(fileName, tu);
    return tu;
  }

  setInvocationEmissionPathOption(path: null | string = null) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set invocation emission path option of disposed CXIndex",
      );
    }
    libclang.symbols.clang_CXIndex_setInvocationEmissionPathOption(
      this.#pointer,
      typeof path === "string" ? cstr(path) : path,
    );
  }

  createTranslationUnit(astFileNAme: string) {
    if (this.#disposed) {
      throw new Error("Cannot create translation unit in disposed CXIndex");
    }
    const result = libclang.symbols.clang_createTranslationUnit2(
      this.#pointer,
      cstr(astFileNAme),
      OUT,
    );
    throwIfError(result, "Parsing CXTranslationUnit failed");

    const pointer = Number(OUT_64[0]);
    const tu = CXTranslationUnit[CONSTRUCTOR](pointer);
    this.translationUnits.set(astFileNAme, tu);
    return tu;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    for (const tu of this.translationUnits.values()) {
      tu.dispose();
    }
    this.translationUnits.clear();
    libclang.symbols.clang_disposeIndex(this.#pointer);
    INDEX_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}

export interface TargetInfo {
  triple: string;
  pointerWidth: number;
}

interface Dependent {
  [DISPOSE]?(): void;
}

type DependentsSet = Set<WeakRef<Dependent>>;

const TU_FINALIZATION_REGISTRY = new FinalizationRegistry<Deno.PointerValue>(
  (tuPointer) => libclang.symbols.clang_disposeTranslationUnit(tuPointer),
);
/**
 * A single translation unit, which resides in an index.
 *
 * ```cpp
 * typedef struct CXTranslationUnitImpl *CXTranslationUnit;
 * ```
 */
export class CXTranslationUnit {
  static #constructable = false;
  #dependents: DependentsSet = new Set();
  #pointer: Deno.PointerValue;
  #disposed = false;
  #suspended = false;

  constructor(pointer: Deno.PointerValue) {
    if (!CXTranslationUnit.#constructable) {
      throw new Error("CXTranslationUnit is not constructable");
    }
    this.#pointer = pointer;
    TU_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  static [CONSTRUCTOR](pointer: Deno.PointerValue): CXTranslationUnit {
    CXTranslationUnit.#constructable = true;
    const result = new CXTranslationUnit(pointer);
    CXTranslationUnit.#constructable = false;
    return result;
  }

  get [POINTER](): Deno.PointerValue {
    return this.#pointer;
  }

  save(fileName: string): void {
    if (this.#disposed) {
      throw new Error("Cannot save disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot save suspended CXTranslationUnit");
    }
    const saveFileName = cstr(fileName);
    const result = libclang.symbols.clang_saveTranslationUnit(
      this.#pointer,
      saveFileName,
      0,
    );
    if (result === CXSaveError.CXSaveError_InvalidTU) {
      throw new Error(
        "Saving CXTranslationUnit failed: Invalid CXTranslationUnit",
        { cause: result },
      );
    } else if (result === CXSaveError.CXSaveError_Unknown) {
      throw new Error(
        "Saving CXTranslationUnit failed: Unknown error occurred",
        { cause: result },
      );
    } else if (result === CXSaveError.CXSaveError_TranslationErrors) {
      throw new Error(
        "Saving CXTranslationUnit failed: Unit contains translation errors",
        { cause: result },
      );
    } else if (result !== 0) {
      throw new Error("Saving CXTranslationUnit failed: Unkown error code", {
        cause: result,
      });
    }
  }

  suspend(): number {
    if (this.#disposed) {
      throw new Error("Cannot suspend disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot suspend suspended CXTranslationUnit");
    }
    return libclang.symbols.clang_suspendTranslationUnit(this.#pointer);
  }

  reparse(
    options: CXReparse_Flags = libclang.symbols.clang_defaultReparseOptions(
      this.#pointer,
    ),
  ): void {
    if (this.#disposed) {
      throw new Error("Cannot reparse disposed CXTranslationUnit");
    }
    const result = libclang.symbols.clang_reparseTranslationUnit(
      this.#pointer,
      0,
      NULLBUF,
      options,
    );
    throwIfError(result, "Reparsing CXTranslationUnit failed");
    this.#suspended = false;
  }

  getTargetInfo(): TargetInfo {
    if (this.#disposed) {
      throw new Error("Cannot get TargetInfo of disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get TargetInfo of suspended CXTranslationUnit");
    }
    const targetInfo = libclang.symbols.clang_getTranslationUnitTargetInfo(
      this.#pointer,
    );
    const pointerWidth = libclang.symbols.clang_TargetInfo_getPointerWidth(
      targetInfo,
    );
    const tripleCXString = libclang.symbols.clang_TargetInfo_getTriple(
      targetInfo,
    );
    const triple = cxstringToString(tripleCXString);
    if (pointerWidth === -1 || triple.length === 0) {
      throw new Error("Getting TargetInfo failed: Unknown error occurred");
    }
    return {
      triple,
      pointerWidth,
    };
  }

  getAllSkippedRanges(): null | CXSourceRangeList {
    if (this.#disposed) {
      throw new Error(
        "Cannot get skipped ranges of disposed CXTranslationUnit",
      );
    } else if (this.#suspended) {
      throw new Error(
        "Cannot get skipped ranges of suspended CXTranslationUnit",
      );
    }
    const listPointer = libclang.symbols.clang_getAllSkippedRanges(
      this.#pointer,
    );
    const view = new Deno.UnsafePointerView(listPointer);
    const count = view.getUint32();
    if (count === 0) {
      libclang.symbols.clang_disposeSourceRangeList(listPointer);
      return null;
    }
    const rangesPointer = Number(view.getBigUint64(8));
    return CXSourceRangeList[CONSTRUCTOR](
      this,
      listPointer,
      rangesPointer,
      count,
    );
  }

  getDiagnostic(index: number): CXDiagnostic {
    if (this.#disposed) {
      throw new Error("Cannot get diagnostic of disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get diagnostic of suspended CXTranslationUnit");
    } else if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    const diagnostic = libclang.symbols.clang_getDiagnostic(
      this.#pointer,
      index,
    );
    return CXDiagnostic[CONSTRUCTOR](this, diagnostic);
  }

  getDiagnosticSet(): CXDiagnosticSet {
    if (this.#disposed) {
      throw new Error(
        "Cannot get diagnostic set of disposed CXTranslationUnit",
      );
    } else if (this.#suspended) {
      throw new Error(
        "Cannot get diagnostic set of suspended CXTranslationUnit",
      );
    }
    return CXDiagnosticSet[CONSTRUCTOR](
      this,
      libclang.symbols.clang_getDiagnosticSetFromTU(this.#pointer),
    );
  }

  getFile(fileName: string): null | CXFile {
    if (this.#disposed) {
      throw new Error("Cannot get file from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get file from suspended CXTranslationUnit");
    }
    const file_name = cstr(fileName);
    const handle = libclang.symbols.clang_getFile(this.#pointer, file_name);
    if (handle === NULL) {
      return null;
    }
    const file = CXFile[CONSTRUCTOR](this, handle);
    return file;
  }

  getNumDiagnostics(): number {
    if (this.#disposed) {
      throw new Error(
        "Cannot get number of diagnostics from disposed CXTranslationUnit",
      );
    } else if (this.#suspended) {
      throw new Error(
        "Cannot get number of diagnostics from suspended CXTranslationUnit",
      );
    }
    return libclang.symbols.clang_getNumDiagnostics(this.#pointer);
  }

  getCursor(): CXCursor {
    if (this.#disposed) {
      throw new Error("Cannot get cursor from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get cursor from suspended CXTranslationUnit");
    }
    const cursor: Uint8Array = libclang.symbols.clang_getTranslationUnitCursor(
      this.#pointer,
    );
    return CXCursor[CONSTRUCTOR](this, cursor);
  }

  getResourceUsage(): CXTUResourceUsage {
    if (this.#disposed) {
      throw new Error(
        "Cannot get resource usage of disposed CXTranslationUnit",
      );
    } else if (this.#suspended) {
      throw new Error(
        "Cannot get resoure usage of suspended CXTranslationUnit",
      );
    }
    const resourceUsage = CXTUResourceUsage[CONSTRUCTOR](
      libclang.symbols.clang_getCXTUResourceUsage(this.#pointer),
    );
    return resourceUsage;
  }

  annotateTokens(tokens: CXToken[]): CXCursor[] {
    if (this.#disposed) {
      throw new Error("Cannot annotate tokens of disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot annotate tokens of suspended CXTranslationUnit");
    }
    const tokenArray = new Uint8Array(8 * 3 * tokens.length);
    tokens.forEach((token, index) => {
      tokenArray.set(token[BUFFER], 8 * 3 * index);
    });
    const cursorArray = new Uint8Array(8 * 4 * tokens.length);
    libclang.symbols.clang_annotateTokens(
      this.#pointer,
      tokenArray,
      tokens.length,
      cursorArray,
    );
    return Array.from({ length: tokens.length }, (_, index) => {
      const offset = 8 * 4 * index;
      return CXCursor[CONSTRUCTOR](
        this,
        cursorArray.subarray(offset, offset + 8 * 4),
      );
    });
  }

  getToken(location: CXSourceLocation): CXToken {
    if (this.#disposed) {
      throw new Error("Cannot get token from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get token from suspended CXTranslationUnit");
    }
    const tokenPointer = libclang.symbols.clang_getToken(
      this.#pointer,
      location[BUFFER],
    );
    return CXToken[CONSTRUCTOR](
      this,
      tokenPointer,
      new Uint8Array(
        Deno.UnsafePointerView.getArrayBuffer(tokenPointer, 8 * 3),
      ),
    );
  }

  tokenize(range: CXSourceRange): CXToken[] {
    if (this.#disposed) {
      throw new Error("Cannot tokenize disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot tokenize suspended CXTranslationUnit");
    }
    libclang.symbols.clang_tokenize(
      this.#pointer,
      range[BUFFER],
      OUT,
      OUT.subarray(8),
    );
    const tokensPointer = Number(OUT_64[0]);
    const numTokens = new Uint32Array(OUT.buffer, 8, 1)[0];
    return Array.from({ length: numTokens }, (_, index) => {
      const tokenBuffer = new Uint8Array(
        Deno.UnsafePointerView.getArrayBuffer(
          tokensPointer,
          8 * 3,
          8 * 3 * index,
        ),
      );
      return CXToken[CONSTRUCTOR](this, tokensPointer, tokenBuffer);
    });
  }

  [REGISTER](dependent: Dependent) {
    this.#dependents.add(new WeakRef(dependent));
  }

  [DEREGISTER](dependent: Dependent) {
    for (const weakRef of this.#dependents) {
      if (weakRef.deref() == dependent) {
        this.#dependents.delete(weakRef);
        return;
      }
    }
  }

  [DISPOSE]() {
    for (const dependent of this.#dependents) {
      const dep = dependent.deref();
      if (dep && typeof dep[DISPOSE] === "function") {
        dep[DISPOSE]();
      }
    }
    this.#dependents.clear();
    this.#disposed = true;
    libclang.symbols.clang_disposeTranslationUnit(this.#pointer);
    // Manually disposed: unregister from FinalizationRegistry.
    TU_FINALIZATION_REGISTRY.unregister(this);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this[DISPOSE]();
  }
}

interface CXTUResourceUsageEntry {
  kind: CXTUResourceUsageKind;
  bytes: number;
}

const RESOURCE_USAGE_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Uint8Array
>((buffer) => libclang.symbols.clang_disposeCXTUResourceUsage(buffer));
class CXTUResourceUsage {
  static #constructable = false;
  #buffer: Uint8Array;
  #length: number;
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(buffer: Uint8Array) {
    if (CXTUResourceUsage.#constructable !== true) {
      throw new Error("CXTUResourceUsage is not constructable");
    } else if (buffer.byteLength < 3 * 8) {
      throw new Error("Unexpected CXTUResourceUsage buffer size");
    }
    this.#buffer = buffer;
    RESOURCE_USAGE_FINALIZATION_REGISTRY.register(this, buffer, this);
    const u32Buf = new Uint32Array(buffer.buffer, 8, 1);
    this.#length = u32Buf[0];
    const u64Buf = new BigUint64Array(buffer.buffer, 16, 1);
    this.#pointer = Number(u64Buf[0]);
  }

  static [CONSTRUCTOR](buffer: Uint8Array): CXTUResourceUsage {
    CXTUResourceUsage.#constructable = true;
    const result = new CXTUResourceUsage(buffer);
    CXTUResourceUsage.#constructable = false;
    return result;
  }

  get length() {
    return this.#length;
  }

  at(index: number): CXTUResourceUsageEntry {
    if (index < 0 || index >= this.length) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    const buffer = Deno.UnsafePointerView.getArrayBuffer(
      this.#pointer,
      16,
      16 * index,
    );
    const [kind, , bytes] = new Uint32Array(buffer, 0, 3);
    return {
      kind,
      bytes,
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeCXTUResourceUsage(this.#buffer);
    RESOURCE_USAGE_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}

export class CXFile {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(tu: CXTranslationUnit, pointer: Deno.PointerValue) {
    if (!CXFile.#constructable) {
      throw new Error("CXFile is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXFile {
    CXFile.#constructable = true;
    const result = new CXFile(tu, pointer);
    CXFile.#constructable = false;
    return result;
  }

  [DISPOSE]() {
    this.#disposed = true;
  }

  equals(other: CXFile) {
    if (this.#disposed || other.#disposed) {
      throw new Error("Cannot compare disposed file");
    }
    return libclang.symbols.clang_File_isEqual(
      this.#pointer,
      other.#pointer,
    ) !== 0;
  }

  getFileContents(): string {
    if (this.#disposed) {
      throw new Error("Cannot get file contents of disposed File");
    }
    const pointer = libclang.symbols.clang_getFileContents(
      this.tu[POINTER],
      this.#pointer,
      OUT,
    );
    if (pointer === NULL) {
      throw new Error("File not loaded");
    }
    const byteLength = Number(OUT_64[0]);
    const buffer = Deno.UnsafePointerView.getArrayBuffer(pointer, byteLength);
    return charBufferToString(new Uint8Array(buffer));
  }

  getLocation(line: number, column: number): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location of disposed File");
    } else if (line < 0) {
      throw new Error("Invalid argument, line must be unsigned integer");
    } else if (column < 0) {
      throw new Error("Invalid argument, column must be unsigned integer");
    }
    const res = libclang.symbols.clang_getLocation(
      this.tu[POINTER],
      this.#pointer,
      line,
      column,
    );
    return CXSourceLocation[CONSTRUCTOR](this.tu, res);
  }

  getSkippedRanges(): null | CXSourceRangeList {
    if (this.#disposed) {
      throw new Error("Cannot get skipped ranges from disposed CXFile");
    }
    const listPointer = libclang.symbols.clang_getSkippedRanges(
      this.tu[POINTER],
      this.#pointer,
    );
    const view = new Deno.UnsafePointerView(listPointer);
    const count = view.getUint32();
    if (count === 0) {
      return null;
    }
    const rangesPointer = Number(view.getBigUint64(8));
    return CXSourceRangeList[CONSTRUCTOR](
      this.tu,
      listPointer,
      rangesPointer,
      count,
    );
  }

  isFileMultipleIncludeGuarded(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get include guard data from disposed CXFile");
    }
    return libclang.symbols.clang_isFileMultipleIncludeGuarded(
      this.tu[POINTER],
      this.#pointer,
    ) > 0;
  }

  getLocationForOffset(offset: number): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location for offset from disposed CXFile");
    }
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getLocationForOffset(
        this.tu[POINTER],
        this.#pointer,
        offset,
      ),
    );
  }
}

export class CXCursor {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;
  #kind?: CXCursorKind;
  #hash?: number;

  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXCursor.#constructable !== true) {
      throw new Error("CXCursor is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXCursor {
    CXCursor.#constructable = true;
    const result = new CXCursor(tu, buffer);
    CXCursor.#constructable = false;
    return result;
  }

  static getNullCursor(): CXCursor {
    return CXCursor[CONSTRUCTOR](null, libclang.symbols.clang_getNullCursor());
  }

  get kind(): CXCursorKind {
    return this.#kind ??
      (this.#kind = libclang.symbols.clang_getCursorKind(this.#buffer));
  }

  equals(other: CXCursor): boolean {
    return libclang.symbols.clang_equalCursors(this.#buffer, other.#buffer) !==
      0;
  }

  getVarDeclInitializer(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getVarDeclInitializer(this.#buffer),
    );
  }

  hasAttributes(): boolean {
    return libclang.symbols.clang_Cursor_hasAttrs(this.#buffer) > 0;
  }

  hasVarDeclExternalStorage(): boolean {
    const result = libclang.symbols.clang_Cursor_hasVarDeclExternalStorage(
      this.#buffer,
    );
    if (result === 1) {
      return true;
    } else if (result === 0) {
      return false;
    }
    throw new Error("Cursor does not point to a variable declaration");
  }

  getAvailability(): CXAvailabilityKind {
    return libclang.symbols.clang_getCursorAvailability(this.#buffer);
  }

  getLanguage(): CXLanguageKind {
    return libclang.symbols.clang_getCursorLanguage(this.#buffer);
  }

  getLexicalParent(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorLexicalParent(this.#buffer),
    );
  }

  getLinkage(): CXLinkageKind {
    return libclang.symbols.clang_getCursorLinkage(this.#buffer);
  }

  //getPlatformAvailability() {}

  getSemanticParent(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorSemanticParent(this.#buffer),
    );
  }

  getTLSKind(): CXTLSKind {
    return libclang.symbols.clang_getCursorTLSKind(this.#buffer);
  }

  getVisibility(): CXVisibilityKind {
    return libclang.symbols.clang_getCursorVisibility(this.#buffer);
  }

  getIncludedFile(): CXFile {
    if (this.tu === null) {
      throw new Error("Cannot get included file of null cursor");
    }
    return CXFile[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getIncludedFile(this.#buffer),
    );
  }

  // getOverriddenCursors(): CXCursor[] {
  //   libclang.symbols.clang_getOverriddenCursors(this.#buffer, OUT, OUT_2);
  // }

  isNull(): boolean {
    return libclang.symbols.clang_Cursor_isNull(this.#buffer) !== 0;
  }

  hash(): number {
    return this.#hash ??
      (this.#hash = libclang.symbols.clang_hashCursor(this.#buffer));
  }

  static isDeclaration(kind: CXCursorKind): boolean {
    return libclang.symbols.clang_isDeclaration(kind) > 0;
  }

  getBriefCommentText(): string {
    const cxstring = libclang.symbols.clang_Cursor_getBriefCommentText(
      this.#buffer,
    );
    return cxstringToString(cxstring);
  }

  getCommentRange(): CXSourceRange {
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getCommentRange(this.#buffer),
    );
  }

  getObjCDeclQualifiers(): number {
    return libclang.symbols.clang_Cursor_getObjCDeclQualifiers(this.#buffer);
  }

  getObjCPropertyAttributes(): number {
    return libclang.symbols.clang_Cursor_getObjCPropertyAttributes(
      this.#buffer,
      0,
    );
  }

  getObjCPropertySetterName(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getObjCPropertySetterName(this.#buffer),
    );
  }

  getObjCPropertyGetterName(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getObjCPropertyGetterName(this.#buffer),
    );
  }

  getObjCSelectorIndex(): number {
    return libclang.symbols.clang_Cursor_getObjCSelectorIndex(this.#buffer);
  }

  getObjCManglings(): string[] {
    return cxstringSetToStringArray(
      libclang.symbols.clang_Cursor_getObjCManglings(this.#buffer),
    );
  }

  isObjCOptional(): boolean {
    return libclang.symbols.clang_Cursor_isObjCOptional(this.#buffer) !== 0;
  }

  getRawCommentText(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getRawCommentText(this.#buffer),
    );
  }

  getReceiverType(): CXType {
    return CXType[CONSTRUCTOR](
      libclang.symbols.clang_Cursor_getReceiverType(this.#buffer),
    );
  }

  isDynamicCall(): boolean {
    return libclang.symbols.clang_Cursor_isDynamicCall(this.#buffer) !== 0;
  }

  isExternalSymbol(): boolean {
    return libclang.symbols.clang_Cursor_isExternalSymbol(
      this.#buffer,
      NULLBUF,
      NULLBUF,
      NULLBUF,
    ) !== 0;
  }

  getExternalSymbolAttributes(): null | {
    language: null | string;
    definedIn: null | string;
    isGenerated: boolean;
  } {
    const languageOut = new Uint8Array(16 * 2 + 4);
    const definedInOut = languageOut.subarray(16, 16 * 2);
    const isGeneratedOut = languageOut.subarray(16 * 2);
    const isExternalSymbol = libclang.symbols.clang_Cursor_isExternalSymbol(
      this.#buffer,
      languageOut,
      definedInOut,
      isGeneratedOut,
    ) !== 0;
    if (!isExternalSymbol) {
      // If the symbol is not external, the out buffers will be left untouched.
      // Thus, there's no need to call dispose functions.
      return null;
    }
    const language = cxstringToString(languageOut) || null;
    const definedIn = cxstringToString(definedInOut) || null;
    const isGenerated = isGeneratedOut[0] !== 0 || isGeneratedOut[1] !== 0 ||
      isGeneratedOut[2] !== 0 || isGeneratedOut[3] !== 0;
    return {
      language,
      definedIn,
      isGenerated,
    };
  }

  isVariadic(): boolean {
    return libclang.symbols.clang_Cursor_isVariadic(this.#buffer) !== 0;
  }

  getCanonicalCursor(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCanonicalCursor(this.#buffer),
    );
  }

  getDefinition(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorDefinition(this.#buffer),
    );
  }

  getDisplayName(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorDisplayName(this.#buffer),
    );
  }

  getPrettyPrinted(printingPolicy: null | CXPrintingPolicy = null): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorPrettyPrinted(
        this.#buffer,
        printingPolicy ? printingPolicy[POINTER] : NULL,
      ),
    );
  }

  getPrintingPolicy(): CXPrintingPolicy {
    return CXPrintingPolicy[CONSTRUCTOR](
      libclang.symbols.clang_getCursorPrintingPolicy(this.#buffer),
    );
  }

  getReferenced(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorReferenced(this.#buffer),
    );
  }

  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorSpelling(this.#buffer),
    );
  }

  getUSR(): string {
    return cxstringToString(libclang.symbols.clang_getCursorUSR(this.#buffer));
  }

  isDefinition(): boolean {
    return libclang.symbols.clang_isCursorDefinition(this.#buffer) !== 0;
  }

  visitChildren(
    callback: (cursor: CXCursor, parent: CXCursor) => CXChildVisitResult,
  ): boolean {
    CURRENT_TU = this.tu;
    CURRENT_VISITOR_CALLBACK = callback;
    const result = libclang.symbols.clang_visitChildren(
      this.#buffer,
      CX_CURSOR_VISITOR_CALLBACK.pointer,
      NULL,
    ) > 0;
    CURRENT_TU = null;
    CURRENT_VISITOR_CALLBACK = INVALID_VISITOR_CALLBACK;
    return result;
  }

  getCXXManglings(): string[] {
    return cxstringSetToStringArray(
      libclang.symbols.clang_Cursor_getCXXManglings(this.#buffer),
    );
  }

  getParsedComment(): CXComment {
    return CXComment[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getParsedComment(this.#buffer),
    );
  }

  isConvertingConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isConvertingConstructor(
      this.#buffer,
    ) !== 0;
  }

  isCopyConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isCopyConstructor(
      this.#buffer,
    ) !== 0;
  }

  isDefaultConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isDefaultConstructor(
      this.#buffer,
    ) !== 0;
  }

  isMoveConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isMoveConstructor(
      this.#buffer,
    ) !== 0;
  }

  isMutable(): boolean {
    return libclang.symbols.clang_CXXField_isMutable(this.#buffer) !== 0;
  }

  isConst(): boolean {
    return libclang.symbols.clang_CXXMethod_isConst(this.#buffer) !== 0;
  }

  isCopyAssignmentOperator(): never {
    throw new Error("Not implemented");
    // return libclang.symbols.clang_CXXMethod_isCopyAssignmentOperator(this.#buffer) !== 0;
  }

  isDefaulted(): boolean {
    return libclang.symbols.clang_CXXMethod_isDefaulted(this.#buffer) !== 0;
  }

  isDeleted(): never {
    throw new Error("Not implemented");
    //return libclang.symbols.clang_CXXMethod_isDeleted(this.#buffer) !== 0;
  }

  isPureVirtual(): boolean {
    return libclang.symbols.clang_CXXMethod_isPureVirtual(this.#buffer) !== 0;
  }

  isStatic(): boolean {
    return libclang.symbols.clang_CXXMethod_isStatic(this.#buffer) !== 0;
  }

  isVirtual(): boolean {
    return libclang.symbols.clang_CXXMethod_isVirtual(this.#buffer) !== 0;
  }

  isAbstract(): boolean {
    return libclang.symbols.clang_CXXRecord_isAbstract(this.#buffer) !== 0;
  }

  isScoped(): boolean {
    return libclang.symbols.clang_EnumDecl_isScoped(this.#buffer) !== 0;
  }

  getReferenceNameRange(
    options: CXNameRefFlags[] = [],
    pieceIndex = 0,
  ): CXSourceRange {
    let opts = 0;
    for (const option of options) {
      opts |= option;
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorReferenceNameRange(
        this.#buffer,
        opts,
        pieceIndex,
      ),
    );
  }

  getSpecializedTemplate(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getSpecializedCursorTemplate(this.#buffer),
    );
  }

  getTemplateKind(): CXCursorKind {
    return libclang.symbols.clang_getTemplateCursorKind(this.#buffer);
  }

  getModule(): CXModule {
    if (this.tu === null) {
      throw new Error("Cannot get CXModule of null cursor");
    }
    return CXModule[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getModule(this.#buffer),
    );
  }
}

class CXModule {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;

  constructor(tu: CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXModule.#constructable !== true) {
      throw new Error("CXModule is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXModule {
    CXModule.#constructable = true;
    const result = new CXModule(tu, pointer);
    CXModule.#constructable = false;
    return result;
  }

  getASTFile(): CXFile {
    if (this.tu === null) {
      throw new Error("Cannot get AST file of null CXModule");
    }
    return CXFile[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Module_getASTFile(this.#pointer),
    );
  }

  getFullName(): string {
    return cxstringToString(
      libclang.symbols.clang_Module_getFullName(this.#pointer),
    );
  }

  getNumberOfTopLevelHeaders(): number {
    return libclang.symbols.clang_Module_getNumTopLevelHeaders(
      this.tu[POINTER],
      this.#pointer,
    );
  }

  getParent(): null | CXModule {
    const pointer = libclang.symbols.clang_Module_getParent(this.#pointer);
    if (pointer === NULL) {
      return null;
    }
    return CXModule[CONSTRUCTOR](this.tu, pointer);
  }

  getTopLevelHeader(index: number): CXFile {
    if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    const pointer = libclang.symbols.clang_Module_getTopLevelHeader(
      this.tu[POINTER],
      this.#pointer,
      index,
    );
    if (pointer === NULL) {
      throw new Error("Could not get top level header");
    }
    return CXFile[CONSTRUCTOR](this.tu, pointer);
  }

  isSystem(): boolean {
    return libclang.symbols.clang_Module_isSystem(this.#pointer) !== 0;
  }
}

class CXComment {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;
  #kind?: number;

  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXComment.#constructable !== true) {
      throw new Error("CXComment is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXComment {
    CXComment.#constructable = true;
    const result = new CXComment(tu, buffer);
    CXComment.#constructable = false;
    return result;
  }

  get kind(): CXCommentKind {
    return this.#kind ??
      (this.#kind = libclang.symbols.clang_Comment_getKind(this.#buffer));
  }

  #isInlineCommandContent(): boolean {
    const kind = this.kind;
    return kind === CXCommentKind.CXComment_Text ||
      kind === CXCommentKind.CXComment_InlineCommand ||
      kind == CXCommentKind.CXComment_HTMLStartTag ||
      kind === CXCommentKind.CXComment_HTMLEndTag ||
      kind === CXCommentKind.CXComment_Paragraph;
  }

  getNumberOfChildren(): number {
    return libclang.symbols.clang_Comment_getNumChildren(this.#buffer);
  }

  getChild(index: number): CXComment {
    if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return CXComment[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Comment_getChild(this.#buffer, index),
    );
  }

  isWhitespace(): boolean {
    return libclang.symbols.clang_Comment_isWhitespace(this.#buffer) !== 0;
  }

  hasTrailingNewline(): boolean {
    if (!this.#isInlineCommandContent()) {
      throw new Error("Not InlineCommandContent");
    }
    return libclang.symbols.clang_InlineContentComment_hasTrailingNewline(
      this.#buffer,
    ) !== 0;
  }

  getText(): string {
    const kind = this.kind;
    if (kind === CXCommentKind.CXComment_Text) {
      return cxstringToString(
        libclang.symbols.clang_TextComment_getText(this.#buffer),
      );
    } else if (kind === CXCommentKind.CXComment_VerbatimBlockLine) {
      return cxstringToString(
        libclang.symbols.clang_VerbatimBlockLineComment_getText(this.#buffer),
      );
    } else if (kind === CXCommentKind.CXComment_VerbatimLine) {
      return cxstringToString(
        libclang.symbols.clang_VerbatimLineComment_getText(this.#buffer),
      );
    } else {
      throw new Error("Not Text or VerbatimBlockLine");
    }
  }

  getCommandName(): string {
    if (this.#isInlineCommandContent()) {
      return cxstringToString(
        libclang.symbols.clang_InlineCommandComment_getCommandName(
          this.#buffer,
        ),
      );
    } else {
      return cxstringToString(
        libclang.symbols.clang_BlockCommandComment_getCommandName(this.#buffer),
      );
    }
  }

  getRenderKind(): CXCommentInlineCommandRenderKind {
    if (!this.#isInlineCommandContent()) {
      throw new Error("Not InlineCommandComment");
    }
    return libclang.symbols.clang_InlineCommandComment_getRenderKind(
      this.#buffer,
    );
  }

  getNumberOfArguments(): number {
    if (this.#isInlineCommandContent()) {
      return libclang.symbols.clang_InlineCommandComment_getNumArgs(
        this.#buffer,
      );
    } else {
      return libclang.symbols.clang_BlockCommandComment_getNumArgs(
        this.#buffer,
      );
    }
  }

  getArgumentText(index: number) {
    if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    } else if (this.#isInlineCommandContent()) {
      return libclang.symbols.clang_InlineCommandComment_getArgText(
        this.#buffer,
        index,
      );
    } else {
      return libclang.symbols.clang_BlockCommandComment_getArgText(
        this.#buffer,
        index,
      );
    }
  }

  getTagName(): string {
    return cxstringToString(
      libclang.symbols.clang_HTMLTagComment_getTagName(this.#buffer),
    );
  }

  isSelfClosing(): boolean {
    return libclang.symbols.clang_HTMLStartTagComment_isSelfClosing(
      this.#buffer,
    ) !== 0;
  }

  getAttributes(): null | Record<string, string> {
    if (this.kind !== CXCommentKind.CXComment_HTMLStartTag) {
      return null;
    }
    const attributes: Record<string, string> = {};
    const count = libclang.symbols.clang_HTMLStartTag_getNumAttrs(this.#buffer);
    for (let i = 0; i < count; i++) {
      attributes[
        cxstringToString(
          libclang.symbols.clang_HTMLStartTag_getAttrName(this.#buffer, i),
        )
      ] = cxstringToString(
        libclang.symbols.clang_HTMLStartTag_getAttrValue(this.#buffer, i),
      );
    }
    return attributes;
  }

  getParagraph() {
    const kind = this.kind;
    if (
      kind !== CXCommentKind.CXComment_BlockCommand &&
      kind !== CXCommentKind.CXComment_VerbatimBlockCommand
    ) {
      throw new Error("Not BlockCommand or VerbatimBlockCommand");
    }
    return CXComment[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_BlockCommandComment_getParagraph(this.#buffer),
    );
  }

  getParameterName(): string {
    const kind = this.kind;
    if (kind === CXCommentKind.CXComment_ParamCommand) {
      return cxstringToString(
        libclang.symbols.clang_ParamCommandComment_getParamName(this.#buffer),
      );
    } else if (kind === CXCommentKind.CXComment_TParamCommand) {
      return cxstringToString(
        libclang.symbols.clang_TParamCommandComment_getParamName(this.#buffer),
      );
    } else {
      throw new Error("Not ParamCommandComment or TParamCommandComment");
    }
  }

  isParameterIndexValid(): boolean {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_isParamIndexValid(
      this.#buffer,
    ) !== 0;
  }

  getParameterIndex(): number {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_getParamIndex(
      this.#buffer,
    );
  }

  isDirectionExplicit(): boolean {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_isDirectionExplicit(
      this.#buffer,
    ) !== 0;
  }

  getDirection(): CXCommentParamPassDirection {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_getDirection(
      this.#buffer,
    );
  }

  isParameterPositionValid(): boolean {
    if (this.kind !== CXCommentKind.CXComment_TParamCommand) {
      throw new Error("Not TParamCommand");
    }
    return libclang.symbols.clang_TParamCommandComment_isParamPositionValid(
      this.#buffer,
    ) !== 0;
  }

  getDepth(): number {
    if (this.kind !== CXCommentKind.CXComment_TParamCommand) {
      throw new Error("Not TParamCommand");
    }
    return libclang.symbols.clang_TParamCommandComment_getDepth(this.#buffer);
  }

  getIndex(index: number): number {
    if (this.kind !== CXCommentKind.CXComment_TParamCommand) {
      throw new Error("Not TParamCommand");
    } else if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return libclang.symbols.clang_TParamCommandComment_getIndex(
      this.#buffer,
      index,
    );
  }

  getAsString(): string {
    const kind = this.kind;
    if (
      kind !== CXCommentKind.CXComment_HTMLEndTag &&
      kind !== CXCommentKind.CXComment_HTMLStartTag
    ) {
      throw new Error("Not HTMLTag");
    }
    return cxstringToString(
      libclang.symbols.clang_HTMLTagComment_getAsString(this.#buffer),
    );
  }

  getAsHTML(): string {
    if (this.kind !== CXCommentKind.CXComment_FullComment) {
      throw new Error("Not FullComment");
    }
    return cxstringToString(
      libclang.symbols.clang_FullComment_getAsHTML(this.#buffer),
    );
  }

  getAsXML(): string {
    if (this.kind !== CXCommentKind.CXComment_FullComment) {
      throw new Error("Not FullComment");
    }
    return cxstringToString(
      libclang.symbols.clang_FullComment_getAsXML(this.#buffer),
    );
  }
}

const SOURCE_RANGE_LIST_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeSourceRangeList(pointer));
class CXSourceRangeList {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #arrayPointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  get length() {
    return this.#length;
  }

  constructor(
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
    arrayPointer: Deno.PointerValue,
    length: number,
  ) {
    if (CXSourceRangeList.#constructable !== true) {
      throw new Error("CXSourceRangeList is not constructable");
    }
    SOURCE_RANGE_LIST_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.tu = tu;
    this.#pointer = pointer;
    this.#arrayPointer = arrayPointer;
    this.#length = length;
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
    arrayPointer: Deno.PointerValue,
    length: number,
  ): CXSourceRangeList {
    CXSourceRangeList.#constructable = true;
    const result = new CXSourceRangeList(tu, pointer, arrayPointer, length);
    CXSourceRangeList.#constructable = false;
    return result;
  }

  at(index: number): CXSourceRange {
    if (this.#disposed) {
      throw new Error(
        "Cannot get CXSourceRange at index of disposed CXSourceRangeList",
      );
    } else if (index < 0 || this.#length <= index) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      new Uint8Array(
        Deno.UnsafePointerView.getArrayBuffer(
          this.#arrayPointer,
          // Two pointers, two unsigned integers per CXSourceRange
          2 * (8 + 4),
          index * 2 * (8 + 4),
        ),
      ),
    );
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeSourceRangeList(this.#pointer);
    SOURCE_RANGE_LIST_FINALIZATION_REGISTRY.unregister(this);
  }
}

export class CXSourceRange {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;

  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXSourceRange.#constructable !== true) {
      throw new Error("CXSourceRange is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXSourceRange {
    CXSourceRange.#constructable = true;
    const result = new CXSourceRange(tu, buffer);
    CXSourceRange.#constructable = false;
    return result;
  }

  static getNullRange() {
    return CXSourceRange[CONSTRUCTOR](
      null,
      libclang.symbols.clang_getNullRange(),
    );
  }

  static getRange(
    begin: CXSourceLocation,
    end: CXSourceLocation,
  ): CXSourceRange {
    return CXSourceRange[CONSTRUCTOR](
      begin.tu,
      libclang.symbols.clang_getRange(begin[BUFFER], end[BUFFER]),
    );
  }

  get [BUFFER]() {
    return this.#buffer;
  }

  isNull(): boolean {
    return libclang.symbols.clang_Range_isNull(this.#buffer) !== 0;
  }

  equals(other: CXSourceRange): boolean {
    return libclang.symbols.clang_equalRanges(this.#buffer, other.#buffer) !==
      0;
  }

  getRangeStart(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getRangeStart(this.#buffer),
    );
  }

  getRangeEnd(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getRangeEnd(this.#buffer),
    );
  }
}

export class CXSourceLocation {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;

  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXSourceLocation.#constructable !== true) {
      throw new Error("CXSourceLocation is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXSourceLocation {
    CXSourceLocation.#constructable = true;
    const result = new CXSourceLocation(tu, buffer);
    CXSourceLocation.#constructable = false;
    return result;
  }

  get [BUFFER](): Uint8Array {
    return this.#buffer;
  }

  static getNullLocation(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      null,
      libclang.symbols.clang_getNullLocation(),
    );
  }

  equals(other: CXSourceLocation): boolean {
    return libclang.symbols.clang_equalLocations(
      this.#buffer,
      other.#buffer,
    ) !== 0;
  }

  isInSystemHeader(): boolean {
    return libclang.symbols.clang_Location_isInSystemHeader(this.#buffer) !== 0;
  }

  isFromMainFile(): boolean {
    return libclang.symbols.clang_Location_isFromMainFile(this.#buffer) !== 0;
  }

  /**
   * @deprecated
   */
  clang_getInstantiationLocation(): {
    file: CXFile;
    line: number;
    column: number;
    offset: number;
  } {
    if (this.tu === null) {
      throw new Error(
        "Cannot get instantiation location of null source location",
      );
    }
    const cxfileOut = new Uint8Array(8 + 4 * 3);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4, 8 + 4 * 2);
    const offsetOut = cxfileOut.subarray(8 + 4 * 2);
    libclang.symbols.clang_getInstantiationLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
      offsetOut,
    );
    const file = CXFile[CONSTRUCTOR](
      this.tu,
      Number(new BigUint64Array(cxfileOut.buffer, 0, 1)[0]),
    );
    const unsignedArray = new Uint32Array(cxfileOut.buffer, 8, 3);
    const [line, column, offset] = unsignedArray;
    return {
      file,
      line,
      column,
      offset,
    };
  }

  getExpansionLocation(): {
    file: CXFile;
    line: number;
    column: number;
    offset: number;
  } {
    if (this.tu === null) {
      throw new Error("Cannot get expansion location of null source location");
    }
    const cxfileOut = new Uint8Array(8 + 4 * 3);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4, 8 + 4 * 2);
    const offsetOut = cxfileOut.subarray(8 + 4 * 2);
    libclang.symbols.clang_getExpansionLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
      offsetOut,
    );
    const file = CXFile[CONSTRUCTOR](
      this.tu,
      Number(new BigUint64Array(cxfileOut.buffer, 0, 1)[0]),
    );
    const unsignedArray = new Uint32Array(cxfileOut.buffer, 8, 3);
    const [line, column, offset] = unsignedArray;
    return {
      file,
      line,
      column,
      offset,
    };
  }

  getPresumedLocation(): {
    file: CXFile;
    line: number;
    column: number;
  } {
    if (this.tu === null) {
      throw new Error("Cannot get presumed location of null source location");
    }
    const cxfileOut = new Uint8Array(8 + 4 * 2);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4);
    libclang.symbols.clang_getPresumedLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
    );
    const file = CXFile[CONSTRUCTOR](
      this.tu,
      Number(new BigUint64Array(cxfileOut.buffer, 0, 1)[0]),
    );
    const unsignedArray = new Uint32Array(cxfileOut.buffer, 8, 2);
    const [line, column] = unsignedArray;
    return {
      file,
      line,
      column,
    };
  }

  getSpellingLocation(): {
    file: CXFile;
    line: number;
    column: number;
    offset: number;
  } {
    if (this.tu === null) {
      throw new Error("Cannot get spelling location of null source location");
    }
    const cxfileOut = new Uint8Array(8 + 4 * 3);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4, 8 + 4 * 2);
    const offsetOut = cxfileOut.subarray(8 + 4 * 2);
    libclang.symbols.clang_getSpellingLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
      offsetOut,
    );
    const file = CXFile[CONSTRUCTOR](
      this.tu,
      Number(new BigUint64Array(cxfileOut.buffer, 0, 1)[0]),
    );
    const unsignedArray = new Uint32Array(cxfileOut.buffer, 8, 3);
    const [line, column, offset] = unsignedArray;
    return {
      file,
      line,
      column,
      offset,
    };
  }

  getFileLocation(): {
    file: CXFile;
    line: number;
    column: number;
    offset: number;
  } {
    if (this.tu === null) {
      throw new Error("Cannot get file location of null source location");
    }
    const cxfileOut = new Uint8Array(8 + 4 * 3);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4, 8 + 4 * 2);
    const offsetOut = cxfileOut.subarray(8 + 4 * 2);
    libclang.symbols.clang_getFileLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
      offsetOut,
    );
    const file = CXFile[CONSTRUCTOR](
      this.tu,
      Number(new BigUint64Array(cxfileOut.buffer, 0, 1)[0]),
    );
    const unsignedArray = new Uint32Array(cxfileOut.buffer, 8, 3);
    const [line, column, offset] = unsignedArray;
    return {
      file,
      line,
      column,
      offset,
    };
  }
}

class CXType {
  static #constructable = false;
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    if (CXType.#constructable !== true) {
      throw new Error("CXType is not constructable");
    }
    this.#buffer = buffer;
  }

  static [CONSTRUCTOR](buffer: Uint8Array): CXType {
    CXType.#constructable = true;
    const result = new CXType(buffer);
    CXType.#constructable = false;
    return result;
  }
}

const PRINTING_POLICY_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_PrintingPolicy_dispose(pointer));
class CXPrintingPolicy {
  static #constructable = false;
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(pointer: Deno.PointerValue) {
    if (CXPrintingPolicy.#constructable !== true) {
      throw new Error("CXPrintingPolicy is not constructable");
    }
    PRINTING_POLICY_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#pointer = pointer;
  }

  static [CONSTRUCTOR](pointer: Deno.PointerValue): CXPrintingPolicy {
    CXPrintingPolicy.#constructable = true;
    const result = new CXPrintingPolicy(pointer);
    CXPrintingPolicy.#constructable = false;
    return result;
  }

  get [POINTER](): Deno.PointerValue {
    return this.#pointer;
  }

  get indentation(): number {
    if (this.#disposed) {
      throw new Error("Cannot get indentation of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Indentation,
    );
  }
  set indentation(value: number) {
    if (this.#disposed) {
      throw new Error("Cannot set indentation of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Indentation,
      value,
    );
  }
  get suppressSpecifiers(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressSpecifiers of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressSpecifiers,
    ) !== 0;
  }
  set suppressSpecifiers(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressSpecifiers of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressSpecifiers,
      value ? 1 : 0,
    );
  }
  get suppressTagKeyword(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressTagKeyword of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressTagKeyword,
    ) !== 0;
  }
  set suppressTagKeyword(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressTagKeyword of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressTagKeyword,
      value ? 1 : 0,
    );
  }
  get includeTagDefinition(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get includeTagDefinition of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeTagDefinition,
    ) !== 0;
  }
  set includeTagDefinition(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set includeTagDefinition of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeTagDefinition,
      value ? 1 : 0,
    );
  }
  get suppressScope(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get suppressScope of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressScope,
    ) !== 0;
  }
  set suppressScope(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set suppressScope of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressScope,
      value ? 1 : 0,
    );
  }
  get suppressUnwrittenScope(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressUnwrittenScope of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressUnwrittenScope,
    ) !== 0;
  }
  set suppressUnwrittenScope(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressUnwrittenScope of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressUnwrittenScope,
      value ? 1 : 0,
    );
  }
  get suppressInitializers(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressInitializers of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressInitializers,
    ) !== 0;
  }
  set suppressInitializers(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressInitializers of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressInitializers,
      value ? 1 : 0,
    );
  }
  get constantArraySizeAsWritten(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get constantArraySizeAsWritten of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantArraySizeAsWritten,
    ) !== 0;
  }
  set constantArraySizeAsWritten(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set constantArraySizeAsWritten of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantArraySizeAsWritten,
      value ? 1 : 0,
    );
  }
  get anonymousTagLocations(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get anonymousTagLocations of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_AnonymousTagLocations,
    ) !== 0;
  }
  set anonymousTagLocations(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set anonymousTagLocations of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_AnonymousTagLocations,
      value ? 1 : 0,
    );
  }
  get suppressStrongLifetime(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressStrongLifetime of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressStrongLifetime,
    ) !== 0;
  }
  set suppressStrongLifetime(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressStrongLifetime of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressStrongLifetime,
      value ? 1 : 0,
    );
  }
  get suppressLifetimeQualifiers(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressLifetimeQualifiers of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressLifetimeQualifiers,
    ) !== 0;
  }
  set suppressLifetimeQualifiers(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressLifetimeQualifiers of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressLifetimeQualifiers,
      value ? 1 : 0,
    );
  }
  get suppressTemplateArgsInCXXConstructors(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressTemplateArgsInCXXConstructors of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty
        .CXPrintingPolicy_SuppressTemplateArgsInCXXConstructors,
    ) !== 0;
  }
  set suppressTemplateArgsInCXXConstructors(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressTemplateArgsInCXXConstructors of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty
        .CXPrintingPolicy_SuppressTemplateArgsInCXXConstructors,
      value ? 1 : 0,
    );
  }
  get bool(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get bool of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Bool,
    ) !== 0;
  }
  set bool(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set bool of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Bool,
      value ? 1 : 0,
    );
  }
  get restrict(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get restrict of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Restrict,
    ) !== 0;
  }
  set restrict(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set restrict of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Restrict,
      value ? 1 : 0,
    );
  }
  get alignof(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get alignof of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Alignof,
    ) !== 0;
  }
  set alignof(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set alignof of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Alignof,
      value ? 1 : 0,
    );
  }
  get underscoreAlignof(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get underscoreAlignof of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UnderscoreAlignof,
    ) !== 0;
  }
  set underscoreAlignof(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set underscoreAlignof of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UnderscoreAlignof,
      value ? 1 : 0,
    );
  }
  get useVoidForZeroParams(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get useVoidForZeroParams of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UseVoidForZeroParams,
    ) !== 0;
  }
  set useVoidForZeroParams(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set useVoidForZeroParams of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UseVoidForZeroParams,
      value ? 1 : 0,
    );
  }
  get terseOutput(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get terseOutput of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_TerseOutput,
    ) !== 0;
  }
  set terseOutput(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set terseOutput of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_TerseOutput,
      value ? 1 : 0,
    );
  }
  get polishForDeclaration(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get polishForDeclaration of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_PolishForDeclaration,
    ) !== 0;
  }
  set polishForDeclaration(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set polishForDeclaration of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_PolishForDeclaration,
      value ? 1 : 0,
    );
  }
  get half(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get half of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Half,
    ) !== 0;
  }
  set half(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set half of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Half,
      value ? 1 : 0,
    );
  }
  get mSWChar(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get mSWChar of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSWChar,
    ) !== 0;
  }
  set mSWChar(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set mSWChar of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSWChar,
      value ? 1 : 0,
    );
  }
  get includeNewlines(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get includeNewlines of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeNewlines,
    ) !== 0;
  }
  set includeNewlines(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set includeNewlines of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeNewlines,
      value ? 1 : 0,
    );
  }
  get mSVCFormatting(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get mSVCFormatting of disposed CXPrintingPolicy");
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSVCFormatting,
    ) !== 0;
  }
  set mSVCFormatting(value: boolean) {
    if (this.#disposed) {
      throw new Error("Cannot set mSVCFormatting of disposed CXPrintingPolicy");
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSVCFormatting,
      value ? 1 : 0,
    );
  }
  get constantsAsWritten(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get constantsAsWritten of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantsAsWritten,
    ) !== 0;
  }
  set constantsAsWritten(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set constantsAsWritten of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantsAsWritten,
      value ? 1 : 0,
    );
  }
  get suppressImplicitBase(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get suppressImplicitBase of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressImplicitBase,
    ) !== 0;
  }
  set suppressImplicitBase(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set suppressImplicitBase of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressImplicitBase,
      value ? 1 : 0,
    );
  }
  get fullyQualifiedName(): boolean {
    if (this.#disposed) {
      throw new Error(
        "Cannot get fullyQualifiedName of disposed CXPrintingPolicy",
      );
    }
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_FullyQualifiedName,
    ) !== 0;
  }
  set fullyQualifiedName(value: boolean) {
    if (this.#disposed) {
      throw new Error(
        "Cannot set fullyQualifiedName of disposed CXPrintingPolicy",
      );
    }
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_FullyQualifiedName,
      value ? 1 : 0,
    );
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_PrintingPolicy_dispose(this.#pointer);
    PRINTING_POLICY_FINALIZATION_REGISTRY.unregister(this);
  }
}

const DIAGNOSTIC_SET_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeDiagnosticSet(pointer));
export class CXDiagnosticSet {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  constructor(tu: null | CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXDiagnosticSet.#constructable !== true) {
      throw new Error("CXDiagnosticSet is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    DIAGNOSTIC_SET_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#length = libclang.symbols.clang_getNumDiagnosticsInSet(this.#pointer);
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXDiagnosticSet {
    CXDiagnosticSet.#constructable = true;
    const result = new CXDiagnosticSet(tu, pointer);
    CXDiagnosticSet.#constructable = false;
    return result;
  }

  get length(): number {
    return this.#length;
  }

  at(index: number) {
    if (this.#disposed) {
      throw new Error(
        "Cannot get CXDiagnostic at index from a disposed CXDiagnosticSet",
      );
    } else if (index < 0 || this.#length <= index) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return CXDiagnostic[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getDiagnosticInSet(this.#pointer, index),
    );
  }

  static loadDiagnostics(fileName: string) {
    const errorStringOut = new Uint8Array(8 * 2 + 4);
    const errorOut = errorStringOut.subarray(8 * 2);
    const pointer = libclang.symbols.clang_loadDiagnostics(
      cstr(fileName),
      errorOut,
      errorStringOut,
    );
    if (pointer === NULL) {
      // Error
      const errorNumber = errorOut[0];
      const errorString = cxstringToString(errorStringOut);
      if (errorNumber === CXLoadDiag_Error.CXLoadDiag_InvalidFile) {
        throw new Error(
          "Loading diagnostics failed: File is invalid",
          errorString ? { cause: errorString } : undefined,
        );
      } else if (errorNumber === CXLoadDiag_Error.CXLoadDiag_CannotLoad) {
        throw new Error(
          "Loading diagnostics failed: Could not open file",
          errorString ? { cause: errorString } : undefined,
        );
      } else if (errorNumber === CXLoadDiag_Error.CXLoadDiag_Unknown) {
        throw new Error(
          "Loading diagnostics failed: Unkown error",
          errorString ? { cause: errorString } : undefined,
        );
      } else {
        throw new Error(
          `Loading diagnostics failed: ${
            errorString || "Error code and string missing"
          }`,
        );
      }
    }
    return CXDiagnosticSet[CONSTRUCTOR](null, pointer);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeDiagnosticSet(this.#pointer);
    this.#disposed = true;
    DIAGNOSTIC_SET_FINALIZATION_REGISTRY.unregister(this);
  }
}

const DIAGNOSTIC_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeDiagnostic(pointer));
export class CXDiagnostic {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(tu: null | CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXDiagnostic.#constructable !== true) {
      throw new Error("CXDiagnostic is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    DIAGNOSTIC_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXDiagnostic {
    CXDiagnostic.#constructable = true;
    const result = new CXDiagnostic(tu, pointer);
    CXDiagnostic.#constructable = false;
    return result;
  }

  getChildDiagnostics(): null | CXDiagnosticSet {
    if (this.#disposed) {
      throw new Error("Cannot get children of diposed CXDiagnostic");
    }
    const pointer = libclang.symbols.clang_getChildDiagnostics(this.#pointer);
    if (pointer === NULL) {
      return null;
    }
    const diagnosticSet = CXDiagnosticSet[CONSTRUCTOR](this.tu, pointer);
    // "This CXDiagnosticSet does not need to be released by clang_disposeDiagnosticSet"
    DIAGNOSTIC_FINALIZATION_REGISTRY.unregister(diagnosticSet);
    diagnosticSet.dispose = () => {};
    return diagnosticSet;
  }

  formatDiagnostic(options?: {
    displaySourceLocation: boolean;
    displayColumn: boolean;
    displaySourceRanges: boolean;
    displayOption: boolean;
    displayCategoryId: boolean;
    displayCategoryName: boolean;
  }): string {
    if (this.#disposed) {
      throw new Error("Cannot format disposed CXDiagnostic");
    }
    let opts: number;
    if (!options) {
      opts = libclang.symbols.clang_defaultDiagnosticDisplayOptions();
    } else {
      opts = (options.displayCategoryId
        ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplayCategoryId
        : 0) |
        (options.displayCategoryName
          ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplayCategoryName
          : 0) |
        (
          options.displayColumn
            ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplayColumn
            : 0
        ) | (options.displayOption
          ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplayOption
          : 0) |
        (
          options.displaySourceLocation
            ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplaySourceLocation
            : 0
        ) | (options.displaySourceRanges
          ? CXDiagnosticDisplayOptions.CXDiagnostic_DisplaySourceRanges
          : 0);
    }
    return cxstringToString(
      libclang.symbols.clang_formatDiagnostic(this.#pointer, opts),
    );
  }

  getCategory(): number {
    if (this.#disposed) {
      throw new Error("Cannot get category of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticCategory(this.#pointer);
  }

  /**
   * @deprecated This is now deprecated. Use {@link getCategoryText} instead.
   */
  getCategoryName(): string {
    if (this.#disposed) {
      throw new Error("Cannot get category name of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticCategoryName(
      libclang.symbols.clang_getDiagnosticCategory(this.#pointer),
    ));
  }

  getCategoryText(): string {
    if (this.#disposed) {
      throw new Error("Cannot get category text of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticCategoryText(
      this.#pointer,
    ));
  }

  getLocation(): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location of disposed CXDiagnostic");
    }
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getDiagnosticLocation(this.#pointer),
    );
  }

  getNumberOfRanges(): number {
    if (this.#disposed) {
      throw new Error(
        "Cannot get number of CXSourceRanges of disposed CXDiagnostic",
      );
    }
    return libclang.symbols.clang_getDiagnosticNumRanges(this.#pointer);
  }

  getOptions(): {
    disabledBy: string;
    enabledBy: string;
  } {
    if (this.#disposed) {
      throw new Error("Cannot get options of disposed CXDiagnostic");
    }
    const enabledByCxstring = libclang.symbols.clang_getDiagnosticOption(
      this.#pointer,
      OUT,
    );

    const disabledBy = cxstringToString(OUT);
    const enabledBy = cxstringToString(enabledByCxstring);
    return {
      disabledBy,
      enabledBy,
    };
  }

  getRange(index: number): CXSourceRange {
    if (this.#disposed) {
      throw new Error("Cannot get range of disposed CXDiagnostic");
    } else if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getDiagnosticRange(this.#pointer, index),
    );
  }

  getSeverity(): CXDiagnosticSeverity {
    if (this.#disposed) {
      throw new Error("Cannot get severity of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticSeverity(this.#pointer);
  }

  getSpelling(): string {
    if (this.#disposed) {
      throw new Error("Cannot get spelling of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticSpelling(
      this.#pointer,
    ));
  }

  getNumberOfFixIts(): number {
    if (this.#disposed) {
      throw new Error("Cannot get number of FixIts of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticNumFixIts(this.#pointer);
  }

  getFixIt(index: number): {
    replacementText: string;
    sourceRange: CXSourceRange;
  } {
    if (this.#disposed) {
      throw new Error("Cannot get FixIt of disposed CXDiagnostic");
    } else if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    const sourceRangeBuffer = new Uint8Array(8 * 3);
    const cxstring = libclang.symbols.clang_getDiagnosticFixIt(
      this.#pointer,
      index,
      sourceRangeBuffer,
    );
    const replacementText = cxstringToString(cxstring);
    const sourceRange = CXSourceRange[CONSTRUCTOR](this.tu, sourceRangeBuffer);
    return {
      replacementText,
      sourceRange,
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeDiagnostic(this.#pointer);
    this.#disposed = true;
    DIAGNOSTIC_FINALIZATION_REGISTRY.unregister(this);
  }
}

const REMAPPINGS_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_remap_dispose(pointer));
export class CXRemapping {
  #pointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  constructor(fileNames: string | string[]) {
    if (typeof fileNames === "string") {
      this.#pointer = libclang.symbols.clang_getRemappings(cstr(fileNames));
    } else {
      this.#pointer = libclang.symbols.clang_getRemappingsFromFileList(
        new CStringArray(fileNames),
        fileNames.length,
      );
    }
    if (this.#pointer === NULL) {
      throw new Error("Failed to create get CXRemappings");
    }
    REMAPPINGS_FINALIZATION_REGISTRY.register(this, this.#pointer, this);
    this.#length = libclang.symbols.clang_remap_getNumFiles(
      this.#pointer,
    );
  }

  get length(): number {
    return this.#length;
  }

  getFileNames(index: number): { original: string; transformed: string } {
    if (this.#disposed) {
      throw new Error("Cannot get file names of disposed CXRemapping");
    } else if (index < 0 || this.length <= index) {
      throw new Error(
        "Invalid argument, index must be unsigned integer within half-open range [0, length)",
      );
    }
    const transformedOut = new Uint8Array(16);
    libclang.symbols.clang_remap_getFilenames(
      this.#pointer,
      index,
      OUT,
      transformedOut,
    );
    const original = cxstringToString(OUT);
    const transformed = cxstringToString(transformedOut);
    return {
      original,
      transformed,
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_remap_dispose(this.#pointer);
    this.#disposed = true;
    REMAPPINGS_FINALIZATION_REGISTRY.unregister(this);
  }
}

const TOKEN_POINTER_USAGE_MAP = new Map<
  Deno.PointerValue,
  { tu: Deno.PointerValue; count: number; disposed: number }
>();
const disposeToken = (pointer: Deno.PointerValue) => {
  const entry = TOKEN_POINTER_USAGE_MAP.get(pointer);
  if (!entry) {
    console.error(
      "Tried to dispose CXToken for which no base pointer exists anymore! Double-free!",
    );
    Deno.exit(-1);
  }
  entry.disposed++;
  if (entry.disposed === entry.count) {
    libclang.symbols.clang_disposeTokens(entry.tu, pointer, entry.count);
    TOKEN_POINTER_USAGE_MAP.delete(pointer);
  }
};
const TOKEN_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => disposeToken(pointer));
class CXToken {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #buffer: Uint8Array;
  #kind: CXTokenKind;
  #disposed = false;

  constructor(
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
    buffer: Uint8Array,
  ) {
    if (CXToken.#constructable !== true) {
      throw new Error("CXToken is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    const usageEntry = TOKEN_POINTER_USAGE_MAP.get(pointer);
    if (usageEntry) {
      usageEntry.count++;
    } else {
      TOKEN_POINTER_USAGE_MAP.set(pointer, {
        count: 1,
        disposed: 0,
        tu: tu[POINTER],
      });
    }
    TOKEN_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#buffer = buffer;
    this.#kind = libclang.symbols.clang_getTokenKind(this.#buffer);
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
    buffer: Uint8Array,
  ): CXToken {
    CXToken.#constructable = true;
    const result = new CXToken(tu, pointer, buffer);
    CXToken.#constructable = false;
    return result;
  }

  get kind() {
    return this.#kind;
  }

  get [BUFFER]() {
    return this.#buffer;
  }

  getExtent(): CXSourceRange {
    if (this.#disposed) {
      throw new Error("Cannot get extent of disposed CXToken");
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTokenExtent(this.tu[POINTER], this.#buffer),
    );
  }

  getLocation(): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location of disposed CXToken");
    }
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTokenLocation(this.tu[POINTER], this.#buffer),
    );
  }

  getSpelling(): string {
    if (this.#disposed) {
      throw new Error("Cannot get spelling of disposed CXToken");
    }
    return cxstringToString(
      libclang.symbols.clang_getTokenSpelling(this.tu[POINTER], this.#buffer),
    );
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    disposeToken(this.#pointer);
    TOKEN_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
