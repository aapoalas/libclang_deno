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
  CXCompletionContext,
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
  CXObjCDeclQualifierKind,
  CXObjCPropertyAttrKind,
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
} from "./include/typeDefinitions.ts";
import {
  charBufferToString,
  cstr,
  CStringArray,
  cxstringSetToStringArray,
  cxstringToString,
  NULL,
  NULLBUF,
  throwIfError,
} from "./utils.ts";
export * from "./BuildSystem.ts";
export * from "./CXCompilationDatabase.ts";
export {
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
  CXCompletionContext,
  CXCursor_ExceptionSpecificationKind,
  CXCursorKind,
  CXDiagnosticDisplayOptions,
  CXDiagnosticSeverity,
  CXErrorCode,
  CXEvalResultKind,
  CXGlobalOptFlags,
  CXLanguageKind,
  CXLinkageKind,
  CXLoadDiag_Error,
  CXNameRefFlags,
  CXObjCDeclQualifierKind,
  CXObjCPropertyAttrKind,
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
};
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
      CXCursor[CONSTRUCTOR](CURRENT_TU, cursor)!,
      CXCursor[CONSTRUCTOR](CURRENT_TU, parent)!,
    );
  },
);

let CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK: (
  cursor: CXCursor,
  range: null | CXSourceRange,
) => CXVisitorResult = () => {
  // Take advantage of Deno internally handling throwing callback functions by explicitly returning
  // 0, which happens to be the `CXVisitorResult.CXVisit_Break` value.
  throw new Error("Invalid CXCursorAndRangeVisitor callback");
};
const CX_CURSOR_AND_RANGE_VISITOR_CALLBACK = new Deno.UnsafeCallback(
  CXCursorAndRangeVisitorCallbackDefinition,
  (_context: Deno.PointerValue, cursor, range) => {
    return CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK(
      CXCursor[CONSTRUCTOR](CURRENT_TU, cursor)!,
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
      CXCursor[CONSTRUCTOR](CURRENT_TU!, cursor)!,
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
export const setAbortOnFatalError = (value: boolean): void => {
  if (value) {
    if ("clang_install_aborting_llvm_fatal_error_handler" in libclang.symbols) {
      libclang.symbols.clang_install_aborting_llvm_fatal_error_handler();
    }
  } else {
    if ("clang_uninstall_llvm_fatal_error_handler" in libclang.symbols) {
      libclang.symbols.clang_uninstall_llvm_fatal_error_handler();
    }
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

/**
 * Enable/disable crash recovery.
 *
 * @param isEnabled Flag to indicate if crash recovery is enabled.
 */
export const toggleCrashRecovery = (isEnabled: boolean) =>
  libclang.symbols.clang_toggleCrashRecovery(Number(isEnabled));
/** for debug/testing */
export const enableStackTraces = () =>
  libclang.symbols.clang_enableStackTraces();

export interface GlobalOptions {
  /**
   * Used to indicate that threads that libclang creates for indexing
   * purposes should use background priority.
   *
   * Affects {@link CXIndexAction#indexSourceFile}, {@link CXIndexAction.indexTranslationUnit},
   * {@link CXIndex#parseTranslationUnit}, {@link CXTranslationUnit#save}.
   */
  threadBackgroundPriorityForIndexing: boolean;
  /**
   * Used to indicate that threads that libclang creates for editing
   * purposes should use background priority.
   *
   * Affects {@link CXIndex#reparseTranslationUnit}, {@link CXTranslationUnit#codeCompleteAt},
   * {@link CXTranslationUnit#annotateTokens}
   */
  threadBackgroundPriorityForEditing: boolean;
}

const INDEX_FINALIZATION_REGISTRY = new FinalizationRegistry<Deno.PointerValue>(
  (pointer) => libclang.symbols.clang_disposeIndex(pointer),
);
/**
 * An "index" that consists of a set of translation units that would
 * typically be linked together into an executable or library.
 */
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

  /**
   * Gets the general options associated with a CXIndex.
   *
   * @returns Object of options associated with the given CXIndex object.
   */
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

  /**
   * Sets general options associated with a CXIndex.
   */
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

  /**
   * Parse the given source file and return the translation unit corresponding
   * to that file. An error is thrown if something went wrong in the parsing.
   *
   * This routine is the main entry point for the Clang C API, providing the
   * ability to parse a source file into a translation unit that can then be
   * queried by other functions in the API. This routine accepts a set of
   * command-line arguments so that the compilation can be configured in the same
   * way that the compiler is configured on the command line.
   *
   * @param fileName The name of the source file to load.
   * @param commandLineArguments The command-line arguments that would be
   * passed to the `clang` executable if it were being invoked out-of-process.
   * These command-line options will be parsed and will affect how the translation
   * unit is parsed. Note that the following options are ignored: '-c',
   * '-emit-ast', '-fsyntax-only' (which is the default), and '-o <output file>'.
   * @param flags An array of CXTranslationUnit_XXX flags that affects how the translation unit
   * is managed but not its compilation.
   */
  parseTranslationUnit(
    fileName: string,
    commandLineArguments: string[] = [],
    flags?: CXTranslationUnit_Flags[],
  ): CXTranslationUnit {
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

  /**
   * Returns the set of flags that is suitable for parsing a translation
   * unit that is being edited.
   *
   * The set of flags returned provide options for {@link parseTranslationUnit}
   * to indicate that the translation unit is likely to be reparsed many times,
   * either explicitly (via {@link CXTranslationUnit#reparse}) or implicitly
   * (e.g., by code completion (`clang_codeCompletionAt()`)). The returned flag
   * set contains an unspecified set of optimizations (e.g., the precompiled
   * preamble) geared toward improving the performance of these routines. The
   * set of optimizations enabled may change from one version to the next.
   */
  static getDefaultEditingOptions(): CXReparse_Flags {
    return libclang.symbols.clang_defaultEditingTranslationUnitOptions();
  }

  /**
   * Sets the invocation emission path option in a CXIndex.
   *
   * The invocation emission path specifies a path which will contain log
   * files for certain libclang invocations. A null value (default) implies that
   * libclang invocations are not logged.
   */
  setInvocationEmissionPathOption(path: null | string = null): void {
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

  /**
   * Create a translation unit from an AST file (`-emit-ast).`
   * An error is thrown if something went wrong in the parsing.
   *
   * @param astFileName AST file
   */
  createTranslationUnit(astFileName: string): CXTranslationUnit {
    if (this.#disposed) {
      throw new Error("Cannot create translation unit in disposed CXIndex");
    }
    const result = libclang.symbols.clang_createTranslationUnit2(
      this.#pointer,
      cstr(astFileName),
      OUT,
    );
    throwIfError(result, "Parsing CXTranslationUnit failed");

    const pointer = Number(OUT_64[0]);
    const tu = CXTranslationUnit[CONSTRUCTOR](pointer);
    this.translationUnits.set(astFileName, tu);
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

  /**
   * An indexing action/session, to be applied to one or multiple
   * translation units.
   */
  createIndexAction(): CXIndexAction {
    return CXIndexAction[CONSTRUCTOR](
      libclang.symbols.clang_IndexAction_create(this.#pointer),
    );
  }

  /**
   * Destroy the given index.
   *
   * Destroying the index will destroy all the translation units created
   * within that index. It is not strictly necessary to call this method,
   * the memory will be released as part of JavaScript garbage collection.
   */
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

/**
 * An indexing action/session, to be applied to one or multiple
 * translation units.
 *
 * @hideconstructor
 */
class CXIndexAction {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXIndexAction.#constructable !== true) {
      throw new Error("CXIndexAction is not constructable");
    }
    this.#pointer = pointer;
    INDEX_ACTION_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * Destroy the given index action.
   *
   * The index action must not be destroyed until all of the translation units
   * created within that index action have been destroyed.
   */
  dispose(): void {
    libclang.symbols.clang_IndexAction_dispose(this.#pointer);
    INDEX_ACTION_FINALIZATION_REGISTRY.unregister(this);
  }
}

/**
 * Target information for a given translation unit.
 */
export interface TargetInfo {
  /**
   * Normalized target triple.
   */
  triple: string;
  /**
   * Pointer width of the target in bits.
   */
  pointerWidth: number;
}

/**
 * Provides the contents of a file that has not yet been saved to disk.
 *
 * Each {@link UnsavedFile} instance provides the name of a file on the
 * system along with the current contents of that file that have not
 * yet been saved to disk.
 */
export interface UnsavedFile {
  /**
   * The file whose contents have not yet been saved.
   *
   * This file must already exist in the file system.
   */
  filename: string;
  /**
   * A buffer containing the unsaved contents of this file.
   */
  contents: Uint8Array;
}

interface Dependent {
  [DISPOSE]?(): void;
}

type DependentsSet = Set<WeakRef<Dependent>>;

type CXTranslationUnitCursor<T> = T extends CXSourceLocation ? CXCursor | null
  : CXCursor;

const TU_FINALIZATION_REGISTRY = new FinalizationRegistry<Deno.PointerValue>(
  (tuPointer) => libclang.symbols.clang_disposeTranslationUnit(tuPointer),
);
/**
 * A single translation unit, which resides in a {@link CXIndex}.
 */
export class CXTranslationUnit {
  static #constructable = false;
  #dependents: DependentsSet = new Set();
  #pointer: Deno.PointerValue;
  #disposed = false;
  #suspended = false;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(pointer: Deno.PointerValue) {
    if (!CXTranslationUnit.#constructable) {
      throw new Error("CXTranslationUnit is not constructable");
    }
    this.#pointer = pointer;
    TU_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](pointer: Deno.PointerValue): CXTranslationUnit {
    CXTranslationUnit.#constructable = true;
    const result = new CXTranslationUnit(pointer);
    CXTranslationUnit.#constructable = false;
    return result;
  }

  get [POINTER](): Deno.PointerValue {
    return this.#pointer;
  }

  /**
   * Saves the translation unit into a serialized representation of
   * that translation unit on disk. An error will be thrown if the saving failed.
   *
   * Any translation unit that was parsed without error can be saved
   * into a file. The translation unit can then be deserialized into a
   * new {@link CXTranslationUnit} with {@link CXIndex#createTranslationUnit} or,
   * if it is an incomplete translation unit that corresponds to a
   * header, used as a precompiled header when parsing other translation
   * units.
   *
   * @param fileName The file to which the translation unit will be saved.
   */
  save(
    fileName: string,
    options: number = libclang.symbols.clang_defaultSaveOptions(this.#pointer),
  ): void {
    if (this.#disposed) {
      throw new Error("Cannot save disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot save suspended CXTranslationUnit");
    }
    const saveFileName = cstr(fileName);
    const result = libclang.symbols.clang_saveTranslationUnit(
      this.#pointer,
      saveFileName,
      options,
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

  /**
   * Suspend the translation unit in order to free memory associated with it.
   *
   * A suspended translation unit uses significantly less memory but on the other
   * side does not support any other calls than {@link reparse} to resume it or
   * {@link dispose} to dispose it completely.
   *
   * Any {@link CXCursor}s, {@link CXSourceLocation}s, {@link CXSourceRange}s etc.
   * created from the translation unit will become invalid upon suspending.
   */
  suspend(): number {
    if (this.#disposed) {
      throw new Error("Cannot suspend disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot suspend suspended CXTranslationUnit");
    }
    return libclang.symbols.clang_suspendTranslationUnit(this.#pointer);
  }

  /**
   * Reparse the source files that produced this translation unit. This can
   * only be called on a translation unit that was originally built from source
   * files. An error based on the `CXErrorCode` is thrown if reparsing failed.
   * If an error is thrown, then the translation unit can no longer be used for
   * anything.
   *
   * This routine can be used to re-parse the source files that originally
   * created the translation unit, for example because those source files
   * have changed (either on disk or as passed via `unsavedFiles`). The
   * source code will be reparsed with the same command-line options as it
   * was originally parsed.
   *
   * Reparsing a translation unit invalidates all cursors and source locations
   * that refer into that translation unit. This makes reparsing a translation
   * unit semantically equivalent to destroying the translation unit and then
   * creating a new translation unit with the same command-line arguments.
   * However, it may be more efficient to reparse a translation
   * unit using this routine.
   *
   * @param options A bitset of options composed of the flags in CXReparse_Flags.
   * A default set of options recommended for most uses based on the translation unit
   * is used as a default.
   */
  reparse(
    unsavedFiles: UnsavedFile[] = [],
    options: CXReparse_Flags = libclang.symbols.clang_defaultReparseOptions(
      this.#pointer,
    ),
  ): void {
    if (this.#disposed) {
      throw new Error("Cannot reparse disposed CXTranslationUnit");
    }

    const unsavedFilesCount = unsavedFiles.length;
    const unsavedFilesBuffer: Uint8Array = unsavedFilesCount
      ? new Uint8Array(24 * unsavedFilesCount)
      : NULLBUF;
    let nameBuffers: undefined | Uint8Array[];
    if (unsavedFilesCount) {
      const unsavedFiles64 = new BigUint64Array(unsavedFilesBuffer.buffer);
      nameBuffers = Array.from({ length: unsavedFilesCount });
      for (let i = 0; i < unsavedFilesCount; i++) {
        const unsavedFile = unsavedFiles[i];
        nameBuffers[i] = cstr(unsavedFile.filename);
        unsavedFiles64[i * 3] = BigInt(Deno.UnsafePointer.of(nameBuffers[i]));
        unsavedFiles64[i * 3 + 1] = BigInt(
          Deno.UnsafePointer.of(unsavedFile.contents),
        );
        unsavedFiles64[i * 3 + 2] = BigInt(unsavedFile.contents.length);
      }
    }

    const result = libclang.symbols.clang_reparseTranslationUnit(
      this.#pointer,
      unsavedFilesCount,
      unsavedFilesBuffer,
      options,
    );
    throwIfError(result, "Reparsing CXTranslationUnit failed");
    this.#suspended = false;
  }

  /**
   * Get the original translation unit source file name.
   */
  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTranslationUnitSpelling(this.#pointer),
    );
  }

  /**
   * Get target information for this translation unit.
   */
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

  /**
   * Retrieve all ranges from all files that were skipped by the
   * preprocessor.
   *
   * The preprocessor will skip lines when they are surrounded by an
   * if/ifdef/ifndef directive whose condition does not evaluate to true.
   */
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

  /**
   * Retrieve a diagnostic by index of the translation unit.
   *
   * @param index the zero-based diagnostic number to retrieve.
   */
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

  /**
   * Retrieve the complete set of diagnostics associated with a
   * translation unit.
   */
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

  /**
   * Retrieve a file handle within the translation unit.
   *
   * @param fileName The name of the file.
   * @returns The `CXFile` for the named file in the translation unit `tu,` or `null` if the file was not a part of this translation unit.
   */
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

  /**
   * Determine the number of diagnostics produced for the given
   * translation unit.
   */
  getNumberOfDiagnostics(): number {
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

  /**
   * Retrieve the cursor that represents the translation unit.
   *
   * The translation unit cursor can be used to start traversing the
   * various declarations within the given translation unit.
   *
   * @returns A {@link CXCursor} representing the translation unit.
   */
  getCursor(): CXCursor;
  /**
   * Map a source location to the cursor that describes the entity at that
   * location in the source code.
   *
   * {@link getCursor()} maps an arbitrary source location within a translation
   * unit down to the most specific cursor that describes the entity at that
   * location. For example, given an expression `x + y`, invoking
   * {@link getCursor()} with a source location pointing to "x" will return the
   * cursor for "x"; similarly for "y". If the cursor points anywhere between
   * "x" or "y" (e.g., on the + or the whitespace around it), {@link getCursor()}
   * will return a cursor referring to the "+" expression.
   *
   * @param sourceLocation A {@link CXSourceLocation} pointing to a location in the source code.
   *
   * @returns A {@link CXCursor} representing the entity at the given source location, or
   * `null` if no such entity can be found.
   */
  getCursor(sourceLocation: CXSourceLocation): CXCursor | null;
  getCursor(
    sourceLocation?: CXSourceLocation,
  ) {
    if (this.#disposed) {
      throw new Error("Cannot get cursor from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get cursor from suspended CXTranslationUnit");
    }
    let cursor: Uint8Array;

    if (sourceLocation) {
      cursor = libclang.symbols.clang_getCursor(
        this.#pointer,
        sourceLocation[BUFFER],
      );
      if (sourceLocation && libclang.symbols.clang_Cursor_isNull(cursor)) {
        return null;
      }
    } else {
      cursor = libclang.symbols.clang_getTranslationUnitCursor(
        this.#pointer,
      );
    }
    return CXCursor[CONSTRUCTOR](this, cursor);
  }

  /**
   * Get the memory usage of the translation unit as a {@link CXTUResourceUsage} object.
   */
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

  /**
   * Create a {@link CXRewriter} in the translation unit.
   */
  createRewriter(): CXRewriter {
    return CXRewriter[CONSTRUCTOR](
      this,
      libclang.symbols.clang_CXRewriter_create(this.#pointer),
    );
  }

  /**
   * Annotate the given set of tokens by providing cursors for each token
   * that can be mapped to a specific entity within the abstract syntax tree.
   *
   * This token-annotation routine is equivalent to invoking
   * {@link getCursor()} for the source locations of each of the
   * tokens. The cursors provided are filtered, so that only those
   * cursors that have a direct correspondence to the token are
   * accepted. For example, given a function call `f(x)`, {@link getCursor()}
   * would provide the following cursors:
   *
   * * when the cursor is over the 'f', a `DeclRefExpr` cursor referring to 'f'.
   * * when the cursor is over the '(' or the ')', a `CallExpr` referring to 'f'.
   * * when the cursor is over the 'x', a `DeclRefExpr` cursor referring to 'x'.
   *
   * Only the first and last of these cursors will occur within the
   * annotate, since the tokens "f" and "x' directly refer to a function
   * and a variable, respectively, but the parentheses are just a small
   * part of the full syntax of the function call expression, which is
   * not provided as an annotation.
   *
   * @param tokens The set of tokens to annotate.
   * @returns An array of {@link CXCursor}s.
   */
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
      )!;
    });
  }

  /**
   * Get the raw lexical token starting with the given location.
   *
   * @param location The source location at which the token starts.
   * @returns The {@link CXToken} starting with the given location or `null` if no such token
   * exist.
   */
  getToken(location: CXSourceLocation): null | CXToken {
    if (this.#disposed) {
      throw new Error("Cannot get token from disposed CXTranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get token from suspended CXTranslationUnit");
    }
    const tokenPointer = libclang.symbols.clang_getToken(
      this.#pointer,
      location[BUFFER],
    );
    if (tokenPointer === NULL) {
      return null;
    }
    return CXToken[CONSTRUCTOR](
      this,
      tokenPointer,
      new Uint8Array(
        Deno.UnsafePointerView.getArrayBuffer(tokenPointer, 8 * 3),
      ),
    );
  }

  /**
   * Tokenize the source code described by the given range into raw
   * lexical tokens.
   *
   * @param range The {@link CXSourceRange} in which text should be tokenized. All of the
   * tokens produced by tokenization will fall within this source range.
   *
   * @returns An array of {@link CXToken}s.
   */
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

  /**
   * Returns the set of flags that is suitable for saving a translation
   * unit.
   *
   * The set of flags returned provide options for {@link save()} by
   * default. The returned flag set contains an unspecified set
   * of options that save translation units with the most
   * commonly-requested data.
   */
  defaultSaveOptions(): number {
    return libclang.symbols.clang_defaultSaveOptions(this.#pointer);
  }

  /**
   * Given a {@link CXFile} header file, return the {@link CXModule} that
   * contains it if one exists, or `null` otherwise.
   */
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

  /**
   * Visit the set of preprocessor inclusions in this translation unit.
   * The callback is called for every included file. This does not
   * include headers included by the PCH file (unless one is inspecting
   * the inclusions in the PCH file itself).
   */
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

  /**
   * Find #import/#include directives in a specific file.
   *
   * @param file The {@link CXFile} to search #import/#include directives in.
   * @param callback Callback that will receive pairs of {@link CXCursor}/{@link CXSourceRange} for
   * each directive found.
   * @returns One of the {@link CXResult} values.
   */
  findIncludesInFile(
    file: CXFile,
    callback: (cursor: CXCursor, sourceRange: CXSourceRange) => CXVisitorResult,
  ): CXResult {
    const savedTu = CURRENT_TU;
    const savedCallback = CURRENT_CURSOR_AND_RANGE_VISITOR_CALLBACK;
    CURRENT_TU = this;
    // @ts-expect-error The sourceRange is guaranteed to be non-null.
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

  /**
   * Perform code completion at a given location in this translation unit.
   *
   * This function performs code completion at a particular file, line, and
   * column within source code, providing results that suggest potential
   * code snippets based on the context of the completion. The basic model
   * for code completion is that Clang will parse a complete source file,
   * performing syntax checking up to the location where code-completion has
   * been requested. At that point, a special code-completion token is passed
   * to the parser, which recognizes this token and determines, based on the
   * current location in the C/Objective-C/C++ grammar and the state of
   * semantic analysis, what completions to provide. These completions are
   * returned via a new {@link CXCodeCompleteResults} structure.
   *
   * Code completion itself is meant to be triggered by the client when the
   * user types punctuation characters or whitespace, at which point the
   * code-completion location will coincide with the cursor. For example,
   * if `p` is a pointer, code-completion might be triggered after the "-" and then
   * after the ">" in `p->`. When the code-completion location is after the ">",
   * the completion results will provide, e.g., the members of the struct that
   * "p" points to. The client is responsible for placing the cursor at the
   * beginning of the token currently being typed, then filtering the results
   * based on the contents of the token. For example, when code-completing for
   * the expression `p->get`, the client should provide the location just after
   * the ">" (e.g., pointing at the "g") to this code-completion hook. Then, the
   * client can filter the results based on the current token text ("get"), only
   * showing those results that start with "get". The intent of this interface
   * is to separate the relatively high-latency acquisition of code-completion
   * results from the filtering of results on a per-character basis, which must
   * have a lower latency.
   *
   * The source files for this translation unit need not be
   * completely up-to-date (and the contents of those source files may
   * be overridden via `unsavedFiles`). {@link CXCursor}s referring into this
   * translation unit may be invalidated by this invocation.
   *
   * @param fileName The name of the source file where code
   * completion should be performed. This filename may be any file
   * included in the translation unit.
   * @param line The line at which code-completion should occur.
   * @param column The column at which code-completion should occur.
   * Note that the column should point just after the syntactic construct that
   * initiated code completion, and not in the middle of a lexical token.
   * @param [unsavedFiles] The files that have not yet been saved to disk
   * but may be required for parsing or code completion, including the
   * contents of those files.
   * @param [flags] Extra options that control the behavior of code
   * completion, passed as an array of values of the
   * {@link CXCodeComplete_Flags} enumeration.
   * {@link defaultCodeCompleteFlags()} static method returns the default set
   * of code-completion options.
   * @returns If successful, a new {@link CXCodeCompleteResults} structure
   * containing code-completion results. If code completion fails, returns `null`.
   */
  codeCompleteAt(
    fileName: string,
    line: number,
    column: number,
    unsavedFiles: UnsavedFile[] = [],
    flags: CXCodeComplete_Flags[],
  ): CXCodeCompleteResults | null {
    const options: number = flags
      ? flags.reduce((acc, flag) => acc | flag, 0)
      : libclang.symbols.clang_defaultCodeCompleteOptions();

    const unsavedFilesCount = unsavedFiles.length;
    const unsavedFilesBuffer: Uint8Array = unsavedFilesCount
      ? new Uint8Array(24 * unsavedFilesCount)
      : NULLBUF;
    let nameBuffers: undefined | Uint8Array[];
    if (unsavedFilesCount) {
      const unsavedFiles64 = new BigUint64Array(unsavedFilesBuffer.buffer);
      nameBuffers = Array.from({ length: unsavedFilesCount });
      for (let i = 0; i < unsavedFilesCount; i++) {
        const unsavedFile = unsavedFiles[i];
        nameBuffers[i] = cstr(unsavedFile.filename);
        unsavedFiles64[i * 3] = BigInt(Deno.UnsafePointer.of(nameBuffers[i]));
        unsavedFiles64[i * 3 + 1] = BigInt(
          Deno.UnsafePointer.of(unsavedFile.contents),
        );
        unsavedFiles64[i * 3 + 2] = BigInt(unsavedFile.contents.length);
      }
    }

    const result = libclang.symbols.clang_codeCompleteAt(
      this.#pointer,
      cstr(fileName),
      line,
      column,
      unsavedFilesBuffer,
      unsavedFilesCount,
      options,
    );
    if (result === NULL) {
      return null;
    }

    return CXCodeCompleteResults[CONSTRUCTOR](this, result);
  }

  /**
   * Returns a default set of code-completion options that can be
   * passed to {@link codeCompleteAt()}.
   */
  static defaultCodeCompleteFlags(): CXCodeComplete_Flags[] {
    const options = libclang.symbols.clang_defaultCodeCompleteOptions();
    const flags: CXCodeComplete_Flags[] = [];
    if (
      (options & CXCodeComplete_Flags.CXCodeComplete_IncludeMacros) ===
        CXCodeComplete_Flags.CXCodeComplete_IncludeMacros
    ) {
      flags.push(CXCodeComplete_Flags.CXCodeComplete_IncludeMacros);
    }
    if (
      (options & CXCodeComplete_Flags.CXCodeComplete_IncludeCodePatterns) ===
        CXCodeComplete_Flags.CXCodeComplete_IncludeCodePatterns
    ) {
      flags.push(CXCodeComplete_Flags.CXCodeComplete_IncludeCodePatterns);
    }
    if (
      (options & CXCodeComplete_Flags.CXCodeComplete_IncludeBriefComments) ===
        CXCodeComplete_Flags.CXCodeComplete_IncludeBriefComments
    ) {
      flags.push(CXCodeComplete_Flags.CXCodeComplete_IncludeBriefComments);
    }
    if (
      (options & CXCodeComplete_Flags.CXCodeComplete_SkipPreamble) ===
        CXCodeComplete_Flags.CXCodeComplete_SkipPreamble
    ) {
      flags.push(CXCodeComplete_Flags.CXCodeComplete_SkipPreamble);
    }
    if (
      (options &
        CXCodeComplete_Flags.CXCodeComplete_IncludeCompletionsWithFixIts) ===
        CXCodeComplete_Flags.CXCodeComplete_IncludeCompletionsWithFixIts
    ) {
      flags.push(
        CXCodeComplete_Flags.CXCodeComplete_IncludeCompletionsWithFixIts,
      );
    }
    return flags;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  [REGISTER](dependent: Dependent) {
    this.#dependents.add(new WeakRef(dependent));
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  [DEREGISTER](dependent: Dependent) {
    for (const weakRef of this.#dependents) {
      if (weakRef.deref() == dependent) {
        this.#dependents.delete(weakRef);
        return;
      }
    }
  }

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * Destroy the {@link CXTranslationUnit} object.
   *
   * This will mark all dependent objects (eg. {@link CXCursor},
   * {@link CXTUResourceUsage}) disposed as well as
   * using those is no longer safe. However, this marking
   * is not yet fully implemented and should not be relied on.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
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

/**
 * Contains the results of code-completion.
 *
 * This data structure contains the results of code completion, as
 * produced by {@link CXTranslationUnit.codeCompleteAt()}.
 */
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

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * The list of possible code-completions.
   */
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

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXCodeCompleteResults {
    CXCodeCompleteResults.#constructable = true;
    const result = new CXCodeCompleteResults(tu, pointer);
    CXCodeCompleteResults.#constructable = false;
    return result;
  }

  /**
   * Retrieve the number of fix-its for the given completion index.
   *
   * Calling this makes sense only if {@link CXCodeComplete_Flags.CXCodeComplete_IncludeCompletionsWithFixIts}
   * option was set.
   *
   * @param index The index of the completion.
   * @returns The number of fix-its which must be applied before the completion at
   * `index` can be applied.
   */
  getNumberOfFixIts(index: number): number {
    return libclang.symbols.clang_getCompletionNumFixIts(this.#pointer, index);
  }

  /**
   * Fix-its that *must* be applied before inserting the text for the
   * corresponding completion.
   *
   * By default, {@link CXTranslationUnit#codeCompleteAt()} only returns
   * completions with empty fix-its. Extra completions with non-empty
   * fix-its should be explicitly requested by setting
   * {@link CXCodeComplete_Flags.CXCodeComplete_IncludeCompletionsWithFixIts}.
   *
   * For the clients to be able to compute position of the cursor after applying
   * fix-its, the following conditions are guaranteed to hold for
   * replacement_range of the stored fix-its:
   * - Ranges in the fix-its are guaranteed to never contain the completion
   * point (or identifier under completion point, if any) inside them, except
   * at the start or at the end of the range.
   * - If a fix-it range starts or ends with completion point (or starts or
   * ends after the identifier under completion point), it will contain at
   * least one character. It allows to unambiguously recompute completion
   * point after applying the fix-it.
   *
   * The intuition is that provided fix-its change code around the identifier we
   * complete, but are not allowed to touch the identifier itself or the
   * completion point. One example of completions with corrections are the ones
   * replacing '.' with '->' and vice versa:
   *
   * Example:
   * ```text
   * std::unique_ptr<std::vector<int>> vec_ptr;
   * In 'vec_ptr.^', one of the completions is 'push_back', it requires
   * replacing '.' with '->'.
   * In 'vec_ptr->^', one of the completions is 'release', it requires
   * replacing '->' with '.'.
   * ```
   *
   * @param completionIndex The index of the completion.
   * @param fixitIndex The index of the fix-it for the completion at
   * {@link completionIndex}.
   * @returns The fix-it string and range. The code in the range must be replaced
   * with the string before the completion at {@link completionIndex} can be applied.
   */
  getFixIt(
    completionIndex: number,
    fixitIndex: number,
  ): {
    fixit: string;
    range: CXSourceRange;
  } {
    const replacementRangeBuffer = new Uint8Array(24);
    const fixit = cxstringToString(
      libclang.symbols.clang_getCompletionFixIt(
        this.#pointer,
        completionIndex,
        fixitIndex,
        replacementRangeBuffer,
      ),
    );
    const range = CXSourceRange[CONSTRUCTOR](this.tu, replacementRangeBuffer);
    if (range === null) {
      throw new Error("Out of bounds");
    }
    return {
      fixit,
      range,
    };
  }

  /**
   * Sort the code-completion results in case-insensitive alphabetical
   * order. This recreates the {@link results} array.
   */
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

  /**
   * Determine the number of diagnostics produced prior to the
   * location where code completion was performed.
   */
  getNumberOfDiagnostics(): number {
    return libclang.symbols.clang_codeCompleteGetNumDiagnostics(this.#pointer);
  }

  /**
   * Retrieve a diagnostic associated with this code completion.
   *
   * @param index The zero-based diagnostic number to retrieve.
   * @returns The requested {@link CXDiagnostic}.
   */
  getDiagnostic(index: number): CXDiagnostic {
    const result = libclang.symbols.clang_codeCompleteGetDiagnostic(
      this.#pointer,
      index,
    );
    if (result === NULL) {
      throw new Error("Unexpected null code-complete diagnostic");
    }
    return CXDiagnostic[CONSTRUCTOR](
      this.tu,
      result,
    );
  }

  /**
   * Determines what completions are appropriate for the context
   * this code completion.
   *
   * @returns The an array of {@link CXCompletionContext} that are appropriate for use
   * along with these code completion results.
   */
  getContexts(): CXCompletionContext[] {
    const contexts = Number(
      libclang.symbols.clang_codeCompleteGetContexts(this.#pointer),
    );
    const result: CXCompletionContext[] = [];
    if (
      (contexts & CXCompletionContext.CXCompletionContext_Unexposed) ===
        CXCompletionContext.CXCompletionContext_Unexposed
    ) {
      result.push(CXCompletionContext.CXCompletionContext_Unexposed);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_AnyType) ===
        CXCompletionContext.CXCompletionContext_AnyType
    ) {
      result.push(CXCompletionContext.CXCompletionContext_AnyType);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_AnyValue) ===
        CXCompletionContext.CXCompletionContext_AnyValue
    ) {
      result.push(CXCompletionContext.CXCompletionContext_AnyValue);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCObjectValue) ===
        CXCompletionContext.CXCompletionContext_ObjCObjectValue
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCObjectValue);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCSelectorValue) ===
        CXCompletionContext.CXCompletionContext_ObjCSelectorValue
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCSelectorValue);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_CXXClassTypeValue) ===
        CXCompletionContext.CXCompletionContext_CXXClassTypeValue
    ) {
      result.push(CXCompletionContext.CXCompletionContext_CXXClassTypeValue);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_DotMemberAccess) ===
        CXCompletionContext.CXCompletionContext_DotMemberAccess
    ) {
      result.push(CXCompletionContext.CXCompletionContext_DotMemberAccess);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ArrowMemberAccess) ===
        CXCompletionContext.CXCompletionContext_ArrowMemberAccess
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ArrowMemberAccess);
    }
    if (
      (contexts &
        CXCompletionContext.CXCompletionContext_ObjCPropertyAccess) ===
        CXCompletionContext.CXCompletionContext_ObjCPropertyAccess
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCPropertyAccess);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_EnumTag) ===
        CXCompletionContext.CXCompletionContext_EnumTag
    ) {
      result.push(CXCompletionContext.CXCompletionContext_EnumTag);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_UnionTag) ===
        CXCompletionContext.CXCompletionContext_UnionTag
    ) {
      result.push(CXCompletionContext.CXCompletionContext_UnionTag);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_StructTag) ===
        CXCompletionContext.CXCompletionContext_StructTag
    ) {
      result.push(CXCompletionContext.CXCompletionContext_StructTag);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ClassTag) ===
        CXCompletionContext.CXCompletionContext_ClassTag
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ClassTag);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_Namespace) ===
        CXCompletionContext.CXCompletionContext_Namespace
    ) {
      result.push(CXCompletionContext.CXCompletionContext_Namespace);
    }
    if (
      (contexts &
        CXCompletionContext.CXCompletionContext_NestedNameSpecifier) ===
        CXCompletionContext.CXCompletionContext_NestedNameSpecifier
    ) {
      result.push(CXCompletionContext.CXCompletionContext_NestedNameSpecifier);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCInterface) ===
        CXCompletionContext.CXCompletionContext_ObjCInterface
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCInterface);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCProtocol) ===
        CXCompletionContext.CXCompletionContext_ObjCProtocol
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCProtocol);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCCategory) ===
        CXCompletionContext.CXCompletionContext_ObjCCategory
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCCategory);
    }
    if (
      (contexts &
        CXCompletionContext.CXCompletionContext_ObjCInstanceMessage) ===
        CXCompletionContext.CXCompletionContext_ObjCInstanceMessage
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCInstanceMessage);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCClassMessage) ===
        CXCompletionContext.CXCompletionContext_ObjCClassMessage
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCClassMessage);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_ObjCSelectorName) ===
        CXCompletionContext.CXCompletionContext_ObjCSelectorName
    ) {
      result.push(CXCompletionContext.CXCompletionContext_ObjCSelectorName);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_MacroName) ===
        CXCompletionContext.CXCompletionContext_MacroName
    ) {
      result.push(CXCompletionContext.CXCompletionContext_MacroName);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_NaturalLanguage) ===
        CXCompletionContext.CXCompletionContext_NaturalLanguage
    ) {
      result.push(CXCompletionContext.CXCompletionContext_NaturalLanguage);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_IncludedFile) ===
        CXCompletionContext.CXCompletionContext_IncludedFile
    ) {
      result.push(CXCompletionContext.CXCompletionContext_IncludedFile);
    }
    if (
      (contexts & CXCompletionContext.CXCompletionContext_Unknown) ===
        CXCompletionContext.CXCompletionContext_Unknown
    ) {
      result.push(CXCompletionContext.CXCompletionContext_Unknown);
    }
    return result;
  }

  /**
   * Returns the cursor kind for the container for this code
   * completion context. The container is only guaranteed to be set for
   * contexts where a container exists (i.e. member accesses or Objective-C
   * message sends); if there is not a container, this function will return
   * {@link CXCursorKind.CXCursor_InvalidCode}.
   *
   * @returns The container kind, or {@link CXCursorKind.CXCursor_InvalidCode} if there is no
   * container, and an `incomplete` boolean whose value will be false if Clang has complete
   * information about the container. If Clang does not have complete
   * information, this value will be true.
   */
  getContainerKind(): {
    /**
     * The container kind, or {@link CXCursorKind.CXCursor_InvalidCode} if there is no container.
     */
    kind: CXCursorKind;
    /**
     * `true` if Clang has complete information about the container, `false` otherwise.
     */
    incomplete: boolean;
  } {
    const kind = libclang.symbols.clang_codeCompleteGetContainerKind(
      this.#pointer,
      OUT,
    );
    return {
      kind,
      incomplete: (OUT[0] + OUT[1] + OUT[2] + OUT[3]) > 0,
    };
  }

  /**
   * Returns the USR (Unified Symbol Resolution) for the container for this code completion
   * context. If there is no container for the current context, this
   * function will return the empty string.
   */
  getContainerUSR(): string {
    return cxstringToString(
      libclang.symbols.clang_codeCompleteGetContainerUSR(this.#pointer),
    );
  }

  /**
   * Returns the currently-entered selector for an Objective-C message
   * send, formatted like `"initWithFoo:bar:"`. Only guaranteed to return a
   * non-empty string for {@link CXCompletionContext.CXCompletionContext_ObjCInstanceMessage} and
   * {@link CXCompletionContext.CXCompletionContext_ObjCClassMessage}.
   *
   * @returns The selector (or partial selector) that has been entered thus far
   * for an Objective-C message send.
   */
  getObjCSelector(): string {
    return cxstringToString(
      libclang.symbols.clang_codeCompleteGetObjCSelector(this.#pointer),
    );
  }

  /**
   * Free this set of code-completion results.
   *
   * Calling any methods on the {@link CXCodeCompleteResults}
   * after disposing will result in undefined behaviour. It
   * is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    libclang.symbols.clang_disposeCodeCompleteResults(this.#pointer);
    COMPLETION_RESULTS_FINALIZATION_REGISTRY.unregister(this);
  }
}

interface CXTUResourceUsageEntry {
  /**
   * Human-readable string that represents the name of the memory category.
   */
  kind: string;
  /**
   * Number of bytes used by the memory category.
   */
  bytes: number;
}

const RESOURCE_USAGE_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Uint8Array
>((buffer) => libclang.symbols.clang_disposeCXTUResourceUsage(buffer));
/**
 * The memory usage of a CXTranslationUnit, broken into categories.
 *
 * @hideconstructor
 */
class CXTUResourceUsage {
  static #constructable = false;
  #buffer: Uint8Array;
  #length: number;
  #pointer: Deno.PointerValue;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](buffer: Uint8Array): CXTUResourceUsage {
    CXTUResourceUsage.#constructable = true;
    const result = new CXTUResourceUsage(buffer);
    CXTUResourceUsage.#constructable = false;
    return result;
  }

  /**
   * The number of resource usage entries in this {@link CXTUResourceUsage}.
   */
  get length(): number {
    return this.#length;
  }

  /**
   * Returns the human-readable string name and number of bytes
   * of the memory category at the given {@link index}.
   */
  at(index: number): CXTUResourceUsageEntry {
    if (this.#disposed) {
      throw new Error(
        "Cannot get entry at index of a disposed CXTUResourceUsage",
      );
    }
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

  /**
   * Disposes this {@link CXTUResourceUsage}.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeCXTUResourceUsage(this.#buffer);
    RESOURCE_USAGE_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}

/**
 * A particular source file that is part of a translation unit.
 */
export class CXFile {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: CXTranslationUnit, pointer: Deno.PointerValue) {
    if (!CXFile.#constructable) {
      throw new Error("CXFile is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXFile {
    CXFile.#constructable = true;
    const result = new CXFile(tu, pointer);
    CXFile.#constructable = false;
    return result;
  }

  /**
   * private
   */
  get [POINTER](): Deno.PointerValue {
    return this.#pointer;
  }

  /**
   * private
   */
  [DISPOSE](): void {
    this.#disposed = true;
  }

  /**
   * Returns `true` if this and {@link other} point to the same file.
   */
  equals(other: CXFile): boolean {
    if (this.#disposed || other.#disposed) {
      throw new Error("Cannot compare disposed files");
    }
    return libclang.symbols.clang_File_isEqual(
      this.#pointer,
      other.#pointer,
    ) !== 0;
  }

  /**
   * Retrieve the complete file and path name of this file.
   */
  getName(): string {
    return cxstringToString(libclang.symbols.clang_getFileName(this.#pointer));
  }

  /**
   * Retrieve the last modification time of this file.
   */
  getTime(): number | bigint {
    return libclang.symbols.clang_getFileTime(this.#pointer);
  }

  /**
   * Retrieve the unique ID for this file.
   */
  getUniqueID(): `${number}-${number}-${number}` {
    const result = libclang.symbols.clang_getFileUniqueID(
      this.#pointer,
      OUT,
    );
    if (result) {
      throw new Error("Failed to get file unique ID");
    }
    return `${Number(OUT_64[0])}-${Number(OUT_64[1])}-${Number(OUT_64[2])}`;
  }

  /**
   * Returns the real path name of this file.
   *
   * An empty string may be returned. Use {@link getName()} in that case.
   */
  tryGetRealPathName(): string {
    return cxstringToString(
      libclang.symbols.clang_File_tryGetRealPathName(this.#pointer),
    );
  }

  /**
   * Retrieve the string contents of this file.
   *
   * An error is thrown if the file is not loaded.
   */
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

  /**
   * Retrieves the source location associated in this file at the given line and column.
   */
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

  /**
   * Retrieve all ranges that were skipped by the preprocessor.
   *
   * The preprocessor will skip lines when they are surrounded by an
   * if/ifdef/ifndef directive whose condition does not evaluate to true.
   */
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

  /**
   * Determine whether the given header is guarded against
   * multiple inclusions, either with the conventional
   * \#ifndef/\#define/\#endif macro guards or with \#pragma once.
   */
  isFileMultipleIncludeGuarded(): boolean {
    if (this.#disposed) {
      throw new Error("Cannot get include guard data from disposed CXFile");
    }
    return libclang.symbols.clang_isFileMultipleIncludeGuarded(
      this.tu[POINTER],
      this.#pointer,
    ) > 0;
  }

  /**
   * Retrieves the source location associated with a given character offset.
   */
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
  (key): void => {
    key.count--;
    if (key.count === 0) {
      libclang.symbols.clang_disposeOverriddenCursors(key.pointer);
    }
  },
);

export type SemVerString = `${number}.${number}.${number}`;

/**
 * Describes the availability of a given entity on a particular platform, e.g.,
 * a particular class might only be available on Mac OS 10.7 or newer.
 */
export interface AvailabilityEntry {
  /**
   * The version number in which this entity was deprecated (but is
   * still available).
   */
  deprecated: SemVerString;
  /**
   * The version number in which this entity was introduced.
   */
  introduced: SemVerString;
  /**
   * An optional message to provide to a user of this API, e.g., to
   * suggest replacement APIs.
   */
  message: string;
  /**
   * The version number in which this entity was obsoleted, and therefore
   * is no longer available.
   */
  obsoleted: SemVerString;
  /**
   * A string that describes the platform for which this structure
   * provides availability information.
   *
   * Possible values are "ios" or "macos".
   */
  platform: string;
  /**
   * Whether the entity is unconditionally unavailable on this platform.
   */
  unavailable: boolean;
}

/**
 * A cursor representing some element in the abstract syntax tree for
 * a translation unit.
 *
 * The cursor abstraction unifies the different kinds of entities in a
 * program--declaration, statements, expressions, references to declarations,
 * etc.--under a single "cursor" abstraction with a common set of operations.
 * Common operation for a cursor include: getting the physical location in
 * a source file where the cursor points, getting the name associated with a
 * cursor, and retrieving cursors for any child nodes of a particular cursor.
 *
 * Cursors can be produced using the {@link CXTranslationUnit.getCursor()} API.
 * When called with no parameters it produces a {@link CXCursor}
 * for the translation unit, from which one can use {@link visitChildren()}
 * to explore the rest of the translation unit.
 * When called with a physical source location it produces a {@link CXCursor}
 * to the entity that resides at that location, allowing one to map from the
 * source code into the AST.
 */
export class CXCursor {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;
  #kind?: CXCursorKind;
  #hash?: number;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXCursor.#constructable !== true) {
      throw new Error("CXCursor is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): null | CXCursor {
    if (libclang.symbols.clang_Cursor_isNull(buffer)) {
      return null;
    }
    CXCursor.#constructable = true;
    const result = new CXCursor(tu, buffer);
    CXCursor.#constructable = false;
    return result;
  }

  /**
   * Retrieve the NULL cursor, which represents no entity.
   */
  static getNullCursor(): CXCursor {
    CXCursor.#constructable = true;
    const result = new CXCursor(null, libclang.symbols.clang_getNullCursor());
    CXCursor.#constructable = false;
    return result;
  }

  /**
   * The kind of this cursor.
   */
  get kind(): CXCursorKind {
    return this.#kind ??
      (this.#kind = libclang.symbols.clang_getCursorKind(this.#buffer));
  }

  /**
   * Determine whether this cursor represents a simple
   * reference.
   *
   * Note that other kinds of cursors (such as expressions) can also refer to
   * other cursors. Use {@link getReferenced()} to determine whether a
   * particular cursor refers to another entity.
   */
  isReference(): boolean {
    return libclang.symbols.clang_isReference(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents an expression.
   */
  isExpression(): boolean {
    return libclang.symbols.clang_isExpression(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents a statement.
   */
  isStatement(): boolean {
    return libclang.symbols.clang_isStatement(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents an attribute.
   */
  isAttribute(): boolean {
    return libclang.symbols.clang_isAttribute(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents an invalid
   * cursor.
   */
  isInvalid(): boolean {
    return libclang.symbols.clang_isInvalid(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents a translation
   * unit.
   */
  isTranslationUnit(): boolean {
    return libclang.symbols.clang_isTranslationUnit(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents a preprocessing
   * element, such as a preprocessor directive or macro instantiation.
   */
  isPreprocessing(): boolean {
    return libclang.symbols.clang_isPreprocessing(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents a currently
   * unexposed piece of the AST (e.g., {@link CXCursorKind.CXCursor_UnexposedStmt}).
   */
  isUnexposed(): boolean {
    return libclang.symbols.clang_isUnexposed(this.kind) > 0;
  }

  /**
   * Determine whether this cursor represents a declaration.
   */
  isDeclaration(): boolean {
    return libclang.symbols.clang_isDeclaration(this.kind) > 0;
  }

  /**
   * Determine whether the declaration pointed to by this cursor
   * is also a definition of that entity.
   */
  isDefinition(): boolean {
    return libclang.symbols.clang_isCursorDefinition(this.#buffer) !== 0;
  }

  /**
   * Returns `true` if this cursor is a variadic function or method.
   */
  isVariadic(): boolean {
    return libclang.symbols.clang_Cursor_isVariadic(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ constructor is a converting constructor.
   */
  isConvertingConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isConvertingConstructor(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Determine if a C++ constructor is a copy constructor.
   */
  isCopyConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isCopyConstructor(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Determine if a C++ constructor is the default constructor.
   */
  isDefaultConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isDefaultConstructor(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Determine if a C++ constructor is a move constructor.
   */
  isMoveConstructor(): boolean {
    return libclang.symbols.clang_CXXConstructor_isMoveConstructor(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Determine if a C++ field is declared 'mutable'.
   */
  isMutable(): boolean {
    return libclang.symbols.clang_CXXField_isMutable(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ member function or member function template is
   * declared 'const'.
   */
  isConst(): boolean {
    return libclang.symbols.clang_CXXMethod_isConst(this.#buffer) !== 0;
  }

  /**
   * # NOT SUPPORTED BY TARGETED LIBCLANG
   *
   * Determine if a C++ member function is a copy-assignment operator,
   * returning `true` if such is the case and `false` otherwise.
   *
   * > A copy-assignment operator `X::operator=` is a non-static,
   * > non-template member function of _class_ `X` with exactly one
   * > parameter of type `X`, `X&`, `const X&`, `volatile X&` or `const
   * > volatile X&`.
   *
   * That is, for example, the `operator=` in:
   *
   * ```cpp
   * class Foo {
   * bool operator=(const volatile Foo\&);
   * };
   * ```
   *
   * Is a copy-assignment operator, while the `operator=` in:
   *
   * ```cpp
   * class Bar {
   * bool operator=(const int\&);
   * };
   * ```
   *
   * Is not.
   */
  isCopyAssignmentOperator(): never {
    throw new Error("Not implemented");
    // return libclang.symbols.clang_CXXMethod_isCopyAssignmentOperator(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ method is declared '= default'.
   */
  isDefaulted(): boolean {
    return libclang.symbols.clang_CXXMethod_isDefaulted(this.#buffer) !== 0;
  }

  /**
   * # NOT SUPPORTED BY TARGETED LIBCLANG
   *
   * Determine if a C++ method is declared '= delete'.
   */
  isDeleted(): never {
    throw new Error("Not implemented");
    //return libclang.symbols.clang_CXXMethod_isDeleted(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ member function or member function template is
   * pure virtual.
   */
  isPureVirtual(): boolean {
    return libclang.symbols.clang_CXXMethod_isPureVirtual(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ member function or member function template is
   * declared 'static'.
   */
  isStatic(): boolean {
    return libclang.symbols.clang_CXXMethod_isStatic(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ member function or member function template is
   * explicitly declared 'virtual' or if it overrides a virtual method from
   * one of the base classes.
   */
  isVirtual(): boolean {
    return libclang.symbols.clang_CXXMethod_isVirtual(this.#buffer) !== 0;
  }

  /**
   * Determine if a C++ record is abstract, i.e. whether a class or struct
   * has a pure virtual member function.
   */
  isAbstract(): boolean {
    return libclang.symbols.clang_CXXRecord_isAbstract(this.#buffer) !== 0;
  }

  /**
   * Determine if an enum declaration refers to a scoped enum.
   */
  isScopedEnum(): boolean {
    return libclang.symbols.clang_EnumDecl_isScoped(this.#buffer) !== 0;
  }

  /**
   * Determine whether this {@link CXCursor} that is a macro, is
   * function like.
   */
  isMacroFunctionLike(): boolean {
    return libclang.symbols.clang_Cursor_isMacroFunctionLike(this.#buffer) > 0;
  }

  /**
   * Determine whether this {@link CXCursor} that is a macro, is a
   * builtin one.
   */
  isMacroBuiltin(): boolean {
    return libclang.symbols.clang_Cursor_isMacroBuiltin(this.#buffer) > 0;
  }

  /**
   * Determine whether this {@link CXCursor} that is a function declaration, is an
   * inline declaration.
   */
  isFunctionInlined(): boolean {
    return libclang.symbols.clang_Cursor_isFunctionInlined(this.#buffer) > 0;
  }

  /**
   * Determine whether this cursor represents an anonymous
   * tag or namespace
   */
  isAnonymous(): boolean {
    return libclang.symbols.clang_Cursor_isAnonymous(this.#buffer) > 0;
  }

  /**
   * Determine whether this cursor represents an anonymous record
   * declaration.
   */
  isAnonymousRecordDecl(): boolean {
    return libclang.symbols.clang_Cursor_isAnonymousRecordDecl(this.#buffer) >
      0;
  }

  /**
   * Determine whether this cursor represents an inline namespace
   * declaration.
   */
  isInlineNamespace(): boolean {
    return libclang.symbols.clang_Cursor_isInlineNamespace(this.#buffer) > 0;
  }

  /**
   * Returns `true` if this cursor specifies a Record member that is a
   * bitfield.
   */
  isBitField(): boolean {
    return libclang.symbols.clang_Cursor_isBitField(this.#buffer) > 0;
  }

  /**
   * Returns `true` if the base class specified by this cursor with kind
   * {@link CXCursorKind.CXCursor_CXXBaseSpecifier} is virtual.
   */
  isVirtualBase(): boolean {
    return libclang.symbols.clang_isVirtualBase(this.#buffer) > 0;
  }

  /**
   * Determine whether this declaration cursor is invalid.
   *
   * A declaration is invalid if it could not be parsed successfully.
   *
   * @returns Rreturns `true` if this cursor represents a declaration and it is
   * invalid.
   */
  isInvalidDeclaration(): boolean {
    return libclang.symbols.clang_isInvalidDeclaration(this.#buffer) > 0;
  }

  /**
   * Determine whether two cursors are equivalent.
   */
  equals(other: CXCursor): boolean {
    return libclang.symbols.clang_equalCursors(this.#buffer, other.#buffer) !==
      0;
  }

  /**
   * If cursor refers to a variable declaration and it has initializer returns
   * cursor referring to the initializer otherwise return `null`.
   */
  getVariableDeclarationInitializer(): null | CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getVarDeclInitializer(this.#buffer),
    );
  }

  /**
   * Determine whether this cursor has any attributes.
   */
  hasAttributes(): boolean {
    return libclang.symbols.clang_Cursor_hasAttrs(this.#buffer) > 0;
  }

  /**
   * If cursor refers to a variable declaration that has external storage
   * returns `true`. If cursor refers to a variable declaration that doesn't have
   * external storage returns `false`. Otherwise an error is thrown.
   */
  hasVariableDeclarationWithExternalStorage(): boolean {
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

  /**
   * Determine the availability of the entity that this cursor refers to,
   * taking the current target platform into account.
   * @returns The availability of the cursor.
   */
  getAvailability(): CXAvailabilityKind {
    return libclang.symbols.clang_getCursorAvailability(this.#buffer);
  }

  /**
   * Determine the "language" of the entity referred to by this cursor.
   */
  getLanguage(): CXLanguageKind {
    return libclang.symbols.clang_getCursorLanguage(this.#buffer);
  }

  /**
   * Determine the lexical parent of this cursor.
   *
   * The lexical parent of a cursor is the cursor in which the given
   * `cursor` was actually written. For many declarations, the lexical
   * and semantic parents are equivalent (the semantic parent is returned by
   * {@link getSemanticParent()}. They diverge when declarations or
   * definitions are provided out-of-line. For example:
   *
   * ```cpp
   * class C {
   *  void f();
   * };
   * void C::f() { }
   * ```
   * In the out-of-line definition of `C::f,` the semantic parent is
   * the class `C,` of which this function is a member. The lexical parent is
   * the place where the declaration actually occurs in the source code; in this
   * case, the definition occurs in the translation unit. In general, the
   * lexical parent for a given entity can change without affecting the semantics
   * of the program, and the lexical parent of different declarations of the
   * same entity may be different. Changing the semantic parent of a declaration,
   * on the other hand, can have a major impact on semantics, and redeclarations
   * of a particular entity should all have the same semantic context.
   *
   * In the example above, both declarations of `C::f` have `C` as their
   * semantic context, while the lexical context of the first `C::f` is `C` and
   * the lexical context of the second `C::f` is the translation unit.
   *
   * For declarations written in the global scope, the lexical parent is
   * the translation unit.
   */
  getLexicalParent(): CXCursor {
    // A lexical parent always exists.
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorLexicalParent(this.#buffer),
    )!;
  }

  /**
   * Determine the linkage of the entity referred to by this cursor.
   */
  getLinkage(): CXLinkageKind {
    return libclang.symbols.clang_getCursorLinkage(this.#buffer);
  }

  /**
   * Determine the availability of the entity that this cursor refers to
   * on any platforms for which availability information is known.
   */
  getPlatformAvailability(): {
    /**
     * Indicates whether the entity is deprecated on all platforms.
     */
    alwaysDeprecated: boolean;
    /**
     * Indicate whether the entity is unavailable on all platforms.
     */
    alwaysUnavailable: boolean;
    /**
     * An array of {@link AvailabilityEntry} instances
     */
    availability: AvailabilityEntry[];
    /**
     * The message text provided along with the unconditional deprecation of this entity.
     */
    deprecatedMessage: string;
    /**
     * The message text provided along with the unconditional unavailability of this entity.
     */
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
        false,
      );
      const message = cxstringToString(
        availabilityBuffer.subarray(72 - 16),
        false,
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

  /**
   * Determine the semantic parent of this cursor.
   *
   * The semantic parent of a cursor is the cursor that semantically contains
   * the given `cursor`. For many declarations, the lexical and semantic parents
   * are equivalent (the lexical parent is returned by
   * {@link getLexicalParent()}`. They diverge when declarations or
   * definitions are provided out-of-line. For example:
   *
   * ```cpp
   * class C {
   *  void f();
   * };
   * void C::f() { }
   * ```
   * In the out-of-line definition of `C::f,` the semantic parent is
   * the class `C,` of which this function is a member. The lexical parent is
   * the place where the declaration actually occurs in the source code; in this
   * case, the definition occurs in the translation unit. In general, the
   * lexical parent for a given entity can change without affecting the semantics
   * of the program, and the lexical parent of different declarations of the
   * same entity may be different. Changing the semantic parent of a declaration,
   * on the other hand, can have a major impact on semantics, and redeclarations
   * of a particular entity should all have the same semantic context.
   *
   * In the example above, both declarations of `C::f` have `C` as their
   * semantic context, while the lexical context of the first `C::f` is `C` and
   * the lexical context of the second `C::f` is the translation unit.
   *
   * For global declarations, the semantic parent is the translation unit.
   */
  getSemanticParent(): CXCursor {
    // Semantic parent always exists.
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorSemanticParent(this.#buffer),
    )!;
  }

  /**
   * Determine the "thread-local storage (TLS) kind" of the declaration
   * referred to by this cursor.
   */
  getTLSKind(): CXTLSKind {
    return libclang.symbols.clang_getCursorTLSKind(this.#buffer);
  }

  /**
   * Describe the visibility of the entity referred to by this cursor.
   *
   * This returns the default visibility if not explicitly specified by
   * a visibility attribute. The default visibility may be changed by
   * commandline arguments.
   *
   * @returns The visibility of the cursor.
   */
  getVisibility(): CXVisibilityKind {
    return libclang.symbols.clang_getCursorVisibility(this.#buffer);
  }

  /**
   * Retrieve the file that is included by the given inclusion directive
   * cursor.
   */
  getIncludedFile(): CXFile {
    if (this.tu === null) {
      throw new Error("Cannot get included file of null cursor");
    }
    const result = libclang.symbols.clang_getIncludedFile(this.#buffer);
    if (result === NULL) {
      throw new Error("Got null included file");
    }
    return CXFile[CONSTRUCTOR](
      this.tu,
      result,
    );
  }

  /**
   * Determine the set of methods that are overridden by this method cursor.
   *
   * In both Objective-C and C++, a method (aka virtual member function,
   * in C++) can override a virtual method in a base class. For
   * Objective-C, a method is said to override any method in the class's
   * base class, its protocols, or its categories' protocols, that has the same
   * selector and is of the same kind (class or instance).
   * If no such method exists, the search continues to the class's superclass,
   * its protocols, and its categories, and so on. A method from an Objective-C
   * implementation is considered to override the same methods as its
   * corresponding method in the interface.
   *
   * For C++, a virtual member function overrides any virtual member
   * function with the same signature that occurs in its base
   * classes. With multiple inheritance, a virtual member function can
   * override several virtual member functions coming from different
   * base classes.
   *
   * In all cases, this function determines the immediate overridden
   * method, rather than all of the overridden methods. For example, if
   * a method is originally declared in a class A, then overridden in B
   * (which in inherits from A) and also in C (which inherited from B),
   * then the only overridden method returned from this function when
   * invoked on C's method will be B's method. The client may then
   * invoke this function again, given the previously-found overridden
   * methods, to map out the complete method-override set.
   *
   * @returns An array of {@link CXCursor}s, representing the set of
   * overridden methods.
   */
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
      // Cursor structs given to us by libclang are non-null.
      const cursor = CXCursor[CONSTRUCTOR](this.tu, buffer)!;
      OVERRIDDEN_CURSORS_FINALIZATION_REGISTRY.register(cursor, key);
      cursors.push(cursor);
    }
    return cursors;
  }

  /**
   * Returns `true` if this cursor is a NULL cursor.
   *
   * This should not be needed usually, as NULL cursors should
   * be returned as `null` instead.
   */
  isNull(): boolean {
    return libclang.symbols.clang_Cursor_isNull(this.#buffer) !== 0;
  }

  /**
   * Compute a hash value for this cursor.
   */
  hash(): number {
    return this.#hash ??
      (this.#hash = libclang.symbols.clang_hashCursor(this.#buffer));
  }

  /**
   * If this cursor represents a documentable entity (e.g.,
   * declaration), returns the associated
   * \\paragraph ; otherwise returns the
   * first paragraph.
   */
  getBriefCommentText(): string {
    const cxstring = libclang.symbols.clang_Cursor_getBriefCommentText(
      this.#buffer,
    );
    return cxstringToString(cxstring);
  }

  /**
   * If this cursor represents a declaration, returns the associated
   * comment's source range. The range may include multiple consecutive comments
   * with whitespace in between.
   */
  getCommentRange(): CXSourceRange | null {
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getCommentRange(this.#buffer),
    );
  }

  /**
   * If this cursor represents an Objective-C method or parameter
   * declaration, returns the associated Objective-C qualifiers for the return
   * type or the parameter respectively. The bits are formed from
   * {@link CXObjCDeclQualifierKind}.
   */
  getObjCDeclQualifiers(): number {
    return libclang.symbols.clang_Cursor_getObjCDeclQualifiers(this.#buffer);
  }

  /**
   * If this cursor represents a property declaration, returns the
   * associated property attributes. The bits are formed from
   * {@link CXObjCPropertyAttrKind}.
   */
  getObjCPropertyAttributes(): number {
    return libclang.symbols.clang_Cursor_getObjCPropertyAttributes(
      this.#buffer,
      0,
    );
  }

  /**
   * If this cursor represents a property declaration, returns the
   * name of the method that implements the setter, if any.
   */
  getObjCPropertySetterName(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getObjCPropertySetterName(this.#buffer),
    );
  }

  /**
   * If this cursor represents a property declaration, returns the
   * name of the method that implements the getter.
   */
  getObjCPropertyGetterName(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getObjCPropertyGetterName(this.#buffer),
    );
  }

  /**
   * If this cursor points to a selector identifier in an Objective-C
   * method or message expression, this returns the selector index.
   *
   * After getting a cursor with {@link CXTranslationUnit.getCursor},
   * this can be called to determine if the location points to a selector identifier.
   *
   * @returns The selector index if the cursor is an Objective-C method or message
   * expression and the cursor is pointing to a selector identifier, or -1
   * otherwise.
   */
  getObjCSelectorIndex(): number {
    return libclang.symbols.clang_Cursor_getObjCSelectorIndex(this.#buffer);
  }

  /**
   * Get an array of strings representing the mangled symbols of the ObjC
   * class interface or implementation at this cursor.
   */
  getObjCManglings(): string[] {
    return cxstringSetToStringArray(
      libclang.symbols.clang_Cursor_getObjCManglings(this.#buffer),
    );
  }

  /**
   * If this cursor represents an Objective-C method or property
   * declaration, returns `true` if the declaration was affected by "\@optional".
   * Returns `false` if the cursor is not such a declaration or it is "\@required".
   */
  isObjCOptional(): boolean {
    return libclang.symbols.clang_Cursor_isObjCOptional(this.#buffer) !== 0;
  }

  /**
   * If this cursor represents a declaration, returns the associated
   * comment text, including comment markers.
   */
  getRawCommentText(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getRawCommentText(this.#buffer),
    );
  }

  /**
   * If this cursor points to an Objective-C message or property
   * reference, or C++ method call, returns the CXType of the receiver.
   */
  getReceiverType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_Cursor_getReceiverType(this.#buffer),
    );
  }

  /**
   * If this cursor points to a C++ method call or an Objective-C
   * message, returns `true` if the method/message is "dynamic", meaning:
   *
   * For a C++ method: the call is virtual.
   * For an Objective-C message: the receiver is an object instance, not 'super'
   * or a specific class.
   *
   * If the method/message is "static" or the cursor does not point to a
   * method/message, it will return `false`.
   */
  isDynamicCall(): boolean {
    return libclang.symbols.clang_Cursor_isDynamicCall(this.#buffer) !== 0;
  }

  /**
   * Returns `true` if this cursor points to a symbol marked with
   * `external_source_symbol` attribute.
   *
   * Use {@link getExternalSymbolAttributes()} to get details of
   * the attribute.
   */
  isExternalSymbol(): boolean {
    return libclang.symbols.clang_Cursor_isExternalSymbol(
      this.#buffer,
      NULLBUF,
      NULLBUF,
      NULLBUF,
    ) !== 0;
  }

  /**
   * If this cursor points to a symbol marked with `external_source_symbol`
   * attribute, returns an object containing `language`, `definedIn` and
   * `generated_declaration` details of the attribute.
   */
  getExternalSymbolAttributes(): null | {
    /**
     * The `language` string from the attribute.
     */
    language: null | string;
    /**
     * The `definedIn` string from the attribute.
     */
    definedIn: null | string;
    /**
     * The `true` if `generated_declaration` is set in the attribute.
     */
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

  /**
   * Retrieve the canonical cursor corresponding to this cursor.
   *
   * In the C family of languages, many kinds of entities can be declared several
   * times within a single translation unit. For example, a structure type can
   * be forward-declared (possibly multiple times) and later defined:
   *
   * ```cpp
   * struct X;
   * struct X;
   * struct X {
   *   int member;
   * };
   * ```
   * The declarations and the definition of `X` are represented by three
   * different cursors, all of which are declarations of the same underlying
   * entity. One of these cursor is considered the "canonical" cursor, which
   * is effectively the representative for the underlying entity. One can
   * determine if two cursors are declarations of the same underlying entity by
   * comparing their canonical cursors.
   *
   * @returns The canonical cursor for the entity referred to by this cursor.
   */
  getCanonicalCursor(): CXCursor {
    // A canonical cursor always exists.
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCanonicalCursor(this.#buffer),
    )!;
  }

  /**
   * If this cursor is either a reference to or a declaration
   * of some entity, retrieve a cursor that describes the definition of
   * that entity.
   *
   * Some entities can be declared multiple times within a translation
   * unit, but only one of those declarations can also be a
   * definition. For example, given:
   *
   * ```cpp
   *  int f(int, int);
   *  int g(int x, int y) { return f(x, y); }
   *  int f(int a, int b) { return a + b; }
   *  int f(int, int);
   * ```
   * there are three declarations of the function "f", but only the
   * second one is a definition. The {@link getDefinition()}
   * function will take any cursor pointing to a declaration of "f"
   * (the first or fourth lines of the example) or a cursor referenced
   * that uses "f" (the call to "f' inside "g") and will return a
   * declaration cursor pointing to the definition (the second "f"
   * declaration).
   *
   * If this is a cursor for which there is no corresponding definition,
   * e.g., because there is no definition of that entity within this
   * translation unit, returns `null`.
   */
  getDefinition(): null | CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorDefinition(this.#buffer),
    );
  }

  /**
   * Retrieve the display name for the entity referenced by this cursor.
   *
   * The display name contains extra information that helps identify the cursor,
   * such as the parameters of a function or template or the arguments of a
   * class template specialization.
   */
  getDisplayName(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorDisplayName(this.#buffer),
    );
  }

  /**
   * Pretty print declarations.
   *
   * @param [printingPolicy] The policy to control the entities being printed.
   * @returns The pretty printed declaration or the empty string for
   * other cursors.
   */
  getPrettyPrinted(printingPolicy?: CXPrintingPolicy): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorPrettyPrinted(
        this.#buffer,
        printingPolicy ? printingPolicy[POINTER] : NULL,
      ),
    );
  }

  /**
   * Retrieve the default policy for this cursor.
   */
  getPrintingPolicy(): CXPrintingPolicy {
    return CXPrintingPolicy[CONSTRUCTOR](
      libclang.symbols.clang_getCursorPrintingPolicy(this.#buffer),
    );
  }

  /**
   * If this cursor is a reference, retrieves a cursor representing the
   * entity that it references.
   *
   * Reference cursors refer to other entities in the AST. For example, an
   * Objective-C superclass reference cursor refers to an Objective-C class.
   * This function produces the cursor for the Objective-C class from the
   * cursor for the superclass reference. If this cursor is a declaration or
   * definition, it returns that declaration or definition unchanged.
   * Otherwise, returns `null`.
   */
  getReferenced(): null | CXCursor {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorReferenced(this.#buffer),
    );
  }

  /**
   * Retrieve a name for the entity referenced by this cursor.
   */
  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorSpelling(this.#buffer),
    );
  }

  /**
   * Gets a human readable string of this cursor's kind.
   *
   * Use this for debugging only.
   */
  getKindSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getCursorKindSpelling(
        libclang.symbols.clang_getCursorKind(this.#buffer),
      ),
    );
  }

  /**
   * Retrieve a Unified Symbol Resolution (USR) for the entity referenced
   * by this cursor.
   *
   * A Unified Symbol Resolution (USR) is a string that identifies a particular
   * entity (function, class, variable, etc.) within a program. USRs can be
   * compared across translation units to determine, e.g., when references in
   * one translation refer to an entity defined in another translation unit.
   */
  getUSR(): string {
    return cxstringToString(libclang.symbols.clang_getCursorUSR(this.#buffer));
  }

  /**
   * Visit the children of this cursor.
   *
   * This function visits all the direct children of the given cursor,
   * invoking the given {@link callback} function with the cursors of each
   * visited child. The traversal may be recursive, if the visitor returns
   * {@link CXChildVisitResult.CXChildVisit_Recurse}. The traversal may
   * also be ended prematurely, if the visitor returns
   * {@link CXChildVisitResult.CXChildVisit_Break}.
   *
   * All kinds of cursors can be visited, including invalid cursors (which, by
   * definition, have no children).
   *
   * @param callback The visitor function that will be invoked for each
   * child of this cursor.
   * @returns Returns `true` if the traversal was terminated
   * prematurely by the visitor returning
   * {@link CXChildVisitResult.CXChildVisit_Break}.
   */
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

  /**
   * Retrieve the string representing the mangled name of this cursor.
   */
  getMangling(): string {
    return cxstringToString(
      libclang.symbols.clang_Cursor_getMangling(this.#buffer),
    );
  }

  /**
   * Retrieve an array of strings representing the mangled symbols of the C++
   * constructor or destructor at this cursor.
   */
  getCXXManglings(): string[] {
    return cxstringSetToStringArray(
      libclang.symbols.clang_Cursor_getCXXManglings(this.#buffer),
    );
  }

  /**
   * If this cursor represents a documentable entity (e.g.,
   * declaration), returns the associated parsed comment as a
   * {@link CXCommentKind.CXComment_FullComment} kind {@link CXComment} AST node.
   */
  getParsedComment(): CXComment {
    return CXComment[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getParsedComment(this.#buffer),
    );
  }

  /**
   * If this cursor that references something else, returns the source range
   * covering that reference.
   *
   * A cursor references something else if it is a member reference,
   * a declaration reference, or an operator call cursor.
   *
   * @param options An array of {@link CXNameRefFlags} flags.
   *
   * @param pieceIndex For contiguous names or when passing the flag
   * {@link CXNameRefFlags.CXNameRange_WantSinglePiece}, only one piece with index 0 is
   * available. When the {@link CXNameRefFlags.CXNameRange_WantSinglePiece} flag is not
   * passed for non-contiguous names this index can be used to retrieve the individual
   * pieces of the name. See also {@link CXNameRefFlags.CXNameRange_WantSinglePiece}.
   * @returns The piece of the name pointed to by this cursor. If there is no
   * name, or if the PieceIndex is out-of-range, returns `null`.
   */
  getReferenceNameRange(
    options: CXNameRefFlags[] = [],
    pieceIndex = 0,
  ): CXSourceRange | null {
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

  /**
   * If this cursor may represent a specialization or instantiation
   * of a template, retrieves the cursor that represents the template that it
   * specializes or from which it was instantiated.
   *
   * This routine determines the template involved both for explicit
   * specializations of templates and for implicit instantiations of the template,
   * both of which are referred to as "specializations". For a class template
   * specialization (e.g., `std::vector<bool>`), this routine will return
   * either the primary template (`std::vector`) or, if the specialization was
   * instantiated from a class template partial specialization, the class template
   * partial specialization. For a class template partial specialization and a
   * function template specialization (including instantiations), this
   * this routine will return the specialized template.
   *
   * For members of a class template (e.g., member functions, member classes, or
   * static data members), returns the specialized or instantiated member.
   * Although not strictly "templates" in the C++ language, members of class
   * templates have the same notions of specializations and instantiations that
   * templates do, so this routine treats them similarly.
   *
   * @returns If this cursor is a specialization or instantiation of a
   * template or a member thereof, returns the template or member that it
   * specializes or from which it was instantiated. Otherwise, returns `null`.
   */
  getSpecializedTemplate(): CXCursor | null {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getSpecializedCursorTemplate(this.#buffer),
    );
  }

  /**
   * If this cursor represents a template, determines the cursor kind of
   * the specializations would be generated by instantiating the template.
   *
   * This routine can be used to determine what flavor of function template,
   * class template, or class template partial specialization is stored in the
   * cursor. For example, it can describe whether a class template cursor is
   * declared with "struct", "class" or "union".
   *
   * @returns The cursor kind of the specializations that would be generated
   * by instantiating the template at this cursor. If this cursor is not a
   * template, returns {@link CXCursorKind.CXCursor_NoDeclFound}.
   */
  getTemplateKind(): CXCursorKind {
    return libclang.symbols.clang_getTemplateCursorKind(this.#buffer);
  }

  /**
   * If this is a {@link CXCursorKind.CXCursor_ModuleImportDecl} cursor,
   * returns the associated module. Otherwise an error is thrown.
   */
  getModule(): CXModule {
    if (this.tu === null) {
      throw new Error("Cannot get CXModule of null cursor");
    }
    const result = libclang.symbols.clang_Cursor_getModule(this.#buffer);
    if (result === null) {
      throw new Error("Unexpected null CXModule");
    }
    return CXModule[CONSTRUCTOR](
      this.tu,
      result,
    );
  }

  /**
   * Retrieve the physical location of the source constructor referenced
   * by this cursor.
   *
   * The location of a declaration is typically the location of the name of that
   * declaration, where the name of that declaration would occur if it is
   * unnamed, or some keyword that introduces that particular declaration.
   * The location of a reference is where that reference occurs within the
   * source code.
   */
  getLocation(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorLocation(this.#buffer),
    );
  }

  /**
   * Retrieve the physical extent of the source construct referenced by
   * this cursor.
   *
   * The extent of a cursor starts with the file/line/column pointing at the
   * first character within the source construct that the cursor refers to and
   * ends with the last character within that source construct. For a
   * declaration, the extent covers the declaration itself. For a reference,
   * the extent covers the location of the reference (e.g., where the referenced
   * entity was actually used).
   */
  getExtent(): CXSourceRange {
    // The extent always exists for non-null cursors.
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCursorExtent(this.#buffer),
    )!;
  }

  /**
   * Retrieve the type of this cursor, or `null` if no type is available.
   */
  getType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getCursorType(this.#buffer),
    );
  }

  /**
   * Retrieves the underlying type of a typedef declaration.
   *
   * If the cursor does not reference a typedef declaration, returns `null`.
   */
  getTypedefDeclarationOfUnderlyingType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getTypedefDeclUnderlyingType(this.#buffer),
    );
  }

  /**
   * Retrieve the integer type of an enum declaration.
   *
   * If the cursor does not reference an enum declaration, returns `null`.
   */
  getEnumDeclarationIntegerType(): CXType | null {
    if (this.kind !== CXCursorKind.CXCursor_EnumDecl) {
      throw new Error("Not an EnumDecl");
    }
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getEnumDeclIntegerType(this.#buffer),
    );
  }

  /**
   * Retrieve the integer value of an enum constant declaration as number, or bigint
   * if the value is not safely representable as a JavaScript number.
   *
   * If this cursor does not reference an enum constant declaration, an error is thrown.
   */
  getEnumConstantDeclarationValue(): Deno.PointerValue {
    if (this.kind !== CXCursorKind.CXCursor_EnumConstantDecl) {
      throw new Error("Not an EnumConstantDecl");
    }
    return libclang.symbols.clang_getEnumConstantDeclValue(this.#buffer);
  }

  /**
   * Retrieve the unsigned integer value of an enum constant declaration as number, or bigint
   * if the value is not safely representable as a JavaScript number.
   *
   * If this cursor does not reference an enum constant declaration, an error is thrown.
   */
  getEnumConstantDeclarationUnsignedValue(): Deno.PointerValue {
    if (this.kind !== CXCursorKind.CXCursor_EnumConstantDecl) {
      throw new Error("Not an EnumConstantDecl");
    }
    return libclang.symbols.clang_getEnumConstantDeclUnsignedValue(
      this.#buffer,
    );
  }

  /**
   * Retrieve the bit width of a bit field declaration as an integer.
   *
   * If this cursor is not a bit field declaration, -1 is returned.
   */
  getFieldDeclarationBitWidth(): number {
    return libclang.symbols.clang_getFieldDeclBitWidth(this.#buffer);
  }

  /**
   * Retrieve the number of non-variadic arguments associated with this
   * cursor.
   *
   * The number of arguments can be determined for calls as well as for
   * declarations of functions or methods. For other cursors -1 is returned.
   */
  getNumberOfArguments(): number {
    return libclang.symbols.clang_Cursor_getNumArguments(this.#buffer);
  }

  /**
   * Retrieve the argument cursor of a function or method.
   *
   * The argument cursor can be determined for calls as well as for declarations
   * of functions or methods. For other cursors and for invalid indices, `null`
   * is returned.
   */
  getArgument(index: number): CXCursor | null {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getArgument(this.#buffer, index),
    );
  }

  /**
   * Returns the number of template args of a function, struct, or class decl
   * representing a template specialization.
   *
   * If this cursor cannot be converted into a template function
   * declaration, -1 is returned.
   *
   * For example, for the following declaration and specialization:
   * ```cpp
   * template <typename T, int kInt, bool kBool>
   * void foo() { ... }
   *
   * template \<\>
   * void foo<float, -7, true>();
   * ```
   *
   * The value 3 would be returned from this call.
   */
  getNumberOfTemplateArguments(): number {
    return libclang.symbols.clang_Cursor_getNumTemplateArguments(this.#buffer);
  }

  /**
   * Retrieve the kind of the I'th template argument of this cursor.
   *
   * If this cursor does not represent a FunctionDecl, StructDecl, or
   * ClassTemplatePartialSpecialization, an invalid template argument kind is
   * returned.
   *
   * For example, for the following declaration and specialization:
   * ```cpp
   * template <typename T, int kInt, bool kBool>
   * void foo() { ... }
   *
   * template \<\>
   * void foo<float, -7, true>();
   * ```
   *
   * For I = 0, 1, and 2, Type, Integral, and Integral will be returned,
   * respectively.
   */
  getTemplateArgumentKind(index: number): CXTemplateArgumentKind {
    return libclang.symbols.clang_Cursor_getTemplateArgumentKind(
      this.#buffer,
      index,
    );
  }

  /**
   * Retrieve a {@link CXType} representing the type of a TemplateArgument of a
   * function decl representing a template specialization.
   *
   * If this cursor does not represent a FunctionDecl, StructDecl,
   * ClassDecl or ClassTemplatePartialSpecialization whose I'th template argument
   * has a kind of CXTemplateArgKind_Integral, `null` is returned.
   *
   * For example, for the following declaration and specialization:
   * ```cpp
   * template <typename T, int kInt, bool kBool>
   * void foo() { ... }
   *
   * template <>
   * void foo<float, -7, true>();
   * ```
   *
   * If called with I = 0, "float", will be returned.
   * Invalid types will be returned for I == 1 or 2.
   */
  getTemplateArgumentType(index: number): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_Cursor_getTemplateArgumentType(
        this.#buffer,
        index,
      ),
    );
  }

  /**
   * Retrieve the value of an Integral TemplateArgument (of a function
   * decl representing a template specialization) as a number or bigint if
   * the value cannot be safely represented as a JavaScript number.
   *
   * It is undefined to call this function on a {@link CXCursor} that does not represent a
   * FunctionDecl, StructDecl, ClassDecl or ClassTemplatePartialSpecialization
   * whose I'th template argument is not an integral value.
   *
   * For example, for the following declaration and specialization:
   * ```cpp
   * template <typename T, int kInt, bool kBool>
   * void foo() { ... }
   *
   * template \<\>
   * void foo<float, -7, true>();
   * ```
   *
   * If called with I = 1 or 2, -7 or true will be returned, respectively.
   * For I == 0, this function's behavior is undefined.
   */
  getTemplateArgumentValue(index: number): Deno.PointerValue {
    return libclang.symbols.clang_Cursor_getTemplateArgumentValue(
      this.#buffer,
      index,
    );
  }

  /**
   * Retrieve the value of an Integral TemplateArgument (of a function
   * decl representing a template specialization) as an unsigned number or bigint
   * if the value cannot be safely represented as a JavaScript number.
   *
   * It is undefined to call this function on a {@link CXCursor} that does not represent a
   * FunctionDecl, StructDecl, ClassDecl or ClassTemplatePartialSpecialization or
   * whose I'th template argument is not an integral value.
   *
   * For example, for the following declaration and specialization:
   * ```cpp
   * template <typename T, int kInt, bool kBool>
   * void foo() { ... }
   *
   * template \<\>
   * void foo<float, 2147483649, true>();
   * ```
   *
   * If called with I = 1 or 2, 2147483649 or 1 will be returned, respectively.
   * For I == 0, this function's behavior is undefined.
   */
  getTemplateArgumentUnsignedValue(index: number): Deno.PointerValue {
    return libclang.symbols.clang_Cursor_getTemplateArgumentUnsignedValue(
      this.#buffer,
      index,
    );
  }

  /**
   * Returns the Objective-C type encoding for the specified declaration.
   */
  getDeclarationObjCTypeEncoding(): string {
    return cxstringToString(
      libclang.symbols.clang_getDeclObjCTypeEncoding(this.#buffer),
    );
  }

  /**
   * Retrieve the return type associated with this cursor.
   *
   * This only returns a valid type if the cursor refers to a function or method.
   */
  getResultType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getCursorResultType(this.#buffer),
    );
  }

  /**
   * Retrieve the exception specification type associated with this cursor.
   *
   * This only returns a valid result if the cursor refers to a function or
   * method.
   */
  getExceptionSpecificationType(): CXCursor_ExceptionSpecificationKind | -1 {
    return libclang.symbols.clang_getCursorExceptionSpecificationType(
      this.#buffer,
    );
  }

  /**
   * Return the offset of the field represented by this cursor.
   *
   * If the cursor is not a field declaration, -1 is returned.
   * If the cursor semantic parent is not a record field declaration,
   * {@link CXTypeLayoutError.CXTypeLayoutError_Invalid} is returned.
   * If the field's type declaration is an incomplete type,
   * {@link CXTypeLayoutError.CXTypeLayoutError_Incomplete} is returned.
   * If the field's type declaration is a dependent type,
   * {@link CXTypeLayoutError.CXTypeLayoutError_Dependent} is returned.
   * If the field's name S is not found,
   * {@link CXTypeLayoutError.CXTypeLayoutError_InvalidFieldName} is returned.
   */
  getOffsetOfField(): CXTypeLayoutError | number {
    return Number(libclang.symbols.clang_Cursor_getOffsetOfField(this.#buffer));
  }

  /**
   * Returns the access control level for the referenced object.
   *
   * If this cursor refers to a C++ declaration, its access control level within
   * its parent scope is returned. Otherwise, if the cursor refers to a base
   * specifier or access specifier, the specifier itself is returned.
   */
  getCXXAccessSpecifier(): CX_CXXAccessSpecifier {
    return libclang.symbols.clang_getCXXAccessSpecifier(this.#buffer);
  }

  /**
   * Returns the storage class for a function or variable declaration.
   *
   * If this cursor is not a function or variable declaration,
   * {@link CX_StorageClass.CX_SC_Invalid} is returned else the storage class.
   */
  getStorageClass(): CX_StorageClass {
    return libclang.symbols.clang_Cursor_getStorageClass(this.#buffer);
  }

  /**
   * Determine the number of overloaded declarations referenced by a
   * {@link CXCursorKind.CXCursor_OverloadedDeclRef} cursor.
   *
   * @returns The number of overloaded declarations referenced by this
   * cursor. If it is not a {@link CXCursorKind.CXCursor_OverloadedDeclRef} cursor,
   * returns 0.
   */
  getNumberOfOverloadedDeclarations(): number {
    return libclang.symbols.clang_getNumOverloadedDecls(this.#buffer);
  }

  /**
   * Retrieve a cursor for one of the overloaded declarations referenced
   * by a {@link CXCursorKind.CXCursor_OverloadedDeclRef} cursor.
   *
   * @param index The zero-based index into the set of overloaded declarations in
   * this cursor.
   * @returns A cursor representing the declaration referenced by this given
   * cursor at the specified {@link index}. If the cursor does not have an
   * associated set of overloaded declarations, or if the index is out of bounds,
   * returns `null`.
   */
  getOverloadedDeclaration(index: number): CXCursor | null {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getOverloadedDecl(this.#buffer, index),
    );
  }

  /**
   * For cursors representing an `iboutletcollection` attribute,
   * this function returns the collection element type.
   */
  getIBOutletCollectionType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu!,
      libclang.symbols.clang_getIBOutletCollectionType(this.#buffer),
    );
  }

  /**
   * If cursor refers to a variable declaration that has global storage returns `1`.
   * If cursor refers to a variable declaration that doesn't have global storage
   * returns `0`. Otherwise returns `-1`.
   */
  hasVariableDeclarationWithGlobalStorage(): -1 | 0 | 1 {
    return libclang.symbols.clang_Cursor_hasVarDeclGlobalStorage(
      this.#buffer,
    ) as -1 | 0 | 1;
  }

  /**
   * Retrieve a range for a piece that forms the cursor's spelling name.
   * Most of the times there is only one range for the complete spelling but for
   * Objective-C methods and Objective-C message expressions, there are multiple
   * pieces for each selector identifier.
   *
   * @param pieceIndex The index of the spelling name piece. If this is greater
   * than the actual number of pieces, it will return `null`.
   */
  getSpellingNameRange(pieceIndex: number): CXSourceRange | null {
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Cursor_getSpellingNameRange(
        this.#buffer,
        pieceIndex,
        0,
      ),
    );
  }

  /**
   * For debugging purposes only.
   */
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

  /**
   * Retrieve a completion string for an arbitrary declaration or macro
   * definition cursor.
   *
   * @returns A non-context-sensitive completion string for declaration and macro
   * definition cursors, or `null` for other kinds of cursors.
   */
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

  /**
   * If this cursor is a statement declaration this method tries to evaluate the
   * statement and if its variable, tries to evaluate its initializer,
   * into its corresponding type.
   * If it's an expression, tries to evaluate the expression.
   */
  Evaluate(): CXEvalResult {
    return CXEvalResult[CONSTRUCTOR](
      libclang.symbols.clang_Cursor_Evaluate(this.#buffer),
    );
  }

  /**
   * Find references of a declaration in a specific file.
   *
   * This cursor should be pointing to a declaration or a reference of one.
   *
   * @param file File to search for references in.
   * @param callback Callback that will receive pairs of {@link CXCursor}/{@link CXSourceRange} for
   * each reference found.
   * The {@link CXSourceRange} will point inside the file; if the reference is inside
   * a macro (and not a macro argument) the `range` will be `null`.
   * @returns One of the {@link CXResult} enumerators.
   */
  findReferencesInFile(
    file: CXFile,
    callback: (
      cursor: CXCursor,
      range: null | CXSourceRange,
    ) => CXVisitorResult,
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

/**
 * A semantic string that describes a code-completion result.
 *
 * A semantic string that describes the formatting of a code-completion
 * result as a single "template" of text that should be inserted into the
 * source buffer when a particular code-completion result is selected.
 * Each semantic string is made up of some number of "chunks", each of which
 * contains some text along with a description of what that text means, e.g.,
 * the name of the entity being referenced, whether the text chunk is part of
 * the template, or whether it is a "placeholder" that the user should replace
 * with actual code,of a specific kind. See {@link CXCompletionChunkKind} for a
 * description of the different kinds of chunks.
 *
 * @hideconstructor
 */
class CXCompletionString {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXCompletionString.#constructable !== true) {
      throw new Error("CXCompletionString is not constructable");
    }
    this.#pointer = pointer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    pointer: Deno.PointerValue,
  ): CXCompletionString {
    CXCompletionString.#constructable = true;
    const result = new CXCompletionString(pointer);
    CXCompletionString.#constructable = false;
    return result;
  }

  /**
   * Determine the kind of a particular chunk within this completion string.
   *
   * @param index The 0-based index of the chunk in the completion string.
   * @returns The kind of the chunk at {@link index}.
   */
  getChunkKind(index: number): CXCompletionChunkKind {
    return libclang.symbols.clang_getCompletionChunkKind(this.#pointer, index);
  }

  /**
   * Retrieve the text associated with a particular chunk within a
   * completion string.
   *
   * @param index The 0-based index of the chunk in the completion string.
   * @returns The text associated with the chunk {@link index}.
   */
  getChunkText(index: number): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionChunkText(this.#pointer, index),
    );
  }

  /**
   * Retrieve the completion string associated with a particular chunk
   * within this completion string.
   *
   * @param index The 0-based index of the chunk in the completion string.
   * @returns The completion string associated with the chunk at {@link index}.
   */
  getChunkCompletionString(index: number): null | CXCompletionString {
    const result = libclang.symbols.clang_getCompletionChunkCompletionString(
      this.#pointer,
      index,
    );
    if (result === NULL) {
      return null;
    }
    return CXCompletionString[CONSTRUCTOR](result);
  }

  /**
   * Retrieve the number of chunks in this code-completion string.
   */
  getNumberOfCompletionChunks(): number {
    return libclang.symbols.clang_getNumCompletionChunks(this.#pointer);
  }

  /**
   * Determine the priority of this code completion.
   *
   * The priority of a code completion indicates how likely it is that this
   * particular completion is the completion that the user will select. The
   * priority is selected by various internal heuristics.
   *
   * @returns The priority of this completion string. Smaller values indicate
   * higher-priority (more likely) completions.
   */
  getPriority(): number {
    return libclang.symbols.clang_getCompletionPriority(this.#pointer);
  }

  /**
   * Determine the availability of the entity that this code-completion
   * string refers to.
   *
   * @returns The availability of the completion string.
   */
  getAvailability(): CXAvailabilityKind {
    return libclang.symbols.clang_getCompletionAvailability(this.#pointer);
  }

  /**
   * Retrieve the number of annotations associated with this
   * completion string.
   *
   * @returns The number of annotations associated with this completion string.
   */
  getNumberOfAnnotations(): number {
    return libclang.symbols.clang_getCompletionNumAnnotations(this.#pointer);
  }

  /**
   * Retrieve the annotation associated with this completion string.
   *
   * @param index The 0-based index of the annotation of the
   * completion string.
   * @returns Annotation string associated with the completion at {@link index},
   * or an empty string if that annotation is not available.
   */
  getAnnotation(index: number): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionAnnotation(this.#pointer, index),
    );
  }

  /**
   * Retrieve the parent context of this completion string.
   *
   * The parent context of a completion string is the semantic parent of
   * the declaration (if any) that the code completion represents. For example,
   * a code completion for an Objective-C method would have the method's class
   * or protocol as its context.
   *
   * @returns The name of the completion parent, e.g., "NSObject" if
   * the completion string represents a method in the NSObject class.
   */
  getParent(): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionParent(this.#pointer, NULLBUF),
    );
  }

  /**
   * Retrieve the brief documentation comment attached to the declaration
   * that corresponds to this completion string.
   */
  getBriefComment(): string {
    return cxstringToString(
      libclang.symbols.clang_getCompletionBriefComment(this.#pointer),
    );
  }
}

const EVAL_RESULT_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_EvalResult_dispose(pointer));

/**
 * Evaluation result of a cursor
 *
 * @hideconstructor
 */
class CXEvalResult {
  static #constructable = false;
  #pointer: Deno.PointerValue;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(
    pointer: Deno.PointerValue,
  ) {
    if (CXEvalResult.#constructable !== true) {
      throw new Error("CXEvalResult is not constructable");
    }
    this.#pointer = pointer;
    EVAL_RESULT_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    pointer: Deno.PointerValue,
  ): CXEvalResult {
    CXEvalResult.#constructable = true;
    const result = new CXEvalResult(pointer);
    CXEvalResult.#constructable = false;
    return result;
  }

  /**
   * Returns the kind of the evaluated result.
   */
  getKind(): CXEvalResultKind {
    return libclang.symbols.clang_EvalResult_getKind(this.#pointer);
  }

  /**
   * Returns the evaluation result as integer if the
   * kind is Int.
   */
  getAsInt(): number {
    return libclang.symbols.clang_EvalResult_getAsInt(this.#pointer);
  }

  /**
   * Returns the evaluation result as a long long integer if the
   * kind is Int. This prevents overflows that may happen if the result is
   * returned with {@link getAsInt}.
   */
  getAsLongLong(): number | bigint {
    return libclang.symbols.clang_EvalResult_getAsLongLong(this.#pointer);
  }

  /**
   * Returns a `true` value if the kind is Int and the evaluation
   * result resulted in an unsigned integer.
   */
  isUnsignedInt(): boolean {
    return libclang.symbols.clang_EvalResult_isUnsignedInt(this.#pointer) !== 0;
  }

  /**
   * Returns the evaluation result as an unsigned integer if
   * the kind is Int and {@link isUnsignedInt} is `true`.
   */
  getAsUnsigned(): number | bigint {
    return libclang.symbols.clang_EvalResult_getAsUnsigned(this.#pointer);
  }

  /**
   * Returns the evaluation result as double if the
   * kind is double.
   */
  getAsDouble(): number {
    return libclang.symbols.clang_EvalResult_getAsDouble(this.#pointer);
  }

  /**
   * Returns the evaluation result as a constant string if the
   * kind is other than Int or float.
   */
  getAsStr(): string {
    return Deno.UnsafePointerView.getCString(
      libclang.symbols.clang_EvalResult_getAsStr(this.#pointer),
    );
  }

  /**
   * Disposes the created Eval memory.
   *
   * Calling any other methods after calling {@link dispose()} causes
   * undefined behaviour. It is not strictly necessary to call this method,
   * the memory will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    libclang.symbols.clang_EvalResult_dispose(this.#pointer);
    EVAL_RESULT_FINALIZATION_REGISTRY.unregister(this);
  }
}

/**
 * @hideconstructor
 */
class CXModule {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXModule.#constructable !== true) {
      throw new Error("CXModule is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXModule {
    CXModule.#constructable = true;
    const result = new CXModule(tu, pointer);
    CXModule.#constructable = false;
    return result;
  }

  /**
   * Get the name of this module, e.g. for the `std.vector` sub-module it
   * will return "vector".
   */
  getName(): string {
    return cxstringToString(
      libclang.symbols.clang_Module_getName(this.#pointer),
    );
  }

  /**
   * Get the module file where this module object came from.
   */
  getASTFile(): CXFile {
    if (this.tu === null) {
      throw new Error("Cannot get AST file of null CXModule");
    }
    return CXFile[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Module_getASTFile(this.#pointer),
    );
  }

  /**
   * Get the full name of this module, e.g. "std.vector".
   */
  getFullName(): string {
    return cxstringToString(
      libclang.symbols.clang_Module_getFullName(this.#pointer),
    );
  }

  /**
   * Get the number of top level headers associated with this module.
   */
  getNumberOfTopLevelHeaders(): number {
    return libclang.symbols.clang_Module_getNumTopLevelHeaders(
      this.tu[POINTER],
      this.#pointer,
    );
  }

  /**
   * Get the parent of this sub-module or `null` if it is top-level,
   * e.g. for 'std.vector' it will return the 'std' module.
   */
  getParent(): null | CXModule {
    const pointer = libclang.symbols.clang_Module_getParent(this.#pointer);
    if (pointer === NULL) {
      return null;
    }
    return CXModule[CONSTRUCTOR](this.tu, pointer);
  }

  /**
   * @param index Top level header index (zero-based).
   * @returns The specified top level header associated with this module.
   */
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

  /**
   * Returns `true` if this module is a system one.
   */
  isSystem(): boolean {
    return libclang.symbols.clang_Module_isSystem(this.#pointer) !== 0;
  }
}

/**
 * A parsed comment.
 *
 * @hideconstructor
 */
export class CXComment {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;
  #kind?: number;
  #childCount?: number;
  #argCount?: number;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXComment.#constructable !== true) {
      throw new Error("CXComment is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXComment {
    CXComment.#constructable = true;
    const result = new CXComment(tu, buffer);
    CXComment.#constructable = false;
    return result;
  }

  /**
   * @returns The type of the AST node.
   */
  get kind(): CXCommentKind {
    return this.#kind ??
      (this.#kind = libclang.symbols.clang_Comment_getKind(this.#buffer));
  }

  #isInlineContent(): boolean {
    const kind = this.kind;
    return kind === CXCommentKind.CXComment_Text ||
      kind === CXCommentKind.CXComment_InlineCommand ||
      kind == CXCommentKind.CXComment_HTMLStartTag ||
      kind === CXCommentKind.CXComment_HTMLEndTag;
  }

  /**
   * Get a human readable string of this {@link CXComment}'s kind.
   *
   * Use this for debugging only.
   */
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

  /**
   * @returns Number of children of the AST node.
   */
  getNumberOfChildren(): number {
    return this.#childCount ??
      (this.#childCount = libclang.symbols.clang_Comment_getNumChildren(
        this.#buffer,
      ));
  }

  /**
   * @param index Child index (zero-based).
   * @returns The specified child of the AST node. Throws error on out-of-bounds access.
   */
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

  /**
   * A {@link CXCommentKind.CXComment_Paragraph} node is considered whitespace if it contains
   * only {@link CXCommentKind.CXComment_Text} nodes that are empty or whitespace.
   *
   * Other AST nodes (except {@link CXCommentKind.CXComment_Paragraph} and {@link CXCommentKind.CXComment_Text}) are
   * never considered whitespace.
   *
   * @returns `true` if this {@link CXComment} is whitespace.
   */
  isWhitespace(): boolean {
    return libclang.symbols.clang_Comment_isWhitespace(this.#buffer) !== 0;
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_Text},
   * {@link CXCommentKind.CXComment_InlineCommand},
   * {@link CXCommentKind.CXComment_HTMLStartTag}, and
   * {@link CXCommentKind.CXComment_HTMLEndTag} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns `true` if this {@link CXComment} is inline content and has a newline
   * immediately following it in the comment text.  Newlines between paragraphs
   * do not count. Throws error if this is not inline content.
   */
  hasTrailingNewline(): boolean {
    if (!this.#isInlineContent()) {
      throw new Error("Not InlineContentComment");
    }
    return libclang.symbols.clang_InlineContentComment_hasTrailingNewline(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_Text},
   * {@link CXCommentKind.CXComment_VerbatimBlockLine}, and
   * {@link CXCommentKind.CXComment_VerbatimLine} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Text contained in the AST node.
   */
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
      throw new Error("Not Text, VerbatimBlockLine, or VerbatimLine Comment");
    }
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_InlineCommand} and
   * {@link CXCommentKind.CXComment_BlockCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Name of the inline or block command.
   */
  getCommandName(): string {
    const kind = this.kind;
    if (kind === CXCommentKind.CXComment_InlineCommand) {
      return cxstringToString(
        libclang.symbols.clang_InlineCommandComment_getCommandName(
          this.#buffer,
        ),
      );
    } else if (
      kind === CXCommentKind.CXComment_BlockCommand ||
      kind === CXCommentKind.CXComment_ParamCommand ||
      kind === CXCommentKind.CXComment_TParamCommand ||
      kind === CXCommentKind.CXComment_VerbatimBlockCommand ||
      kind === CXCommentKind.CXComment_VerbatimLine
    ) {
      return cxstringToString(
        libclang.symbols.clang_BlockCommandComment_getCommandName(this.#buffer),
      );
    } else {
      console.log(
        this.getKindSpelling(),
        cxstringToString(
          libclang.symbols.clang_InlineCommandComment_getCommandName(
            this.#buffer,
          ),
        ),
        cxstringToString(
          libclang.symbols.clang_BlockCommandComment_getCommandName(
            this.#buffer,
          ),
        ),
      );
      throw new Error(
        "Not InlineCommand, BlockCommand, ParamCommand, TParamCommand, or VerbatimBlockCommand",
      );
    }
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_InlineCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns The most appropriate rendering mode, chosen on command
   * semantics in Doxygen.
   */
  getRenderKind(): CXCommentInlineCommandRenderKind {
    if (this.kind !== CXCommentKind.CXComment_InlineCommand) {
      throw new Error("Not InlineCommand");
    }
    return libclang.symbols.clang_InlineCommandComment_getRenderKind(
      this.#buffer,
    );
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_InlineCommand} and
   * {@link CXCommentKind.CXComment_BlockCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Number of command (for block commands, word-like) arguments.
   */
  getNumberOfArguments(): number {
    const kind = this.kind;
    if (kind === CXCommentKind.CXComment_InlineCommand) {
      return this.#argCount ??
        (this.#argCount = libclang.symbols
          .clang_InlineCommandComment_getNumArgs(
            this.#buffer,
          ));
    } else if (
      kind === CXCommentKind.CXComment_BlockCommand ||
      kind === CXCommentKind.CXComment_ParamCommand ||
      kind === CXCommentKind.CXComment_TParamCommand ||
      kind === CXCommentKind.CXComment_VerbatimBlockCommand ||
      kind === CXCommentKind.CXComment_VerbatimLine
    ) {
      return this.#argCount ??
        (this.#argCount = libclang.symbols.clang_BlockCommandComment_getNumArgs(
          this.#buffer,
        ));
    } else {
      throw new Error(
        "Not InlineCommand, BlockCommand, ParamCommand, TParamCommand, or VerbatimBlockCommand",
      );
    }
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_InlineCommand} and
   * {@link CXCommentKind.CXComment_BlockCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @param index Argument index (zero-based).
   * @returns Text of the specified (for block commands, word-like) argument.
   */
  getArgumentText(index: number): string {
    const kind = this.kind;
    const length = this.getNumberOfArguments();
    if (index < 0 || length <= index) {
      throw new Error(
        "Invalid argument, index must be unsigned integer within bounds",
      );
    } else if (kind === CXCommentKind.CXComment_InlineCommand) {
      return cxstringToString(
        libclang.symbols.clang_InlineCommandComment_getArgText(
          this.#buffer,
          index,
        ),
      );
    } else if (
      kind === CXCommentKind.CXComment_BlockCommand ||
      kind === CXCommentKind.CXComment_ParamCommand ||
      kind === CXCommentKind.CXComment_TParamCommand ||
      kind === CXCommentKind.CXComment_VerbatimBlockCommand ||
      kind === CXCommentKind.CXComment_VerbatimLine
    ) {
      return cxstringToString(
        libclang.symbols.clang_BlockCommandComment_getArgText(
          this.#buffer,
          index,
        ),
      );
    } else {
      throw new Error(
        "Not InlineCommand, BlockCommand, ParamCommand, TParamCommand, or VerbatimBlockCommand",
      );
    }
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_HTMLStartTag}, and
   * {@link CXCommentKind.CXComment_HTMLEndTag} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns HTML tag name.
   */
  getTagName(): string {
    const kind = this.kind;
    if (
      kind !== CXCommentKind.CXComment_HTMLEndTag &&
      kind !== CXCommentKind.CXComment_HTMLStartTag
    ) {
      throw new Error("Not HTMLStartTag or HTMLEndTag");
    }
    return cxstringToString(
      libclang.symbols.clang_HTMLTagComment_getTagName(this.#buffer),
    );
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_HTMLStartTag} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns `true` if tag is self-closing (for example, `<br />`).
   */
  isSelfClosing(): boolean {
    return libclang.symbols.clang_HTMLStartTagComment_isSelfClosing(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Get the attributes of a {@link CXCommentKind.CXComment_HTMLStartTag} type AST node.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns An object containing key-value pairs of attributes.
   */
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

  /**
   * Callable on {@link CXCommentKind.CXComment_BlockCommand}, and
   * {@link CXCommentKind.CXComment_VerbatimBlockCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Paragraph argument of the block command.
   */
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

  /**
   * Callable on {@link CXCommentKind.CXComment_ParamCommand}, and
   * {@link CXCommentKind.CXComment_TParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Parameter or template parameter name.
   */
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
      throw new Error("Not ParamCommand or TParamCommand");
    }
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_ParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns `true` if the parameter that this AST node represents was found
   * in the function prototype and {@link getParameterIndex} function will return a meaningful value.
   */
  isParameterIndexValid(): boolean {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_isParamIndexValid(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_ParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Zero-based parameter index in function prototype.
   */
  getParameterIndex(): number {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_getParamIndex(
      this.#buffer,
    );
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_ParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns `true` if parameter passing direction was specified explicitly in
   * the comment.
   */
  isDirectionExplicit(): boolean {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_isDirectionExplicit(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_ParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Parameter passing direction.
   */
  getDirection(): CXCommentParamPassDirection {
    if (this.kind !== CXCommentKind.CXComment_ParamCommand) {
      throw new Error("Not ParamCommand");
    }
    return libclang.symbols.clang_ParamCommandComment_getDirection(
      this.#buffer,
    );
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_TParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns `true` if the parameter that this AST node represents was found
   * in the template parameter list and {@link getDepth} and {@link getIndex}
   * functions will return a meaningful value.
   */
  isParameterPositionValid(): boolean {
    if (this.kind !== CXCommentKind.CXComment_TParamCommand) {
      throw new Error("Not TParamCommand");
    }
    return libclang.symbols.clang_TParamCommandComment_isParamPositionValid(
      this.#buffer,
    ) !== 0;
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_TParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Zero-based nesting depth of this parameter in the template parameter
   * list.
   *
   * For example,
   *
   * ```
   *     template<typename C, template<typename T> class TT>
   *     void test(TT<int> aaa);
   * ```
   * for C and TT nesting depth is 0,
   * for T nesting depth is 1.
   */
  getDepth(): number {
    if (this.kind !== CXCommentKind.CXComment_TParamCommand) {
      throw new Error("Not TParamCommand");
    }
    return libclang.symbols.clang_TParamCommandComment_getDepth(this.#buffer);
  }

  /**
   * Callable on {@link CXCommentKind.CXComment_TParamCommand} type AST nodes.
   *
   * An error is thrown on invalid invocation.
   *
   * @returns Zero-based parameter index in the template parameter list at a
   * given nesting depth.
   *
   * For example,
   *
   * ```
   *     template<typename C, template<typename T> class TT>
   *     void test(TT<int> aaa);
   * ```
   * for C and TT nesting depth is 0, so we can ask for index at depth 0:
   * at depth 0 C's index is 0, TT's index is 1.
   *
   * For T nesting depth is 1, so we can ask for index at depth 0 and 1:
   * at depth 0 T's index is 1 (same as TT's),
   * at depth 1 T's index is 0.
   */
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

  /**
   * Convert an HTML tag AST node to string.
   *
   * Callable on {@link CXCommentKind.CXComment_HTMLStartTag}, and
   * {@link CXCommentKind.CXComment_HTMLEndTag} type AST nodes.
   *
   * @returns String containing an HTML tag.
   */
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

  /**
   * Convert this full parsed comment to an HTML fragment.
   *
   * Callable only on {@link CXCommentKind.CXComment_FullComment} type AST nodes.
   *
   * Specific details of HTML layout are subject to change. Don't try to parse
   * this HTML back into an AST, use other APIs instead.
   *
   * Currently the following CSS classes are used:
   *
   * @li "para-brief" for
   * \\paragraph  and equivalent commands;
   * @li "para-returns" for \\returns paragraph and equivalent commands;
   *
   * @li "word-returns" for the "Returns" word in \\returns paragraph.
   *
   * Function argument documentation is rendered as a list with arguments
   * sorted in function prototype order. CSS classes used:
   *
   * @li "param-name-index-NUMBER" for parameter name ();
   *
   * @li "param-descr-index-NUMBER" for parameter description ();
   *
   * @li "param-name-index-invalid" and "param-descr-index-invalid" are used if
   * parameter index is invalid.
   *
   * Template parameter documentation is rendered as a list with
   * parameters sorted in template parameter list order. CSS classes used:
   *
   * @li "tparam-name-index-NUMBER" for parameter name ();
   *
   * @li "tparam-descr-index-NUMBER" for parameter description ();
   *
   * @li "tparam-name-index-other" and "tparam-descr-index-other" are used for
   * names inside template template parameters;
   *
   * @li "tparam-name-index-invalid" and "tparam-descr-index-invalid" are used if
   * parameter position is invalid.
   *
   * @returns String containing an HTML fragment.
   */
  getAsHTML(): string {
    if (this.kind !== CXCommentKind.CXComment_FullComment) {
      throw new Error("Not FullComment");
    }
    return cxstringToString(
      libclang.symbols.clang_FullComment_getAsHTML(this.#buffer),
    );
  }

  /**
   * Convert this full parsed comment to an XML document.
   *
   * Callable only on {@link CXCommentKind.CXComment_FullComment} type AST nodes.
   *
   * A Relax NG schema for the XML can be found in comment-xml-schema.rng file
   * inside clang source tree.
   *
   * @returns String containing an XML document.
   */
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

  /**
   * Convenience JS API provided for visiting the children of an AST node.
   *
   * The visiting can be recursive, if the {@link callback} returns
   * {@link CXChildVisitResult.CXChildVisit_Recurse}.
   *
   * @returns `true` if the visiting was interrupted by {@link callback} returning
   * {@link CXChildVisitResult.CXChildVisit_Break}.
   */
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
/**
 * Identifies an array of ranges.
 *
 * @hideconstructor
 */
class CXSourceRangeList {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #arrayPointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  /**
   * The number of ranges in this array.
   */
  get length(): number {
    return this.#length;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * Get the {@link CXSourceRange} at the specified index of the array.
   *
   * An error is thrown on out-of-bounds access.
   */
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
    )!;
  }

  /**
   * Destroy this {@link CXSourceRangeList}.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_disposeSourceRangeList(this.#pointer);
    SOURCE_RANGE_LIST_FINALIZATION_REGISTRY.unregister(this);
  }
}

/**
 * Identifies a half-open character range in the source code.
 *
 * Use {@link getRangeStart()} and {@link getRangeEnd()} to retrieve the
 * starting and end locations from a source range, respectively.
 *
 * @hideconstructor
 */
export class CXSourceRange {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXSourceRange.#constructable !== true) {
      throw new Error("CXSourceRange is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXSourceRange | null {
    if (libclang.symbols.clang_Range_isNull(buffer)) {
      return null;
    }
    CXSourceRange.#constructable = true;
    const result = new CXSourceRange(tu, buffer);
    CXSourceRange.#constructable = false;
    return result;
  }

  /**
   * Retrieve a NULL (invalid) source range.
   */
  static getNullRange(): CXSourceRange {
    CXSourceRange.#constructable = true;
    const result = new CXSourceRange(
      null,
      libclang.symbols.clang_getNullRange(),
    );
    CXSourceRange.#constructable = false;
    return result;
  }

  /**
   * Retrieve a source range given the beginning and ending source
   * locations.
   */
  static getRange(
    begin: CXSourceLocation,
    end: CXSourceLocation,
  ): CXSourceRange {
    return CXSourceRange[CONSTRUCTOR](
      begin.tu,
      libclang.symbols.clang_getRange(begin[BUFFER], end[BUFFER]),
    )!;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  get [BUFFER](): Uint8Array {
    return this.#buffer;
  }

  /**
   * Returns `true` if this range is null.
   */
  isNull(): boolean {
    return libclang.symbols.clang_Range_isNull(this.#buffer) !== 0;
  }

  /**
   * Determine whether two ranges are equivalent.
   *
   * @returns `true` if the ranges are the same, `false` if they differ.
   */
  equals(other: CXSourceRange): boolean {
    return libclang.symbols.clang_equalRanges(this.#buffer, other.#buffer) !==
      0;
  }

  /**
   * Retrieve a source location representing the first character within this
   * source range.
   */
  getRangeStart(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getRangeStart(this.#buffer),
    );
  }

  /**
   * Retrieve a source location representing the last character within this
   * source range.
   */
  getRangeEnd(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getRangeEnd(this.#buffer),
    );
  }
}

/**
 * Identifies a specific source location within a translation
 * unit.
 *
 * Use {@link getExpansionLocation()} or {@link getSpellingLocation()}
 * to map a source location to a particular file, line, and column.
 */
export class CXSourceLocation {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #buffer: Uint8Array;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, buffer: Uint8Array) {
    if (CXSourceLocation.#constructable !== true) {
      throw new Error("CXSourceLocation is not constructable");
    }
    this.tu = tu;
    this.#buffer = buffer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    buffer: Uint8Array,
  ): CXSourceLocation {
    CXSourceLocation.#constructable = true;
    const result = new CXSourceLocation(tu, buffer);
    CXSourceLocation.#constructable = false;
    return result;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  get [BUFFER](): Uint8Array {
    return this.#buffer;
  }

  /**
   * Retrieve a NULL (invalid) source location.
   */
  static getNullLocation(): CXSourceLocation {
    return CXSourceLocation[CONSTRUCTOR](
      null,
      libclang.symbols.clang_getNullLocation(),
    );
  }

  /**
   * Determine whether two source locations, which must refer into
   * the same translation unit, refer to exactly the same point in the source
   * code.
   *
   * @returns `true` if the source locations refer to the same location, `false`
   * if they refer to different locations.
   */
  equals(other: CXSourceLocation): boolean {
    return libclang.symbols.clang_equalLocations(
      this.#buffer,
      other.#buffer,
    ) !== 0;
  }

  /**
   * Returns `true` if this source location is in a system header.
   */
  isInSystemHeader(): boolean {
    return libclang.symbols.clang_Location_isInSystemHeader(this.#buffer) !== 0;
  }

  /**
   * Returns `true` if this source location is in the main file of
   * the corresponding translation unit.
   */
  isFromMainFile(): boolean {
    return libclang.symbols.clang_Location_isFromMainFile(this.#buffer) !== 0;
  }

  /**
   * Legacy API to retrieve the file, line, column, and offset represented
   * by this source location.
   *
   * This method has been replaced by the newer method
   * {@link getExpansionLocation()}. See that method's documentation for
   * details.
   *
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

  /**
   * Retrieve the file, line, column, and offset represented by
   * this source location.
   *
   * If the location refers into a macro expansion, retrieves the
   * location of the macro expansion.
   */
  getExpansionLocation(): {
    /**
     * The file to which this source location points.
     */
    file: CXFile;
    /**
     * The line to which this source location points.
     */
    line: number;
    /**
     * The column to which this source location points.
     */
    column: number;
    /**
     * The offset into the buffer to which this source location points.
     */
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

  /**
   * Retrieve the file, line and column represented by this source
   * location, as specified in a # line directive.
   *
   * Example: given the following source code in a file somefile.c
   *
   * ```cpp
   * #123 "dummy.c" 1
   * static int func(void)
   * {
   *     return 0;
   * }
   * ```
   * the location information returned by this function would be
   *
   * File: dummy.c Line: 124 Column: 12
   *
   * whereas clang_getExpansionLocation would have returned
   *
   * File: somefile.c Line: 3 Column: 12
   */
  getPresumedLocation(): {
    /**
     * The filename of the source location. Note that filenames returned will be for "virtual" files,
     * which don't necessarily exist on the machine running clang - e.g. when
     * parsing preprocessed output obtained from a different environment. For an invalid
     * source location, an empty string is returned.
     */
    filename: string;
    /**
     * The line number of the source location. For an invalid source location, zero is returned.
     */
    line: number;
    /**
     * The column number of the source location. For an invalid source location, zero is returned.
     */
    column: number;
  } {
    if (this.tu === null) {
      throw new Error("Cannot get presumed location of null source location");
    }
    const lineOut = new Uint8Array(8);
    const columnOut = lineOut.subarray(4);
    libclang.symbols.clang_getPresumedLocation(
      this.#buffer,
      OUT,
      lineOut,
      columnOut,
    );
    const filename = cxstringToString(OUT);
    const unsignedArray = new Uint32Array(lineOut.buffer);
    const [line, column] = unsignedArray;
    return {
      filename,
      line,
      column,
    };
  }

  /**
   * Retrieve the file, line, column, and offset represented by
   * this source location.
   *
   * If the location refers into a macro instantiation, return where the
   * location was originally spelled in the source file.
   */
  getSpellingLocation(): {
    /**
     * The file to which this source location points.
     */
    file: CXFile;
    /**
     * The line to which this source location points.
     */
    line: number;
    /**
     * The column to which this source location points.
     */
    column: number;
    /**
     * The offset into the buffer to which this source location points.
     */
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

  /**
   * Retrieve the file, line, column, and offset represented by
   * this source location.
   *
   * If the location refers into a macro expansion, return where the macro was
   * expanded or where the macro argument was written, if the location points at
   * a macro argument.
   */
  getFileLocation(): {
    /**
     * The file to which this source location points.
     */
    file: CXFile;
    /**
     * The line to which this source location points.
     */
    line: number;
    /**
     * The column to which this source location points.
     */
    column: number;
    /**
     * The offset into the buffer to which this source location points.
     */
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

/**
 * The type of an element in the abstract syntax tree.
 *
 * @hideconstructor
 */
class CXType {
  static #constructable = false;
  #buffer: Uint8Array;
  #kind?: CXTypeKind;
  tu: CXTranslationUnit;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: CXTranslationUnit, buffer: Uint8Array) {
    if (CXType.#constructable !== true) {
      throw new Error("CXType is not constructable");
    }
    this.#buffer = buffer;
    this.tu = tu;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    buffer: Uint8Array,
  ): CXType | null {
    CXType.#constructable = true;
    const result = new CXType(tu, buffer);
    CXType.#constructable = false;
    return result.kind === CXTypeKind.CXType_Invalid ? null : result;
  }

  /**
   * Get the type kind of this type.
   */
  get kind(): CXTypeKind {
    if (this.#kind === undefined) {
      this.#kind = new DataView(this.#buffer.buffer).getUint32(0, true);
    }

    return this.#kind;
  }

  /**
   * Determine whether two {@link CXType}s represent the same type.
   */
  equals(other: CXType): boolean {
    return libclang.symbols.clang_equalTypes(this.#buffer, other.#buffer) !== 0;
  }

  /**
   * Pretty-print the underlying type using the rules of the
   * language of the translation unit from which it came.
   *
   * If this type is invalid, an empty string is returned.
   */
  getSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypeSpelling(this.#buffer),
    );
  }

  /**
   * Return the canonical type for this {@link CXType}.
   *
   * Clang's type system explicitly models typedefs and all the ways
   * a specific type can be represented. The canonical type is the underlying
   * type with all the "sugar" removed. For example, if 'T' is a typedef
   * for 'int', the canonical type for 'T' would be 'int'.
   */
  getCanonicalType(): CXType {
    // Canonical type probably maybe always exists?
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getCanonicalType(this.#buffer),
    )!;
  }

  /**
   * Determine whether this {@link CXType} has the "const" qualifier set,
   * without looking through typedefs that may have added "const" at a
   * different level.
   */
  isConstQualifiedType(): boolean {
    return libclang.symbols.clang_isConstQualifiedType(this.#buffer) > 0;
  }

  /**
   * Determine whether this {@link CXType} has the "volatile" qualifier set,
   * without looking through typedefs that may have added "volatile" at
   * a different level.
   */
  isVolatileQualifiedType(): boolean {
    return libclang.symbols.clang_isVolatileQualifiedType(this.#buffer) > 0;
  }

  /**
   * Determine whether this {@link CXType} has the "restrict" qualifier set,
   * without looking through typedefs that may have added "restrict" at a
   * different level.
   */
  isRestrictQualifiedType(): boolean {
    return libclang.symbols.clang_isRestrictQualifiedType(this.#buffer) > 0;
  }

  /**
   * Returns the address space of this type.
   */
  getAddressSpace(): number {
    return libclang.symbols.clang_getAddressSpace(this.#buffer);
  }

  /**
   * Returns the typedef name of this type.
   */
  getTypedefName(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypedefName(this.#buffer),
    );
  }

  /**
   * For pointer types, returns the type of the pointee.
   */
  getPointeeType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getPointeeType(this.#buffer),
    );
  }

  /**
   * Return the cursor for the declaration of this type.
   */
  getTypeDeclaration(): CXCursor | null {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTypeDeclaration(this.#buffer),
    );
  }

  /**
   * Returns the Objective-C type encoding for this CXType.
   */
  getObjCEncoding(): string {
    return cxstringToString(
      libclang.symbols.clang_Type_getObjCEncoding(this.#buffer),
    );
  }

  /**
   * Retrieve the spelling of this type's {@link CXTypeKind}.
   */
  getKindSpelling(): string {
    return cxstringToString(
      libclang.symbols.clang_getTypeKindSpelling(this.kind),
    );
  }

  /**
   * Retrieve the calling convention associated with a function type.
   *
   * If this type is not a function type, {@link CXCallingConv.CXCallingConv_Invalid} is returned.
   */
  getFunctionTypeCallingConvention(): CXCallingConv {
    return libclang.symbols.clang_getFunctionTypeCallingConv(this.#buffer);
  }

  /**
   * Retrieve the return type associated with a function type.
   *
   * If this type is not a function type, `null` is returned.
   */
  getResultType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getResultType(this.#buffer),
    );
  }

  /**
   * Retrieve the exception specification type associated with a function type.
   * This is a value of type {@link CXCursor_ExceptionSpecificationKind}.
   *
   * If this type is not a function type, an error code of -1 is returned.
   */
  getExceptionSpecificationType(): CXCursor_ExceptionSpecificationKind | -1 {
    return libclang.symbols.clang_getExceptionSpecificationType(this.#buffer);
  }

  /**
   * Retrieve the number of non-variadic parameters associated with a
   * function type.
   *
   * If this type is not a function type, -1 is returned.
   */
  getNumberOfArgumentTypes(): number {
    return libclang.symbols.clang_getNumArgTypes(this.#buffer);
  }

  /**
   * Retrieve the type of a parameter of a function type.
   *
   * If this type is not a function type or the function does not have enough
   * parameters, `null` is returned.
   */
  getArgumentType(index: number): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getArgType(this.#buffer, index),
    );
  }

  /**
   * Retrieves the base type of the ObjCObjectType.
   *
   * If the type is not an ObjC object, `null` is returned.
   */
  getObjCObjectBaseType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCObjectBaseType(this.#buffer),
    );
  }

  /**
   * Retrieve the number of protocol references associated with an ObjC object/id.
   *
   * If the type is not an ObjC object, 0 is returned.
   */
  getNumberOfObjCProtocolReferences(): number {
    return libclang.symbols.clang_Type_getNumObjCProtocolRefs(this.#buffer);
  }

  /**
   * Retrieve the decl for a protocol reference for an ObjC object/id.
   *
   * If the type is not an ObjC object or there are not enough protocol
   * references, an invalid cursor is returned.
   */
  getObjCProtocolDecl(index: number): CXCursor | null {
    return CXCursor[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCProtocolDecl(this.#buffer, index),
    );
  }

  /**
   * Retrieve the number of type arguments associated with an ObjC object.
   *
   * If the type is not an ObjC object, 0 is returned.
   */
  getNumberOfObjCTypeArguments(): number {
    return libclang.symbols.clang_Type_getNumObjCTypeArgs(this.#buffer);
  }

  /**
   * Retrieve a type argument associated with an ObjC object.
   *
   * If the type is not an ObjC or the index is not valid,
   * an invalid type is returned.
   */
  getObjCTypeArgument(index: number): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getObjCTypeArg(this.#buffer, index),
    );
  }

  /**
   * Returns `true` if this CXType is a variadic function type, and `false` otherwise.
   */
  isFunctionTypeVariadic(): boolean {
    return libclang.symbols.clang_isFunctionTypeVariadic(this.#buffer) > 0;
  }

  /**
   * Return `true` if this CXType is a POD (plain old data) type, and `false`
   * otherwise.
   */
  isPODType(): boolean {
    return libclang.symbols.clang_isPODType(this.#buffer) > 0;
  }

  /**
   * Return the element type of an array, complex, or vector type.
   *
   * If this type is not an array, complex, or vector type,
   * `null` is returned.
   */
  getElementType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getElementType(this.#buffer),
    );
  }

  /**
   * Return the number of elements of an array or vector type.
   *
   * If this type is not an array or vector type,
   * -1 is returned.
   */
  getNumberOfElements(): number {
    return Number(libclang.symbols.clang_getNumElements(this.#buffer));
  }

  /**
   * Return the element type of an array type.
   *
   * If this type is not an array type, `null` is returned.
   */
  getArrayElementType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getArrayElementType(this.#buffer),
    );
  }

  /**
   * Return the array size of a constant array.
   *
   * If this type is not an array type, -1 is returned.
   */
  getArraySize(): number {
    return Number(libclang.symbols.clang_getArraySize(this.#buffer));
  }

  /**
   * Retrieve the type named by the qualified-id.
   *
   * If this type is not an elaborated type, `null` is returned.
   */
  getNamedType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getNamedType(this.#buffer),
    );
  }

  /**
   * Determine if a typedef is 'transparent' tag.
   *
   * A typedef is considered 'transparent' if it shares a name and spelling
   * location with its underlying tag type, as is the case with the `NS_ENUM` macro.
   *
   * @returns `true` if transparent and `false` otherwise.
   */
  isTransparentTagTypedef(): boolean {
    return libclang.symbols.clang_Type_isTransparentTagTypedef(this.#buffer) >
      0;
  }

  /**
   * Retrieve the nullability kind of a pointer type.
   */
  getNullability(): CXTypeNullabilityKind {
    return libclang.symbols.clang_Type_getNullability(this.#buffer);
  }

  /**
   * Return the alignment of a type in bytes as per C++[expr.alignof]
   * standard.
   *
   * If the type declaration is invalid, {@link CXTypeLayoutError.CXTypeLayoutError_Invalid} is returned.
   * If the type declaration is an incomplete type, {@link CXTypeLayoutError.CXTypeLayoutError_Incomplete}
   * is returned.
   * If the type declaration is a dependent type, {@link CXTypeLayoutError.CXTypeLayoutError_Dependent} is
   * returned.
   * If the type declaration is not a constant size type,
   * {@link CXTypeLayoutError.CXTypeLayoutError_NotConstantSize} is returned.
   */
  getAlignOf(): number | CXTypeLayoutError {
    return Number(libclang.symbols.clang_Type_getAlignOf(this.#buffer));
  }

  /**
   * Return the class type of a member pointer type.
   *
   * If this type is not a member-pointer type, `null` is returned.
   */
  getClassType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getClassType(this.#buffer),
    );
  }

  /**
   * Return the size of a type in bytes as per C++[expr.sizeof] standard.
   *
   * If the type declaration is invalid, {@link CXTypeLayoutError.CXTypeLayoutError_Invalid} is returned.
   * If the type declaration is an incomplete type, {@link CXTypeLayoutError.CXTypeLayoutError_Incomplete}
   * is returned.
   * If the type declaration is a dependent type, {@link CXTypeLayoutError.CXTypeLayoutError_Dependent} is
   * returned.
   */
  getSizeOf(): number | CXTypeLayoutError {
    return Number(libclang.symbols.clang_Type_getSizeOf(this.#buffer));
  }

  /**
   * Return the offset of a field named S in a record of type T in bits
   * as it would be returned by __offsetof__ as per C++11[18.2p4]
   *
   * If the cursor is not a record field declaration, {@link CXTypeLayoutError.CXTypeLayoutError_Invalid}
   * is returned.
   * If the field's type declaration is an incomplete type,
   * {@link CXTypeLayoutError.CXTypeLayoutError_Incomplete} is returned.
   * If the field's type declaration is a dependent type,
   * {@link CXTypeLayoutError.CXTypeLayoutError_Dependent} is returned.
   * If the field's name S is not found,
   * {@link CXTypeLayoutError.CXTypeLayoutError_InvalidFieldName} is returned.
   */
  getOffsetOf(fieldName: string): number | CXTypeLayoutError {
    return Number(
      libclang.symbols.clang_Type_getOffsetOf(this.#buffer, cstr(fieldName)),
    );
  }

  /**
   * Return the type that was modified by this attributed type.
   *
   * If the type is not an attributed type, `null` is returned.
   */
  getModifiedType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getModifiedType(this.#buffer),
    );
  }

  /**
   * Gets the type contained by this atomic type.
   *
   * If this type is not an atomic type, `null` is returned.
   */
  getValueType(): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getValueType(this.#buffer),
    );
  }

  /**
   * Returns the number of template arguments for a template
   * specialization, or -1 if this type is not a template specialization.
   */
  getNumberOfTemplateArguments(): number {
    return libclang.symbols.clang_Type_getNumTemplateArguments(this.#buffer);
  }

  /**
   * Returns the type template argument of a template class specialization
   * at given index.
   *
   * This function only returns template type arguments and does not handle
   * template template arguments or variadic packs.
   */
  getTemplateArgumentAsType(index: number): CXType | null {
    return CXType[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_Type_getTemplateArgumentAsType(
        this.#buffer,
        index,
      ),
    );
  }

  /**
   * Retrieve the ref-qualifier kind of a function or method.
   *
   * The ref-qualifier is returned for C++ functions or methods. For other types
   * or non-C++ declarations, CXRefQualifier_None is returned.
   */
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

/**
 * Opaque pointer representing a policy that controls pretty printing
 * for {@link CXCursor.getPrettyPrinted}.
 *
 * Created using {@link CXCursor.getPrintingPolicy}.
 *
 * See also {@link CXPrintingPolicyProperty}.
 *
 * @hideconstructor
 */
class CXPrintingPolicy {
  static #constructable = false;
  #pointer: Deno.PointerValue;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(pointer: Deno.PointerValue) {
    if (CXPrintingPolicy.#constructable !== true) {
      throw new Error("CXPrintingPolicy is not constructable");
    }
    PRINTING_POLICY_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#pointer = pointer;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * Release a printing policy.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
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
/**
 * A group of {@link CXDiagnostic}s.
 *
 * @hideconstructor
 */
export class CXDiagnosticSet {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXDiagnosticSet.#constructable !== true) {
      throw new Error("CXDiagnosticSet is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    DIAGNOSTIC_SET_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#length = libclang.symbols.clang_getNumDiagnosticsInSet(this.#pointer);
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXDiagnosticSet {
    CXDiagnosticSet.#constructable = true;
    const result = new CXDiagnosticSet(tu, pointer);
    CXDiagnosticSet.#constructable = false;
    return result;
  }

  /**
   * Number of {@link CXDiagnostic}s in this set.
   */
  get length(): number {
    return this.#length;
  }

  /**
   * Retrieve a {@link CXDiagnostic} associated with the given {@link index}.
   *
   * @param index The zero-based diagnostic number to retrieve.
   * @returns The requested diagnostic.
   */
  at(index: number): CXDiagnostic {
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

  /**
   * Deserialize a set of diagnostics from a Clang diagnostics bitcode
   * file.
   *
   * @param fileName The name of the file to deserialize.
   *
   * @returns A loaded {@link CXDiagnosticSet} if successful. An error is thrown otherwise.
   */
  static loadDiagnostics(fileName: string): CXDiagnosticSet {
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

  /**
   * Release this {@link CXDiagnosticSet} and all of its contained diagnostics.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
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
/**
 * A single diagnostic, containing the diagnostic's severity,
 * location, text, source ranges, and fix-it hints.
 */
export class CXDiagnostic {
  static #constructable = false;
  tu: null | CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
  constructor(tu: null | CXTranslationUnit, pointer: Deno.PointerValue) {
    if (CXDiagnostic.#constructable !== true) {
      throw new Error("CXDiagnostic is not constructable");
    }
    this.tu = tu;
    this.#pointer = pointer;
    DIAGNOSTIC_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: null | CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXDiagnostic {
    CXDiagnostic.#constructable = true;
    const result = new CXDiagnostic(tu, pointer);
    CXDiagnostic.#constructable = false;
    return result;
  }

  /**
   * Retrieve the child diagnostics of this {@link CXDiagnostic}.
   */
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

  /**
   * Format the given diagnostic in a manner that is suitable for display.
   *
   * This routine will format the given diagnostic to a string, rendering
   * the diagnostic according to the various options given. The
   * `clang_defaultDiagnosticDisplayOptions(`) function returns the set of
   * options that most closely mimics the behavior of the clang compiler.
   *
   * @param [options] An optional options object that control the diagnostic display,
   * see {@link CXDiagnosticDisplayOptions}.
   * @returns A string containing the formatted diagnostic.
   */
  formatDiagnostic(options?: {
    /**
     * Display the source-location information where the
     * diagnostic was located.
     *
     * When set, diagnostics will be prefixed by the file, line, and
     * (optionally) column to which the diagnostic refers. For example,
     *
     * ```cpp
     * test.c:28: warning: extra tokens at end of #endif directive
     * ```
     * This option corresponds to the clang flag `-fshow-source-location.`
     */
    displaySourceLocation: boolean;
    /**
     * If displaying the source-location information of the
     * diagnostic, also include the column number.
     *
     * This option corresponds to the clang flag `-fshow-column.`
     */
    displayColumn: boolean;
    /**
     * If displaying the source-location information of the
     * diagnostic, also include information about source ranges in a
     * machine-parsable format.
     *
     * This option corresponds to the clang flag
     * `-fdiagnostics-print-source-range-info.`
     */
    displaySourceRanges: boolean;
    /**
     * Display the option name associated with this diagnostic, if any.
     *
     * The option name displayed (e.g., -Wconversion) will be placed in brackets
     * after the diagnostic text. This option corresponds to the clang flag
     * `-fdiagnostics-show-option.`
     */
    displayOption: boolean;
    /**
     * Display the category number associated with this diagnostic, if any.
     *
     * The category number is displayed within brackets after the diagnostic text.
     * This option corresponds to the clang flag
     * `-fdiagnostics-show-category=id.`
     */
    displayCategoryId: boolean;
    /**
     * Display the category name associated with this diagnostic, if any.
     *
     * The category name is displayed within brackets after the diagnostic text.
     * This option corresponds to the clang flag
     * `-fdiagnostics-show-category=name.`
     */
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

  /**
   * Retrieve the category number for this diagnostic.
   *
   * Diagnostics can be categorized into groups along with other, related
   * diagnostics (e.g., diagnostics under the same warning flag). This method
   * retrieves the category number for this diagnostic.
   *
   * @returns The number of the category that contains this diagnostic, or zero
   * if this diagnostic is uncategorized.
   */
  getCategory(): number {
    if (this.#disposed) {
      throw new Error("Cannot get category of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticCategory(this.#pointer);
  }

  /**
   * Retrieve the name of this diagnostic category.
   *
   * @deprecated This is now deprecated. Use {@link getCategoryText()}
   * instead.
   *
   * @returns The name of this diagnostic category.
   */
  getCategoryName(): string {
    if (this.#disposed) {
      throw new Error("Cannot get category name of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticCategoryName(
      libclang.symbols.clang_getDiagnosticCategory(this.#pointer),
    ));
  }

  /**
   * Retrieve the diagnostic category text of this diagnostic.
   *
   * @returns The text of this diagnostic category.
   */
  getCategoryText(): string {
    if (this.#disposed) {
      throw new Error("Cannot get category text of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticCategoryText(
      this.#pointer,
    ));
  }

  /**
   * Retrieve the source location of this diagnostic.
   *
   * This location is where Clang would print the caret ('^') when
   * displaying this diagnostic on the command line.
   */
  getLocation(): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location of disposed CXDiagnostic");
    }
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getDiagnosticLocation(this.#pointer),
    );
  }

  /**
   * Determine the number of source ranges associated with this
   * diagnostic.
   */
  getNumberOfRanges(): number {
    if (this.#disposed) {
      throw new Error(
        "Cannot get number of CXSourceRanges of disposed CXDiagnostic",
      );
    }
    return libclang.symbols.clang_getDiagnosticNumRanges(this.#pointer);
  }

  /**
   * Retrieve the name of the command-line option that enabled and/or disabled this
   * diagnostic.
   *
   * @returns A pair of strings that contains the command-line option used to enable
   * and/or disable this warning, such as "-Wconversion" or "-pedantic".
   */
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

  /**
   * Retrieve a source range associated with this diagnostic.
   *
   * A diagnostic's source ranges highlight important elements in the source
   * code. On the command line, Clang displays source ranges by
   * underlining them with '~' characters.
   *
   * @param index The zero-based index specifying which range to retrieve.
   * @returns The requested source range.
   */
  getRange(index: number): CXSourceRange {
    if (this.#disposed) {
      throw new Error("Cannot get range of disposed CXDiagnostic");
    } else if (index < 0) {
      throw new Error("Invalid argument, index must be unsigned integer");
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getDiagnosticRange(this.#pointer, index),
    )!;
  }

  /**
   * Determine the severity of this diagnostic.
   */
  getSeverity(): CXDiagnosticSeverity {
    if (this.#disposed) {
      throw new Error("Cannot get severity of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticSeverity(this.#pointer);
  }

  /**
   * Retrieve the text of this diagnostic.
   */
  getSpelling(): string {
    if (this.#disposed) {
      throw new Error("Cannot get spelling of disposed CXDiagnostic");
    }
    return cxstringToString(libclang.symbols.clang_getDiagnosticSpelling(
      this.#pointer,
    ));
  }

  /**
   * Determine the number of fix-it hints associated with this
   * diagnostic.
   */
  getNumberOfFixIts(): number {
    if (this.#disposed) {
      throw new Error("Cannot get number of FixIts of disposed CXDiagnostic");
    }
    return libclang.symbols.clang_getDiagnosticNumFixIts(this.#pointer);
  }

  /**
   * Retrieve the replacement information for a given fix-it.
   *
   * Fix-its are described in terms of a source range whose contents
   * should be replaced by a string. This approach generalizes over
   * three kinds of operations: removal of source code (the range covers
   * the code to be removed and the replacement string is empty),
   * replacement of source code (the range covers the code to be
   * replaced and the replacement string provides the new code), and
   * insertion (both the start and end of the range point at the
   * insertion location, and the replacement string provides the text to
   * insert).
   *
   * @param index The zero-based index of the fix-it.
   * @returns An object containing the string containing text that should
   * replace the source code indicated by the range in the object.
   */
  getFixIt(index: number): {
    /**
     * The string that should replace the source code indicated by {@link sourceRange}.
     */
    replacementText: string;
    /**
     * The source range whose contents should be
     * replaced with the {@link replacementText} string. Note that source
     * ranges are half-open ranges [a, b), so the source code should be
     * replaced from a and up to (but not including) b.
     */
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
    const sourceRange = CXSourceRange[CONSTRUCTOR](this.tu, sourceRangeBuffer)!;
    return {
      replacementText,
      sourceRange,
    };
  }

  /**
   * Destroy a diagnostic.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
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
/**
 * A remapping of original source files and their translated files.
 */
export class CXRemapping {
  #pointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  /**
   * Retrieve a remapping.
   *
   * @param fileNames A path that contains metadata about remappings, or an array of
   * file paths containing remapping info.
   * @returns The requested remapping. An error is thrown if an error occurred while
   * retrieving the remapping.
   */
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

  /**
   * The number of remappings.
   */
  get length(): number {
    return this.#length;
  }

  /**
   * Get the original and the associated filename from this remapping.
   */
  getFileNames(index: number): {
    /**
     * The original filename of the remapping at {@link index}.
     */
    original: string;
    /**
     * The filename that the {@link original} is associated with.
     */
    transformed: string;
  } {
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

  /**
   * Dispose the remapping.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
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

/**
 * Describes a single preprocessing token.
 *
 * @hideconstructor
 */
class CXToken {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;
  #buffer: Uint8Array;
  #kind: CXTokenKind;
  #disposed = false;

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * The kind of this token.
   */
  get kind(): CXTokenKind {
    return this.#kind;
  }

  /**
   * @private Private API, cannot be used from outside.
   */
  get [BUFFER](): Uint8Array {
    return this.#buffer;
  }

  /**
   * Retrieve a source range that covers this token.
   */
  getExtent(): CXSourceRange {
    if (this.#disposed) {
      throw new Error("Cannot get extent of disposed CXToken");
    }
    return CXSourceRange[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTokenExtent(this.tu[POINTER], this.#buffer),
    )!;
  }

  /**
   * Retrieve the source location of this token.
   */
  getLocation(): CXSourceLocation {
    if (this.#disposed) {
      throw new Error("Cannot get location of disposed CXToken");
    }
    return CXSourceLocation[CONSTRUCTOR](
      this.tu,
      libclang.symbols.clang_getTokenLocation(this.tu[POINTER], this.#buffer),
    );
  }

  /**
   * Determine the spelling of this token.
   *
   * The spelling of a token is the textual representation of that token, e.g.,
   * the text of an identifier or keyword.
   */
  getSpelling(): string {
    if (this.#disposed) {
      throw new Error("Cannot get spelling of disposed CXToken");
    }
    return cxstringToString(
      libclang.symbols.clang_getTokenSpelling(this.tu[POINTER], this.#buffer),
    );
  }

  /**
   * Free this token.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
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

/**
 * @hideconstructor
 */
class CXRewriter {
  static #constructable = false;
  tu: CXTranslationUnit;
  #pointer: Deno.PointerValue;

  /**
   * @private Private API, cannot be used from outside.
   */
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

  /**
   * @private Private API, cannot be used from outside.
   */
  static [CONSTRUCTOR](
    tu: CXTranslationUnit,
    pointer: Deno.PointerValue,
  ): CXRewriter {
    CXRewriter.#constructable = true;
    const result = new CXRewriter(tu, pointer);
    CXRewriter.#constructable = false;
    return result;
  }

  /**
   * Insert the specified string at the specified location in the original buffer.
   */
  insertTextBefore(location: CXSourceLocation, insert: string): void {
    libclang.symbols.clang_CXRewriter_insertTextBefore(
      this.#pointer,
      location[BUFFER],
      cstr(insert),
    );
  }

  /**
   * Replace the specified range of characters in the input with the specified
   * replacement.
   */
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

  /**
   * Remove the specified range.
   */
  removeText(range: CXSourceRange): void {
    libclang.symbols.clang_CXRewriter_removeText(this.#pointer, range[BUFFER]);
  }

  /**
   * Save all changed files to disk.
   *
   * An error is thrown if all files could not be saved successfully.
   */
  overwriteChangedFiles(): void {
    const result = libclang.symbols.clang_CXRewriter_overwriteChangedFiles(
      this.#pointer,
    );

    if (result !== 0) {
      throw new Error("Could not overwrite some changed files.");
    }
  }

  /**
   * Write out rewritten version of the main file to stdout.
   */
  writeMainFileToStdOut(): void {
    libclang.symbols.clang_CXRewriter_writeMainFileToStdOut(this.#pointer);
  }

  /**
   * Free this CXRewriter.
   *
   * It is not strictly necessary to call this method. The memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    libclang.symbols.clang_CXRewriter_dispose(this.#pointer);
    REWRITER_FINALIZATION_REGISTRY.unregister(this);
  }
}
