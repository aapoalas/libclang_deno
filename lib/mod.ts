import { libclang } from "./ffi.ts";
import {
  CX_CXXAccessSpecifier,
  CX_StorageClass,
  CXAvailabilityKind,
  CXCallingConv,
  CXChildVisitResult,
  CXCodeComplete_Flags,
  CXCommentInlineCommandRenderKind,
  CXCommentKind,
  CXCommentParamPassDirection,
  CXCompletionChunkKind,
  CXCursor_ExceptionSpecificationKind,
  CXCursorAndRangeVisitorCallbackDefinition,
  CXCursorKind,
  CXCursorVisitorCallbackDefinition,
  CXDiagnosticDisplayOptions,
  CXDiagnosticSeverity,
  CXErrorCode,
  CXEvalResultKind,
  CXFieldVisitorCallbackDefinition,
  CXGlobalOptFlags,
  CXInclusionVisitorCallbackDefinition,
  CXLanguageKind,
  CXLinkageKind,
  CXLoadDiag_Error,
  CXNameRefFlags,
  CXPrintingPolicyProperty,
  CXRefQualifierKind,
  CXReparse_Flags,
  CXResult,
  CXSaveError,
  CXTemplateArgumentKind,
  CXTLSKind,
  CXTokenKind,
  CXTranslationUnit_Flags,
  CXTypeKind,
  CXTypeLayoutError,
  CXTypeNullabilityKind,
  CXVisibilityKind,
  CXVisitorResult,
  NULL,
  NULLBUF,
} from "./include/typeDefinitions.ts";
import {
  charBufferToString,
  cstr,
  CStringArray,
  cxstringSetToStringArray,
  cxstringToString,
  throwIfError,
} from "./utils.ts";
export * from "./CompilationDatabase.ts";
export * from "./ModuleMapDescriptor.ts";
export * from "./VirtualFileOverlay.ts";
export type {
  CXCodeCompleteResults,
  CXCompletionString,
  CXEvalResult,
  CXIndexAction,
  CXModule,
  CXPrintingPolicy,
  CXRewriter,
  CXSourceRangeList,
  CXToken,
  CXTUResourceUsage,
  CXType,
};

const CONSTRUCTOR = Symbol("[[constructor]]");
const POINTER = Symbol("[[pointer]]");
const BUFFER = Symbol("[[buffer]]");
const DISPOSE = Symbol("[[dispose]]");
const REGISTER = Symbol("[[register]]");
const DEREGISTER = Symbol("[[deregister]]");

const OUT = new Uint8Array(16);
const OUT_64 = new BigUint64Array(OUT.buffer);

let CURRENT_TU: null | CXTranslationUnit = null;

let CURRENT_CURSOR_VISITOR_CALLBACK: (
  cursor: CXCursor,
  parent: CXCursor,
) => CXChildVisitResult = () => {
  // Take advantage of Deno internally handling throwing callback functions by explicitly returning
  // 0, which happens to be the `CXChildVisitResult.CXChildVisit_Break` value.
  throw new Error("Invalid CXCursorVisitor callback");
};
const CX_CURSOR_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXCursorVisitorCallbackDefinition,
  (cursor, parent, _client_data) => {
    return CURRENT_CURSOR_VISITOR_CALLBACK(
      CXCursor[CONSTRUCTOR](CURRENT_TU, cursor),
      CXCursor[CONSTRUCTOR](CURRENT_TU, parent),
    );
  },
);

let CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK: (
  cursor: CXCursor,
  range: CXSourceRange,
) => CXVisitorResult = () => {
  // Take advantage of Deno internally handling throwing callback functions by explicitly returning
  // 0, which happens to be the `CXVisitorResult.CXVisit_Break` value.
  throw new Error("Invalid CXCursorAndRangeVisitor callback");
};
const CX_CURSOR_AND_RANGE_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXCursorAndRangeVisitorCallbackDefinition,
  (_context: Deno.PointerValue, cursor, range) => {
    return CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK(
      CXCursor[CONSTRUCTOR](CURRENT_TU, cursor),
      CXSourceRange[CONSTRUCTOR](CURRENT_TU, range),
    );
  },
);

let CURRENT_INCLUSION_VISITOR_CALLBACK: (
  includedFile: CXFile,
  inclusionStack: CXSourceLocation[],
) => void = () => {
  throw new Error("Invalid CXInclusionVisitor callback");
};
const CX_INCLUSION_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXInclusionVisitorCallbackDefinition,
  (includedFilePointer, inclusionStackPointer, includeLength, _clientData) => {
    const tu = CURRENT_TU!;
    const includedFile = CXFile[CONSTRUCTOR](tu, includedFilePointer);
    const inclusionStack: CXSourceLocation[] = [];
    for (let i = 0; i < includeLength; i++) {
      inclusionStack.push(
        CXSourceLocation[CONSTRUCTOR](
          tu,
          new Uint8Array(Deno.UnsafePointerView.getArrayBuffer(
            inclusionStackPointer,
            3 * 8,
            i * 3 * 8,
          )),
        ),
      );
    }
    CURRENT_INCLUSION_VISITOR_CALLBACK(
      includedFile,
      inclusionStack,
    );
  },
);

const INVALID_FIELD_VISITOR_CALLBACK = (): CXVisitorResult =>
  CXVisitorResult.CXVisit_Break;
let CURRENT_FIELD_VISITOR_CALLBACK: (cursor: CXCursor) => CXVisitorResult =
  INVALID_FIELD_VISITOR_CALLBACK;
const CX_FIELD_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXFieldVisitorCallbackDefinition,
  (cursor, _userData): CXVisitorResult => {
    return CURRENT_FIELD_VISITOR_CALLBACK(
      CXCursor[CONSTRUCTOR](CURRENT_TU!, cursor),
    );
  },
);

/**
 * When called with `true`, installs error handler that prints error message
 * to stderr and calls abort(). This replaces the currently installed error
 * handler (if any).
 *
 * When called with `false`, removes the currently installed error handler (if any).
 * If no error handler is intalled, the default strategy is to print error
 * message to stderr and call exit(1).
 */
export const setAbortOnFatalError = (value: boolean) => {
  if (value) {
    libclang.symbols.clang_install_aborting_llvm_fatal_error_handler();
  } else {
    libclang.symbols.clang_uninstall_llvm_fatal_error_handler();
  }
};

/**
 * Return a version string, suitable for showing to a user, but not
 * intended to be parsed (the format is not guaranteed to be stable).
 *
 * @example
 * "clang version 14.0.6"
 */
export const getClangVersion = (): string =>
  cxstringToString(libclang.symbols.clang_getClangVersion());
/**
 * Return the timestamp for use with Clang's
 * `-fbuild-session-timestamp=` option.
 */
export const getBuildSessionTimestamp = (): bigint =>
  BigInt(libclang.symbols.clang_getBuildSessionTimestamp());

export const toggleCrashRecovery = (value: boolean) =>
  libclang.symbols.clang_toggleCrashRecovery(Number(value));
export const enableStackTraces = () =>
  libclang.symbols.clang_enableStackTraces();

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
    const result: CXErrorCode = libclang.symbols.clang_parseTranslationUnit2(
      this.#pointer,
      source_filename,
      command_line_args,
      commandLineArguments.length,
      NULLBUF,
      0,
      options,
      OUT,
    );

    const pointer = Number(OUT_64[0]);
    throwIfError(result, "Parsing CXTranslationUnit failed");

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

  // createTranslationUnitFromSourceFile(
  //  arg_0: CXIndex, arg_1: constCharPtr, arg_2: int, arg_3: constCharPtr, arg_4: unsigned, arg_5: CXUnsavedFile, arg_6: )  {
  //    libclang.symbols.clang_createTranslationUnitFromSourceFile(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6);
  // }
  // parseTranslationUnit2FullArgv(
  //  arg_0: CXIndex, arg_1: constCharPtr, arg_2: CStringArray, arg_3: int, arg_4: CXUnsavedFile, arg_5: unsigned, arg_6: unsigned, arg_7: out(CXTranslationUnitT), arg_8: )  {
  //    libclang.symbols.clang_parseTranslationUnit2FullArgv(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7, arg_8);
  // }

  createIndexAction(): CXIndexAction {
    return CXIndexAction[CONSTRUCTOR](
      libclang.symbols.clang_IndexAction_create(this.#pointer),
    );
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

const INDEX_ACTION_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_IndexAction_dispose(pointer));

class CXIndexAction {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXIndexAction.#constructable !== true) {
      throw new Error("CXIndexAction is not constructable");
    }
    this.#pointer = pointer;
    INDEX_ACTION_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  static [CONSTRUCTOR](
    pointer: Deno.PointerValue,
  ): CXIndexAction {
    CXIndexAction.#constructable = true;
    const result = new CXIndexAction(pointer);
    CXIndexAction.#constructable = false;
    return result;
  }

  // indexSourceFile(callbacks: [], options: CXIndexOptFlags[])  {
  //   libclang.symbols.clang_indexSourceFile(this.#pointer, NULL, new Uint8Array(), 0, options.reduce((acc, flag) => acc | flag, 0), NULL, arg_6, arg_7, arg_8, arg_9, arg_10, arg_11, arg_12);
  // }

  // indexSourceFileFullArgv(arg_0: CXIndexAction, arg_1: CXClientData, arg_2: buf(IndexerCallbacks), arg_3: unsigned, arg_4: unsigned, arg_5: constCharPtr, arg_6: string, arg_7: int, arg_8: CXUnsavedFile, arg_9: unsigned, arg_10: CXTranslationUnit, arg_11: unsigned, arg_12: asd)  { libclang.symbols.clang_indexSourceFileFullArgv(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7, arg_8, arg_9, arg_10, arg_11, arg_12); }

  // indexTranslationUnit(arg_0: CXIndexAction, arg_1: CXClientData, arg_2: IndexerCallbacks, arg_3: unsigned, arg_4: unsigned, arg_5: CXTranslationUnit, arg_6: asd )  { libclang.symbols.clang_indexTranslationUnit(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6); }

  dispose(): void {
    libclang.symbols.clang_IndexAction_dispose(this.#pointer);
    INDEX_ACTION_FINALIZATION_REGISTRY.unregister(this);
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

  getDefaultEditingOptions(): CXReparse_Flags {
    return libclang.symbols.clang_defaultEditingTranslationUnitOptions();
  }

  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTranslationUnitSpelling(this.#pointer),
    );
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
    libclang.symbols.clang_TargetInfo_dispose(targetInfo);
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

  getCursor(sourceLocation?: CXSourceLocation): CXCursor {
    if (this.#disposed) {
      throw new Error("Cannot get cursor from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get cursor from suspended CXTranslationUnit");
    }
    const cursor: Uint8Array = sourceLocation
      ? libclang.symbols.clang_getCursor(this.#pointer, sourceLocation[BUFFER])
      : libclang.symbols.clang_getTranslationUnitCursor(
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

  createRewriter(): CXRewriter {
    return CXRewriter[CONSTRUCTOR](
      this,
      libclang.symbols.clang_CXRewriter_create(this.#pointer),
    );
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

  defaultSaveOptions(): number {
    return libclang.symbols.clang_defaultSaveOptions(this.#pointer);
  }
  getModuleForFile(file: CXFile): null | CXModule {
    const result = libclang.symbols.clang_getModuleForFile(
      this.#pointer,
      file[POINTER],
    );
    if (result === NULL) {
      return null;
    }
    return CXModule[CONSTRUCTOR](this, result);
  }

  getInclusions(
    callback: (file: CXFile, inclusionStack: CXSourceLocation[]) => void,
  ): void {
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_INCLUSION_VISITOR_CALLBACK;
    CURRENT_TU = this;
    CURRENT_INCLUSION_VISITOR_CALLBACK = callback;
    try {
      libclang.symbols.clang_getInclusions(
        this.#pointer,
        CX_INCLUSION_VISITOR_CALLBACK.pointer,
        NULL,
      );
    } finally {
      CURRENT_TU = savedTu;
      CURRENT_INCLUSION_VISITOR_CALLBACK = savedCallback;
    }
  }

  findIncludesInFile(
    file: CXFile,
    callback: (cursor: CXCursor, sourceRange: CXSourceRange) => CXVisitorResult,
  ): CXResult {
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK;
    CURRENT_TU = this;
    CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK = callback;
    OUT_64[1] = BigInt(CX_CURSOR_AND_RANGE_VISITOR_CALLBACK.pointer);
    try {
      const result = libclang.symbols.clang_findIncludesInFile(
        this.#pointer,
        file[POINTER],
        OUT.subarray(0, 16),
      );
      return result;
    } finally {
      CURRENT_TU = savedTu;
      CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK = savedCallback;
    }
  }

  codeCompleteAt(
    fileName: string,
    line: number,
    column: number,
    _unsavedFiles: never[] = [],
    flags: CXCodeComplete_Flags[],
  ) {
    const options: number = flags
      ? flags.reduce((acc, flag) => acc | flag, 0)
      : libclang.symbols.clang_defaultCodeCompleteOptions();

    const result = libclang.symbols.clang_codeCompleteAt(
      this.#pointer,
      cstr(fileName),
      line,
      column,
      NULLBUF,
      0,
      options,
    );
    if (result === NULL) {
      return null;
    }

    return CXCodeCompleteResults[CONSTRUCTOR](this, result);
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

  [DISPOSE](): void {
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

const COMPLETION_RESULTS_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeCodeCompleteResults(pointer));

class CXCodeCompleteResults {
  static #constructable = false;
  #pointer: Deno.PointerValue;
  #resultsPointer: Deno.PointerValue;
  #numberOfResults: number;
  tu: CXTranslationUnit;
  #resultsArray?: {
    kind: CXCursorKind;
    completionString: CXCompletionString;
  }[];

  constructor(
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ) {
    if (CXCodeCompleteResults.#constructable !== true) {
      throw new Error("CXCodeCompleteResults is not constructable");
    }
    this.#pointer = pointer;
    const view = new Deno.UnsafePointerView(pointer);
    this.#resultsPointer = view.getBigUint64();
    this.#numberOfResults = view.getUint32(8);
    this.tu = tu;
    COMPLETION_RESULTS_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  get results(): {
    kind: CXCursorKind;
    completionString: CXCompletionString;
  }[] {
    if (!this.#resultsArray) {
      this.#resultsArray = [];
      const view = new Deno.UnsafePointerView(this.#resultsPointer);
      for (let i = 0; i < this.#numberOfResults; i++) {
        const kind = view.getUint32(i * 2 * 8);
        const completionStringPointer = view.getBigUint64((i * 2 + 1) * 8);
        this.#resultsArray.push({
          kind,
          completionString: CXCompletionString[CONSTRUCTOR](
            completionStringPointer,
          ),
        });
      }
    }

    return this.#resultsArray;
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXCodeCompleteResults {
    CXCodeCompleteResults.#constructable = true;
    const result = new CXCodeCompleteResults(tu, pointer);
    CXCodeCompleteResults.#constructable = false;
    return result;
  }

  getNumberOfFixIts(index: number): number {
    return libclang.symbols.clang_getCompletionNumFixIts(this.#pointer, index);
  }

  getFixIt(
    completionIndex: number,
    fixitIndex: number,
    replacementRange: CXSourceRange,
  ): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionFixIt(
        this.#pointer,
        completionIndex,
        fixitIndex,
        replacementRange[BUFFER],
      ),
    );
  }

  sortCodeCompletionResults(): void {
    libclang.symbols.clang_sortCodeCompletionResults(
      this.#resultsPointer,
      this.#numberOfResults,
    );
    if (this.#resultsArray) {
      // Remove cached value
      this.#resultsArray = undefined;
    }
  }

  disposeCodeCompleteResults(): void {
    libclang.symbols.clang_disposeCodeCompleteResults(this.#pointer);
  }

  getNumberOfDiagnostics(): number {
    return libclang.symbols.clang_codeCompleteGetNumDiagnostics(this.#pointer);
  }

  getDiagnostic(index: number): null | CXDiagnostic {
    const result = libclang.symbols.clang_codeCompleteGetDiagnostic(
      this.#pointer,
      index,
    );
    if (result === NULL) {
      return null;
    }
    return CXDiagnostic[CONSTRUCTOR](
      this.tu,
      result,
    );
  }

  getContexts(): number | bigint {
    return libclang.symbols.clang_codeCompleteGetContexts(this.#pointer);
  }

  getContainerKind(): {
    kind: CXCursorKind;
    isIncomplete: boolean;
  } {
    const kind = libclang.symbols.clang_codeCompleteGetContainerKind(
      this.#pointer,
      OUT,
    );
    return {
      kind,
      isIncomplete: (OUT[0] + OUT[1] + OUT[2] + OUT[3]) > 0,
    };
  }

  getContainerUSR(): string {
    return cxstringToString(
      libclang.symbols.clang_codeCompleteGetContainerUSR(this.#pointer),
    );
  }

  getObjCSelector(): string {
    return cxstringToString(
      libclang.symbols.clang_codeCompleteGetObjCSelector(this.#pointer),
    );
  }

  dispose(): void {
    libclang.symbols.clang_disposeCodeCompleteResults(this.#pointer);
    COMPLETION_RESULTS_FINALIZATION_REGISTRY.unregister(this);
  }
}

interface CXTUResourceUsageEntry {
  kind: string;
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
      kind: Deno.UnsafePointerView.getCString(
        libclang.symbols.clang_getTUResourceUsageName(kind),
      ),
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

  get [POINTER]() {
    return this.#pointer;
  }

  [DISPOSE](): void {
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

  getName(): string {
    return cxstringToString(libclang.symbols.clang_getFileName(this.#pointer));
  }

  getTime(): number | bigint {
    return libclang.symbols.clang_getFileTime(this.#pointer);
  }

  getUniqueID(): `${number}-${number}-${number}` {
    const out = new BigUint64Array(3);
    const result = libclang.symbols.clang_getFileUniqueID(
      this.#pointer,
      new Uint8Array(out.buffer),
    );
    if (result) {
      throw new Error("Failed to get file unique ID");
    }
    return `${Number(out[0])}-${Number(out[1])}-${Number(out[2])}`;
  }

  tryGetRealPathName(): string {
    return cxstringToString(
      libclang.symbols.clang_File_tryGetRealPathName(this.#pointer),
    );
  }

  getContents(): string {
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

const OVERRIDDEN_CURSORS_FINALIZATION_REGISTRY = new FinalizationRegistry<
  {
    pointer: Deno.PointerValue;
    count: number;
  }
>(
  (key) => {
    key.count--;
    if (key.count === 0) {
      libclang.symbols.clang_disposeOverriddenCursors(key.pointer);
    }
  },
);

export type SemVerString = `${number}.${number}.${number}`;

export interface AvailabilityEntry {
  deprecated: SemVerString;
  introduced: SemVerString;
  message: string;
  obsoleted: SemVerString;
  platform: string;
  unavailable: boolean;
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

  isReference(): boolean {
    return libclang.symbols.clang_isReference(this.kind) > 0;
  }

  isExpression(): boolean {
    return libclang.symbols.clang_isExpression(this.kind) > 0;
  }

  isStatement(): boolean {
    return libclang.symbols.clang_isStatement(this.kind) > 0;
  }

  isAttribute(): boolean {
    return libclang.symbols.clang_isAttribute(this.kind) > 0;
  }

  isInvalid(): boolean {
    return libclang.symbols.clang_isInvalid(this.kind) > 0;
  }

  isTranslationUnit(): boolean {
    return libclang.symbols.clang_isTranslationUnit(this.kind) > 0;
  }

  isPreprocessing(): boolean {
    return libclang.symbols.clang_isPreprocessing(this.kind) > 0;
  }

  isUnexposed(): boolean {
    return libclang.symbols.clang_isUnexposed(this.kind) > 0;
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

  getPlatformAvailability(): {
    alwaysDeprecated: boolean;
    alwaysUnavailable: boolean;
    availability: AvailabilityEntry[];
    deprecatedMessage: string;
    unavailableMessage: string;
  } {
    // First get the number of platforms availability information is available for.
    // At the same time get the other information.
    const deprecatedMessageOut = new Uint8Array(32);
    const unavailableMessageOut = deprecatedMessageOut.subarray(16);
    const numberOfPlatforms = libclang.symbols
      .clang_getCursorPlatformAvailability(
        this.#buffer,
        OUT,
        deprecatedMessageOut,
        OUT.subarray(4),
        unavailableMessageOut,
        NULLBUF,
        0,
      );
    const deprecatedMessage = cxstringToString(deprecatedMessageOut);
    const unavailableMessage = cxstringToString(unavailableMessageOut);
    const out32 = new Uint32Array(OUT.buffer, 0, 2);
    const alwaysDeprecated = out32[0] > 0;
    const alwaysUnavailable = out32[1] > 0;

    const availability: AvailabilityEntry[] = [];
    const result = {
      alwaysDeprecated,
      alwaysUnavailable,
      availability,
      deprecatedMessage,
      unavailableMessage,
    };

    if (numberOfPlatforms === 0) {
      return result;
    }

    // Construct a buffer large enough to accept all the availability data.
    let availabilityBuffer = new Uint8Array(72 * numberOfPlatforms);
    // Call the API again to populate the availability data.
    libclang.symbols.clang_getCursorPlatformAvailability(
      this.#buffer,
      NULLBUF,
      NULLBUF,
      NULLBUF,
      NULLBUF,
      availabilityBuffer,
      numberOfPlatforms,
    );
    // Iterate over the platforms and construct availability objects for each.
    for (let i = 0; i < numberOfPlatforms; i++) {
      if (i) {
        // Move the iteration to the next availability struct.
        availabilityBuffer = availabilityBuffer.subarray(72);
      }
      const platform = cxstringToString(
        availabilityBuffer.subarray(0, 16),
      );
      const message = cxstringToString(
        availabilityBuffer.subarray(72 - 16),
      );
      const view = new DataView(
        availabilityBuffer.buffer,
        16,
        72 - 16,
      );
      const introduced: SemVerString = `${view.getInt32(0, true)}.${
        view.getInt32(4)
      }.${view.getInt32(8)}`;
      const deprecated: SemVerString = `${view.getInt32(12, true)}.${
        view.getInt32(16)
      }.${view.getInt32(20)}`;
      const obsoleted: SemVerString = `${view.getInt32(24, true)}.${
        view.getInt32(28)
      }.${view.getInt32(32)}`;
      const unavailable = view.getInt32(36, true) !== 0;
      availability.push({
        deprecated,
        introduced,
        message,
        obsoleted,
        platform,
        unavailable,
      });
      // Dispose of the struct before moving onto the next one.
      libclang.symbols.clang_disposeCXPlatformAvailability(availabilityBuffer);
    }

    return result;
  }

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

  getOverriddenCursors(): CXCursor[] {
    const OUT_2 = OUT.subarray(8, 12);
    const out32 = new Uint32Array(OUT_2.buffer, 8, 1);
    libclang.symbols.clang_getOverriddenCursors(this.#buffer, OUT, OUT_2);
    const length = out32[0];
    const cursors: CXCursor[] = [];
    const overriddenCursorsPointer = Number(OUT_64[0]);
    if (length === 0 || overriddenCursorsPointer === NULL) {
      return cursors;
    }
    const key = {
      pointer: overriddenCursorsPointer,
      count: length,
    };
    for (let i = 0; i < length; i++) {
      const buffer = new Uint8Array(Deno.UnsafePointerView.getArrayBuffer(
        overriddenCursorsPointer,
        8 * 4,
        i * 8 * 4,
      ));
      const cursor = CXCursor[CONSTRUCTOR](this.tu, buffer);
      OVERRIDDEN_CURSORS_FINALIZATION_REGISTRY.register(cursor, key);
      cursors.push(cursor);
    }
    return cursors;
  }

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
      this.tu!,
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

  getKindSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorKindSpelling(
        libclang.symbols.clang_getCursorKind(this.#buffer),
      ),
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
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_CURSOR_VISITOR_CALLBACK;
    CURRENT_TU = this.tu;
    CURRENT_CURSOR_VISITOR_CALLBACK = callback;
    try {
      const result = libclang.symbols.clang_visitChildren(
        this.#buffer,
        CX_CURSOR_VISITOR_CALLBACK.pointer,
        NULL,
      ) > 0;
      return result;
    } finally {
      CURRENT_TU = savedTu;
      CURRENT_CURSOR_VISITOR_CALLBACK = savedCallback;
    }
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

  getLocation(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorLocation(this.#buffer),
    );
  }

  getExtent(): CXSourceRange {
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorExtent(this.#buffer),
    );
  }

  getType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getCursorType(this.#buffer),
    );
  }

  getTypedefDeclarationOfUnderlyingType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getTypedefDeclUnderlyingType(this.#buffer),
    );
  }

  getEnumDeclarationIntegerType(): CXType {
    if (this.kind !== CXCursorKind.CXCursor_EnumDecl) {
      throw new Error("Not an EnumDecl");
    }
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getEnumDeclIntegerType(this.#buffer),
    );
  }

  getEnumConstantDeclarationValue(): Deno.PointerValue {
    return libclang.symbols.clang_getEnumConstantDeclValue(this.#buffer);
  }

  getEnumConstantDeclarationUnsignedValue(): Deno.PointerValue {
    return libclang.symbols.clang_getEnumConstantDeclUnsignedValue(
      this.#buffer,
    );
  }

  getFieldDeclarationBitWidth(): number {
    return libclang.symbols.clang_getFieldDeclBitWidth(this.#buffer);
  }

  getNumberOfArguments(): number {
    return libclang.symbols.clang_Cursor_getNumArguments(this.#buffer);
  }

  getArgument(index: number): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getArgument(this.#buffer, index),
    );
  }

  getNumberOfTemplateArguments(): number {
    return libclang.symbols.clang_Cursor_getNumTemplateArguments(this.#buffer);
  }

  getTemplateArgumentKind(index: number): CXTemplateArgumentKind {
    return libclang.symbols.clang_Cursor_getTemplateArgumentKind(
      this.#buffer,
      index,
    );
  }

  getTemplateArgumentType(index: number): CXType {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_Cursor_getTemplateArgumentType(
        this.#buffer,
        index,
      ),
    );
  }

  getTemplateArgumentValue(index: number): Deno.PointerValue {
    return libclang.symbols.clang_Cursor_getTemplateArgumentValue(
      this.#buffer,
      index,
    );
  }

  getTemplateArgumentUnsignedValue(index: number): Deno.PointerValue {
    return libclang.symbols.clang_Cursor_getTemplateArgumentUnsignedValue(
      this.#buffer,
      index,
    );
  }

  isMacroFunctionLike(): boolean {
    return libclang.symbols.clang_Cursor_isMacroFunctionLike(this.#buffer) > 0;
  }

  isMacroBuiltin(): boolean {
    return libclang.symbols.clang_Cursor_isMacroBuiltin(this.#buffer) > 0;
  }

  isFunctionInlined(): boolean {
    return libclang.symbols.clang_Cursor_isFunctionInlined(this.#buffer) > 0;
  }

  getDeclObjCTypeEncoding(): string {
    return cxstringToString(
      libclang.symbols.clang_getDeclObjCTypeEncoding(this.#buffer),
    );
  }

  getResultType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getCursorResultType(this.#buffer),
    );
  }

  getExceptionSpecificationType(): CXCursor_ExceptionSpecificationKind {
    return libclang.symbols.clang_getCursorExceptionSpecificationType(
      this.#buffer,
    );
  }

  getOffsetOfField(): number {
    return Number(libclang.symbols.clang_Cursor_getOffsetOfField(this.#buffer));
  }

  isAnonymous(): boolean {
    return libclang.symbols.clang_Cursor_isAnonymous(this.#buffer) > 0;
  }

  isAnonymousRecordDecl(): boolean {
    return libclang.symbols.clang_Cursor_isAnonymousRecordDecl(this.#buffer) >
      0;
  }

  isInlineNamespace(): boolean {
    return libclang.symbols.clang_Cursor_isInlineNamespace(this.#buffer) > 0;
  }

  isBitField(): boolean {
    return libclang.symbols.clang_Cursor_isBitField(this.#buffer) > 0;
  }

  isVirtualBase(): boolean {
    return libclang.symbols.clang_isVirtualBase(this.#buffer) > 0;
  }

  getCXXAccessSpecifier(): CX_CXXAccessSpecifier {
    return libclang.symbols.clang_getCXXAccessSpecifier(this.#buffer);
  }

  getStorageClass(): CX_StorageClass {
    return libclang.symbols.clang_Cursor_getStorageClass(this.#buffer);
  }

  getNumberOfOverloadedDeclarations(): number {
    return libclang.symbols.clang_getNumOverloadedDecls(this.#buffer);
  }

  getOverloadedDeclaration(index: number) {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getOverloadedDecl(this.#buffer, index),
    );
  }

  getIBOutletCollectionType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getIBOutletCollectionType(this.#buffer),
    );
  }

  isInvalidDeclaration(): boolean {
    return libclang.symbols.clang_isInvalidDeclaration(this.#buffer) > 0;
  }
  hasVarDeclGlobalStorage(): boolean {
    return libclang.symbols.clang_Cursor_hasVarDeclGlobalStorage(
      this.#buffer,
    ) !== 0;
  }
  getSpellingNameRange(pieceIndex: number): CXSourceRange {
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getSpellingNameRange(
        this.#buffer,
        pieceIndex,
        0,
      ),
    );
  }
  getMangling(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getMangling(this.#buffer),
    );
  }
  getDefinitionSpellingAndExtent(): [
    string,
    string,
    number,
    number,
    number,
    number,
  ] {
    const arg1 = OUT;
    const arg2 = OUT.subarray(8);
    const arg3 = OUT.subarray(12);
    const arg4 = OUT.subarray(16);
    const arg5 = OUT.subarray(20);
    const arg6 = OUT.subarray(24);
    libclang.symbols.clang_getDefinitionSpellingAndExtent(
      this.#buffer,
      arg1,
      arg2,
      arg3,
      arg4,
      arg5,
      arg6,
    );
    const out32 = new Uint32Array(OUT, 16, 4);
    return [
      Deno.UnsafePointerView.getCString(OUT_64[0]),
      Deno.UnsafePointerView.getCString(OUT_64[1]),
      ...out32 as unknown as [number, number, number, number],
    ];
  }
  getCompletionString(): null | CXCompletionString {
    const result = libclang.symbols.clang_getCursorCompletionString(
      this.#buffer,
    );
    if (result === NULL) {
      return null;
    }
    return CXCompletionString[CONSTRUCTOR](
      result,
    );
  }
  Evaluate(): CXEvalResult {
    return CXEvalResult[CONSTRUCTOR](
      libclang.symbols.clang_Cursor_Evaluate(this.#buffer),
    );
  }
  findReferencesInFile(
    file: CXFile,
    callback: (cursor: CXCursor, range: CXSourceRange) => CXVisitorResult,
  ): CXResult {
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK;
    CURRENT_TU = this.tu;
    CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK = callback;
    OUT_64[1] = BigInt(CX_CURSOR_AND_RANGE_VISITOR_CALLBACK.pointer);
    try {
      const result = libclang.symbols.clang_findReferencesInFile(
        this.#buffer,
        file[POINTER],
        OUT.subarray(0, 16),
      );
      return result;
    } finally {
      CURRENT_TU = savedTu;
      CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK = savedCallback;
    }
  }
}

class CXCompletionString {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXCompletionString.#constructable !== true) {
      throw new Error("CXCompletionString is not constructable");
    }
    this.#pointer = pointer;
  }

  static [CONSTRUCTOR](
    pointer: Deno.PointerValue,
  ): CXCompletionString {
    CXCompletionString.#constructable = true;
    const result = new CXCompletionString(pointer);
    CXCompletionString.#constructable = false;
    return result;
  }

  getChunkKind(index: number): CXCompletionChunkKind {
    return libclang.symbols.clang_getCompletionChunkKind(this.#pointer, index);
  }
  getChunkText(index: number): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionChunkText(this.#pointer, index),
    );
  }
  getChunkCompletionString(arg_1: number): null | CXCompletionString {
    const result = libclang.symbols.clang_getCompletionChunkCompletionString(
      this.#pointer,
      arg_1,
    );
    if (result === NULL) {
      return null;
    }
    return CXCompletionString[CONSTRUCTOR](result);
  }
  getNumberOfCompletionChunks(): number {
    return libclang.symbols.clang_getNumCompletionChunks(this.#pointer);
  }
  getPriority(): number {
    return libclang.symbols.clang_getCompletionPriority(this.#pointer);
  }
  getAvailability(): CXAvailabilityKind {
    return libclang.symbols.clang_getCompletionAvailability(this.#pointer);
  }
  getNumberOfAnnotations(): number {
    return libclang.symbols.clang_getCompletionNumAnnotations(this.#pointer);
  }
  getAnnotation(arg_1: number): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionAnnotation(this.#pointer, arg_1),
    );
  }
  getParent(): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionParent(this.#pointer, NULLBUF),
    );
  }
  getBriefComment(): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionBriefComment(this.#pointer),
    );
  }
}

const EVAL_RESULT_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_EvalResult_dispose(pointer));

class CXEvalResult {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXEvalResult.#constructable !== true) {
      throw new Error("CXEvalResult is not constructable");
    }
    this.#pointer = pointer;
    EVAL_RESULT_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  static [CONSTRUCTOR](
    pointer: Deno.PointerValue,
  ): CXEvalResult {
    CXEvalResult.#constructable = true;
    const result = new CXEvalResult(pointer);
    CXEvalResult.#constructable = false;
    return result;
  }

  getKind(): CXEvalResultKind {
    return libclang.symbols.clang_EvalResult_getKind(this.#pointer);
  }
  getAsInt(): number {
    return libclang.symbols.clang_EvalResult_getAsInt(this.#pointer);
  }
  getAsLongLong(): number | bigint {
    return libclang.symbols.clang_EvalResult_getAsLongLong(this.#pointer);
  }
  isUnsignedInt(): number {
    return libclang.symbols.clang_EvalResult_isUnsignedInt(this.#pointer);
  }
  getAsUnsigned(): number | bigint {
    return libclang.symbols.clang_EvalResult_getAsUnsigned(this.#pointer);
  }
  getAsDouble(): number {
    return libclang.symbols.clang_EvalResult_getAsDouble(this.#pointer);
  }
  getAsStr(): string {
    return Deno.UnsafePointerView.getCString(
      libclang.symbols.clang_EvalResult_getAsStr(this.#pointer),
    );
  }
  dispose(): void {
    libclang.symbols.clang_EvalResult_dispose(this.#pointer);
    EVAL_RESULT_FINALIZATION_REGISTRY.unregister(this);
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

  getName(): string {
    return cxstringToString(
      libclang.symbols.clang_Module_getName(this.#pointer),
    );
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

export class CXComment {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;
  #kind?: number;
  #childCount?: number;
  #argCount?: number;

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

  getKindSpelling(): string {
    switch (this.kind) {
      case CXCommentKind.CXComment_Null:
        return "CXComment_Null";
      case CXCommentKind.CXComment_Text:
        return "CXComment_Text";
      case CXCommentKind.CXComment_InlineCommand:
        return "CXComment_InlineCommand";
      case CXCommentKind.CXComment_HTMLStartTag:
        return "CXComment_HTMLStartTag";
      case CXCommentKind.CXComment_HTMLEndTag:
        return "CXComment_HTMLEndTag";
      case CXCommentKind.CXComment_Paragraph:
        return "CXComment_Paragraph";
      case CXCommentKind.CXComment_BlockCommand:
        return "CXComment_BlockCommand";
      case CXCommentKind.CXComment_ParamCommand:
        return "CXComment_ParamCommand";
      case CXCommentKind.CXComment_TParamCommand:
        return "CXComment_TParamCommand";
      case CXCommentKind.CXComment_VerbatimBlockCommand:
        return "CXComment_VerbatimBlockCommand";
      case CXCommentKind.CXComment_VerbatimBlockLine:
        return "CXComment_VerbatimBlockLine";
      case CXCommentKind.CXComment_VerbatimLine:
        return "CXComment_VerbatimLine";
      case CXCommentKind.CXComment_FullComment:
        return "CXComment_FullComment";
    }
    throw new Error("Invalid CXComment, unknown kind");
  }

  getNumberOfChildren(): number {
    return this.#childCount ??
      (this.#childCount = libclang.symbols.clang_Comment_getNumChildren(
        this.#buffer,
      ));
  }

  getChild(index: number): CXComment {
    const length = this.getNumberOfChildren();
    if (index < 0 || length <= index) {
      throw new Error(
        "Invalid argument, index must be unsigned integer within bounds",
      );
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
      return this.#argCount ??
        (this.#argCount = libclang.symbols
          .clang_InlineCommandComment_getNumArgs(
            this.#buffer,
          ));
    } else {
      return this.#argCount ??
        (this.#argCount = libclang.symbols.clang_BlockCommandComment_getNumArgs(
          this.#buffer,
        ));
    }
  }

  getArgumentText(index: number): string {
    const length = this.getNumberOfArguments();
    if (index < 0 || length <= index) {
      throw new Error(
        "Invalid argument, index must be unsigned integer within bounds",
      );
    } else if (this.#isInlineCommandContent()) {
      return cxstringToString(
        libclang.symbols.clang_InlineCommandComment_getArgText(
          this.#buffer,
          index,
        ),
      );
    } else {
      return cxstringToString(
        libclang.symbols.clang_BlockCommandComment_getArgText(
          this.#buffer,
          index,
        ),
      );
    }
  }

  getTagName(): string {
    const kind = this.kind;
    if (
      kind !== CXCommentKind.CXComment_HTMLEndTag &&
      kind !== CXCommentKind.CXComment_HTMLStartTag
    ) {
      throw new Error("Not HTMLTagComment");
    }
    return cxstringToString(
      libclang.symbols.clang_HTMLTagComment_getTagName(this.#buffer),
    );
  }

  isSelfClosing(): boolean {
    return libclang.symbols.clang_HTMLStartTagComment_isSelfClosing(
      this.#buffer,
    ) !== 0;
  }

  getAttributes(): Record<string, string> {
    if (this.kind !== CXCommentKind.CXComment_HTMLStartTag) {
      throw new Error("Not HTMLStartTag");
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

  getParagraph(): CXComment {
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

  #innerVisitChildren(
    callback: (
      comment: CXComment,
      parent: CXComment,
      index: number,
      children: CXComment[],
    ) => CXChildVisitResult,
  ): CXChildVisitResult {
    const length = this.getNumberOfChildren();
    const children = Array.from({ length }, (_, i) => this.getChild(i));
    for (let i = 0; i < length; i++) {
      const child = children[i];
      const result = callback(child, this, i, children);
      switch (result) {
        case CXChildVisitResult.CXChildVisit_Break:
          return CXChildVisitResult.CXChildVisit_Break;
        case CXChildVisitResult.CXChildVisit_Continue:
          continue;
        case CXChildVisitResult.CXChildVisit_Recurse: {
          const recurseResult = child.#innerVisitChildren(callback);
          if (recurseResult === CXChildVisitResult.CXChildVisit_Break) {
            return CXChildVisitResult.CXChildVisit_Break;
          }
        }
      }
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  }

  visitChildren(
    callback: (
      comment: CXComment,
      parent: CXComment,
      index: number,
      children: CXComment[],
    ) => CXChildVisitResult,
  ): boolean {
    return this.#innerVisitChildren(callback) ===
      CXChildVisitResult.CXChildVisit_Break;
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

  static getNullRange(): CXSourceRange {
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
  #kind?: CXTypeKind;
  tu: CXTranslationUnit;

  constructor(tu: CXTranslationUnit, buffer: Uint8Array) {
    if (CXType.#constructable !== true) {
      throw new Error("CXType is not constructable");
    }
    this.#buffer = buffer;
    this.tu = tu;
  }

  static [CONSTRUCTOR](tu: CXTranslationUnit, buffer: Uint8Array): CXType {
    CXType.#constructable = true;
    const result = new CXType(tu, buffer);
    CXType.#constructable = false;
    return result;
  }

  get kind(): CXTypeKind {
    if (this.#kind === undefined) {
      this.#kind = new DataView(this.#buffer.buffer).getUint32(0, true);
    }

    return this.#kind;
  }

  equals(other: CXType) {
    libclang.symbols.clang_equalTypes(this.#buffer, other.#buffer);
  }

  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypeSpelling(this.#buffer),
    );
  }

  getCanonicalType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCanonicalType(this.#buffer),
    );
  }

  isConstQualifiedType(): boolean {
    return libclang.symbols.clang_isConstQualifiedType(this.#buffer) > 0;
  }
  isVolatileQualifiedType(): boolean {
    return libclang.symbols.clang_isVolatileQualifiedType(this.#buffer) > 0;
  }
  isRestrictQualifiedType(): boolean {
    return libclang.symbols.clang_isRestrictQualifiedType(this.#buffer) > 0;
  }
  getAddressSpace(): number {
    return libclang.symbols.clang_getAddressSpace(this.#buffer);
  }
  getTypedefName(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypedefName(this.#buffer),
    );
  }
  getPointeeType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getPointeeType(this.#buffer),
    );
  }
  getTypeDeclaration(): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTypeDeclaration(this.#buffer),
    );
  }
  getObjCEncoding(): string {
    return cxstringToString(
      libclang.symbols.clang_Type_getObjCEncoding(this.#buffer),
    );
  }
  getKindSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypeKindSpelling(this.kind),
    );
  }
  getFunctionTypeCallingConvention(): CXCallingConv {
    return libclang.symbols.clang_getFunctionTypeCallingConv(this.#buffer);
  }
  getResultType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getResultType(this.#buffer),
    );
  }
  getExceptionSpecificationType(): CXCursor_ExceptionSpecificationKind {
    return libclang.symbols.clang_getExceptionSpecificationType(this.#buffer);
  }
  getNumberOfArgumentTypes(): number {
    return libclang.symbols.clang_getNumArgTypes(this.#buffer);
  }
  getArgumentType(index: number): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getArgType(this.#buffer, index),
    );
  }
  getObjCObjectBaseType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCObjectBaseType(this.#buffer),
    );
  }
  getNumberOfObjCProtocolRefs(): number {
    return libclang.symbols.clang_Type_getNumObjCProtocolRefs(this.#buffer);
  }
  getObjCProtocolDecl(index: number): CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCProtocolDecl(this.#buffer, index),
    );
  }
  getNumberOfObjCTypeArguments(): number {
    return libclang.symbols.clang_Type_getNumObjCTypeArgs(this.#buffer);
  }
  getObjCTypeArgument(index: number): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCTypeArg(this.#buffer, index),
    );
  }
  isFunctionTypeVariadic(): boolean {
    return libclang.symbols.clang_isFunctionTypeVariadic(this.#buffer) > 0;
  }
  isPODType(): boolean {
    return libclang.symbols.clang_isPODType(this.#buffer) > 0;
  }
  getElementType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getElementType(this.#buffer),
    );
  }
  getNumberOfElements(): number {
    return Number(libclang.symbols.clang_getNumElements(this.#buffer));
  }
  getArrayElementType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getArrayElementType(this.#buffer),
    );
  }
  getArraySize(): number {
    return Number(libclang.symbols.clang_getArraySize(this.#buffer));
  }
  getNamedType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getNamedType(this.#buffer),
    );
  }
  isTransparentTagTypedef(): boolean {
    return libclang.symbols.clang_Type_isTransparentTagTypedef(this.#buffer) >
      0;
  }
  getNullability(): CXTypeNullabilityKind {
    return libclang.symbols.clang_Type_getNullability(this.#buffer);
  }
  getAlignOf(): number {
    return Number(libclang.symbols.clang_Type_getAlignOf(this.#buffer));
  }
  getClassType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getClassType(this.#buffer),
    );
  }
  getSizeOf(): number {
    return Number(libclang.symbols.clang_Type_getSizeOf(this.#buffer));
  }
  getOffsetOf(fieldName: string): number | CXTypeLayoutError {
    return Number(
      libclang.symbols.clang_Type_getOffsetOf(this.#buffer, cstr(fieldName)),
    );
  }
  getModifiedType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getModifiedType(this.#buffer),
    );
  }
  getValueType(): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getValueType(this.#buffer),
    );
  }
  getNumberOfTemplateArguments(): number {
    return libclang.symbols.clang_Type_getNumTemplateArguments(this.#buffer);
  }
  getTemplateArgumentAsType(index: number): CXType {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getTemplateArgumentAsType(
        this.#buffer,
        index,
      ),
    );
  }
  getCXXRefQualifier(): CXRefQualifierKind {
    return libclang.symbols.clang_Type_getCXXRefQualifier(this.#buffer);
  }
  visitFields(callback: (cursor: CXCursor) => CXVisitorResult): boolean {
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_FIELD_VISITOR_CALLBACK;
    CURRENT_TU = this.tu;
    CURRENT_FIELD_VISITOR_CALLBACK = callback;
    try {
      const result = libclang.symbols.clang_Type_visitFields(
        this.#buffer,
        CX_FIELD_VISITOR_CALLBACK.pointer,
        NULL,
      );
      return result > 0;
    } finally {
      CURRENT_TU = savedTu;
      CURRENT_FIELD_VISITOR_CALLBACK = savedCallback;
    }
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
    const result = libclang.symbols.clang_formatDiagnostic(this.#pointer, opts);
    return cxstringToString(
      result,
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

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    disposeToken(this.#pointer);
    TOKEN_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}

const REWRITER_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_CXRewriter_dispose(pointer));

class CXRewriter {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;

  constructor(
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ) {
    if (CXRewriter.#constructable !== true) {
      throw new Error("CXRewriter is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    REWRITER_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXRewriter {
    CXRewriter.#constructable = true;
    const result = new CXRewriter(tu, pointer);
    CXRewriter.#constructable = false;
    return result;
  }

  replaceText(
    range: CXSourceRange,
    replacement: string,
  ): void {
    libclang.symbols.clang_CXRewriter_replaceText(
      this.#pointer,
      range[BUFFER],
      cstr(replacement),
    );
  }
  removeText(range: CXSourceRange): void {
    libclang.symbols.clang_CXRewriter_removeText(this.#pointer, range[BUFFER]);
  }
  overwriteChangedFiles(): boolean {
    return libclang.symbols.clang_CXRewriter_overwriteChangedFiles(
      this.#pointer,
    ) > 0;
  }
  writeMainFileToStdOut(): void {
    libclang.symbols.clang_CXRewriter_writeMainFileToStdOut(this.#pointer);
  }
  dispose(): void {
    libclang.symbols.clang_CXRewriter_dispose(this.#pointer);
    REWRITER_FINALIZATION_REGISTRY.unregister(this);
  }
}
