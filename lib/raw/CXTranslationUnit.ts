import { libclang } from "../ffi.ts";
import { throwIfError } from "../include/ErrorCode.h.ts";
import {
  CXAvailabilityKind,
  CXChildVisitResult,
  CXCursorKind,
  CXCursorVisitorCallbackDefinition,
  CXDiagnosticDisplayOptions,
  CXDiagnosticSeverity,
  CXGlobalOptFlags,
  CXLanguageKind,
  CXLinkageKind,
  CXLoadDiag_Error,
  CXPrintingPolicyProperty,
  CXReparse_Flags,
  CXSaveError,
  CXTLSKind,
  CXTranslationUnit_Flags,
  CXVisibilityKind,
  NULL,
  NULLBUF,
} from "../include/typeDefinitions.ts";
import {
  charBufferToString,
  cstr,
  CStringArray,
  cxstringSetToStringArray,
  cxstringToString,
} from "../utils.ts";

const POINTER = Symbol("[[pointer]]");
const BUFFER = Symbol("[[buffer]]");
const INNER_DISPOSE = Symbol("[[dispose]]");

const OUT = new Uint8Array(16);
const OUT_64 = new BigUint64Array(OUT.buffer);

const TU_FINALIZATION_REGISTRY = new FinalizationRegistry<Deno.PointerValue>(
  (tuPointer) => libclang.symbols.clang_disposeTranslationUnit(tuPointer),
);

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
      new CXCursor(cursor, CURRENT_TU),
      new CXCursor(parent, CURRENT_TU),
    );
  },
);

export interface GlobalOptions {
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
    if (this.#pointer === NULL) {
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

export interface TargetInfo {
  triple: string;
  pointerWidth: number;
}

/**
 * A single translation unit, which resides in an index.
 *
 * ```cpp
 * typedef struct CXTranslationUnitImpl *CXTranslationUnit;
 * ```
 */
export class CXTranslationUnit {
  #accessedFiles = new Map<string, CXFile>();
  #pointer: Deno.PointerValue;
  #disposed = false;
  #suspended = false;

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
    TU_FINALIZATION_REGISTRY.register(this, pointer, this);
  }

  get [POINTER](): Deno.UnsafePointer {
    return this.#pointer;
  }

  save(fileName: string): void {
    if (this.#disposed) {
      throw new Error("Cannot save disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot save suspended TranslationUnit");
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
      throw new Error("Cannot suspend disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot suspend suspended TranslationUnit");
    }
    return libclang.symbols.clang_suspendTranslationUnit(this.#pointer);
  }

  reparse(
    options: CXReparse_Flags = libclang.symbols.clang_defaultReparseOptions(
      this.#pointer,
    ),
  ): void {
    if (this.#disposed) {
      throw new Error("Cannot reparse disposed TranslationUnit");
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
      throw new Error("Cannot get TargetInfo of disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get TargetInfo of suspended TranslationUnit");
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
      throw new Error("Cannot get skipped ranges of disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get skipped ranges of suspended TranslationUnit");
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
    return new CXSourceRangeList(listPointer, rangesPointer, count);
  }

  getDiagnostic(index: number): CXDiagnostic {
    if (this.#disposed) {
      throw new Error("Cannot get diagnostic of disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get diagnostic of suspended TranslationUnit");
    }
    if (!Number.isFinite(index) || index < 0) {
      throw new Error("Invalid arugment, index must be unsigned integer");
    }
    const diagnostic = libclang.symbols.clang_getDiagnostic(
      this.#pointer,
      index,
    );
    return new CXDiagnostic(diagnostic);
  }

  getDiagnosticSet(): CXDiagnosticSet {
    if (this.#disposed) {
      throw new Error("Cannot get diagnostic set of disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get diagnostic set of suspended TranslationUnit");
    }
    return new CXDiagnosticSet(
      libclang.symbols.clang_getDiagnosticSetFromTU(this.#pointer),
    );
  }

  getFile(fileName: string): null | CXFile {
    if (this.#disposed) {
      throw new Error("Cannot get file from disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get file from suspended TranslationUnit");
    }
    if (this.#accessedFiles.has(fileName)) {
      return this.#accessedFiles.get(fileName)!;
    }
    const file_name = cstr(fileName);
    const handle = libclang.symbols.clang_getFile(this.#pointer, file_name);
    if (handle === NULL) {
      return null;
    }
    const file = new CXFile(this.#pointer, handle);
    this.#accessedFiles.set(fileName, file);
    return file;
  }

  getNumDiagnostics(): number {
    if (this.#disposed) {
      throw new Error(
        "Cannot get number of diagnostics from disposed TranslationUnit",
      );
    } else if (this.#suspended) {
      throw new Error(
        "Cannot get number of diagnostics from suspended TranslationUnit",
      );
    }
    return libclang.symbols.clang_getNumDiagnostics(this.#pointer);
  }

  getCursor(): CXCursor {
    if (this.#disposed) {
      throw new Error("Cannot get cursor from disposed TranslationUnit");
    } else if (this.#suspended) {
      throw new Error("Cannot get cursor from suspended TranslationUnit");
    }
    const cursor: Uint8Array = libclang.symbols.clang_getTranslationUnitCursor(
      this.#pointer,
    );
    return new CXCursor(cursor, this);
  }

  getResourceUsage(): CXTUResourceUsage {
    return new CXTUResourceUsage(libclang.symbols.clang_getCXTUResourceUsage(this.#pointer));
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    for (const file of this.#accessedFiles.values()) {
      file[INNER_DISPOSE]();
    }
    this.#accessedFiles.clear();
    this.#disposed = true;
    libclang.symbols.clang_disposeTranslationUnit(this.#pointer);
    // Manually disposed: unregister from FinalizationRegistry.
    TU_FINALIZATION_REGISTRY.unregister(this);
  }
}

class CXTUResourceUsage {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  } 

  dispose(): void {
    libclang.symbols.clang_disposeCXTUResourceUsage(this.#buffer);
  }
}

export class CXFile {
  #tu: Deno.PointerValue;
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(tu: Deno.PointerValue, pointer: Deno.PointerValue) {
    this.#tu = tu;
    this.#pointer = pointer;
  }

  [INNER_DISPOSE]() {
    this.#disposed = true;
  }

  getFileContents(): string {
    if (this.#disposed) {
      throw new Error("Cannot get filecontents of disposed File");
    }
    const pointer = libclang.symbols.clang_getFileContents(
      this.#tu,
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
    }
    if (!Number.isFinite(line) || line < 0) {
      throw new Error("Invalid arugment, line must be unsigned integer");
    }
    if (!Number.isFinite(column) || column < 0) {
      throw new Error("Invalid arugment, column must be unsigned integer");
    }
    const res = libclang.symbols.clang_getLocation(
      this.#tu,
      this.#pointer,
      line,
      column,
    );
    return new CXSourceLocation(res);
  }

  getSkippedRanges(): null | CXSourceRangeList {
    const listPointer = libclang.symbols.clang_getSkippedRanges(
      this.#tu,
      this.#pointer,
    );
    const view = new Deno.UnsafePointerView(listPointer);
    const count = view.getUint32();
    if (count === 0) {
      return null;
    }
    const rangesPointer = Number(view.getBigUint64(8));
    return new CXSourceRangeList(listPointer, rangesPointer, count);
  }

  isFileMultipleIncludeGuarded(): boolean {
    return libclang.symbols.clang_isFileMultipleIncludeGuarded(
      this.#tu,
      this.#pointer,
    ) > 0;
  }

  getLocationForOffset(offset: number): CXSourceLocation {
    return new CXSourceLocation(
      libclang.symbols.clang_getLocationForOffset(
        this.#tu,
        this.#pointer,
        offset,
      ),
    );
  }
}

export class CXCursor {
  tu: CXTranslationUnit | null;
  #buffer: Uint8Array;
  #kind?: CXCursorKind;
  #hash?: number;

  constructor(buffer: Uint8Array, tu: CXTranslationUnit | null) {
    this.#buffer = buffer;
    this.tu = tu;
  }

  static getNullCursor(): CXCursor {
    return new CXCursor(libclang.symbols.clang_getNullCursor(), null);
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
    return new CXCursor(
      libclang.symbols.clang_Cursor_getVarDeclInitializer(this.#buffer),
      this.tu,
    );
  }

  hasAttrs(): boolean {
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
    return new CXCursor(
      libclang.symbols.clang_getCursorLexicalParent(this.#buffer),
      this.tu,
    );
  }

  getLinkage(): CXLinkageKind {
    return libclang.symbols.clang_getCursorLinkage(this.#buffer);
  }

  //getPlatformAvailability() {}

  getSemanticParent(): CXCursor {
    return new CXCursor(
      libclang.symbols.clang_getCursorSemanticParent(this.#buffer),
      this.tu,
    );
  }

  getTLSKind(): CXTLSKind {
    return libclang.symbols.clang_getCursorTLSKind(this.#buffer);
  }

  getVisibility(): CXVisibilityKind {
    return libclang.symbols.clang_getCursorVisibility(this.#buffer);
  }

  getIncludedFile(): CXFile {
    return new CXFile(
      libclang.symbols.clang_Cursor_getTranslationUnit(this.#buffer),
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
    return new CXSourceRange(
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
    return new CXType(
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
    return new CXCursor(
      libclang.symbols.clang_getCanonicalCursor(this.#buffer),
      this.tu,
    );
  }

  getDefinition(): CXCursor {
    return new CXCursor(
      libclang.symbols.clang_getCursorDefinition(this.#buffer),
      this.tu,
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
    return new CXPrintingPolicy(
      libclang.symbols.clang_getCursorPrintingPolicy(this.#buffer),
    );
  }

  getReferenced(): CXCursor {
    return new CXCursor(
      libclang.symbols.clang_getCursorReferenced(this.#buffer),
      this.tu,
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
}

class CXSourceRangeList {
  #pointer: Deno.PointerValue;
  #arrayPointer: Deno.PointerValue;
  #length: number;

  get length() {
    return this.#length;
  }

  constructor(
    pointer: Deno.PointerValue,
    arrayPointer: Deno.PointerValue,
    length: number,
  ) {
    this.#pointer = pointer;
    this.#arrayPointer = arrayPointer;
    this.#length = length;
  }

  at(index: number): CXSourceRange {
    if (index < 0 || this.#length <= index) {
      throw new Error("Out of bounds");
    }
    return new CXSourceRange(
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
    libclang.symbols.clang_disposeSourceRangeList(this.#pointer);
  }
}

class CXSourceRange {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  static getRange(
    begin: CXSourceLocation,
    end: CXSourceLocation,
  ): CXSourceRange {
    return new CXSourceRange(
      libclang.symbols.clang_getRange(begin[BUFFER], end[BUFFER]),
    );
  }

  isNull(): boolean {
    return libclang.symbols.clang_Range_isNull(this.#buffer) !== 0;
  }

  equals(other: CXSourceRange): boolean {
    return libclang.symbols.clang_equalCursors(this.#buffer, other.#buffer) !==
      0;
  }

  getRangeStart(): CXSourceLocation {
    return new CXSourceLocation(
      libclang.symbols.clang_getRangeStart(this.#buffer),
    );
  }

  getRangeEnd(): CXSourceLocation {
    return new CXSourceLocation(
      libclang.symbols.clang_getRangeEnd(this.#buffer),
    );
  }
}

class CXSourceLocation {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  get [BUFFER](): Uint8Array {
    return this.#buffer;
  }

  static getNullLocation(): CXSourceLocation {
    return new CXSourceLocation(libclang.symbols.clang_getNullLocation());
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

  getExpansionLocation(): {
    file: CXFile;
    line: number;
    column: number;
    offset: number;
  } {
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
    const file = new CXFile(
      libclang.symbols.clang_Cursor_getTranslationUnit(this.#buffer),
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
    const cxfileOut = new Uint8Array(8 + 4 * 2);
    const lineOut = cxfileOut.subarray(8, 8 + 4);
    const columnOut = cxfileOut.subarray(8 + 4);
    libclang.symbols.clang_getPresumedLocation(
      this.#buffer,
      cxfileOut,
      lineOut,
      columnOut,
    );
    const file = new CXFile(
      libclang.symbols.clang_Cursor_getTranslationUnit(this.#buffer),
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
    const file = new CXFile(
      libclang.symbols.clang_Cursor_getTranslationUnit(this.#buffer),
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
    const file = new CXFile(
      libclang.symbols.clang_Cursor_getTranslationUnit(this.#buffer),
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
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }
}

class CXPrintingPolicy {
  #pointer: Deno.PointerValue;

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
  }

  get [POINTER](): Deno.PointerValue {
    return this.#pointer;
  }

  get indentation(): number {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Indentation,
    );
  }
  set indentation(value: number) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Indentation,
      value,
    );
  }
  get suppressSpecifiers(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressSpecifiers,
    ) !== 0;
  }
  set suppressSpecifiers(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressSpecifiers,
      value ? 1 : 0,
    );
  }
  get suppressTagKeyword(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressTagKeyword,
    ) !== 0;
  }
  set suppressTagKeyword(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressTagKeyword,
      value ? 1 : 0,
    );
  }
  get includeTagDefinition(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeTagDefinition,
    ) !== 0;
  }
  set includeTagDefinition(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeTagDefinition,
      value ? 1 : 0,
    );
  }
  get suppressScope(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressScope,
    ) !== 0;
  }
  set suppressScope(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressScope,
      value ? 1 : 0,
    );
  }
  get suppressUnwrittenScope(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressUnwrittenScope,
    ) !== 0;
  }
  set suppressUnwrittenScope(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressUnwrittenScope,
      value ? 1 : 0,
    );
  }
  get suppressInitializers(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressInitializers,
    ) !== 0;
  }
  set suppressInitializers(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressInitializers,
      value ? 1 : 0,
    );
  }
  get constantArraySizeAsWritten(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantArraySizeAsWritten,
    ) !== 0;
  }
  set constantArraySizeAsWritten(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantArraySizeAsWritten,
      value ? 1 : 0,
    );
  }
  get anonymousTagLocations(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_AnonymousTagLocations,
    ) !== 0;
  }
  set anonymousTagLocations(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_AnonymousTagLocations,
      value ? 1 : 0,
    );
  }
  get suppressStrongLifetime(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressStrongLifetime,
    ) !== 0;
  }
  set suppressStrongLifetime(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressStrongLifetime,
      value ? 1 : 0,
    );
  }
  get suppressLifetimeQualifiers(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressLifetimeQualifiers,
    ) !== 0;
  }
  set suppressLifetimeQualifiers(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressLifetimeQualifiers,
      value ? 1 : 0,
    );
  }
  get suppressTemplateArgsInCXXConstructors(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty
        .CXPrintingPolicy_SuppressTemplateArgsInCXXConstructors,
    ) !== 0;
  }
  set suppressTemplateArgsInCXXConstructors(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty
        .CXPrintingPolicy_SuppressTemplateArgsInCXXConstructors,
      value ? 1 : 0,
    );
  }
  get bool(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Bool,
    ) !== 0;
  }
  set bool(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Bool,
      value ? 1 : 0,
    );
  }
  get restrict(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Restrict,
    ) !== 0;
  }
  set restrict(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Restrict,
      value ? 1 : 0,
    );
  }
  get alignof(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Alignof,
    ) !== 0;
  }
  set alignof(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Alignof,
      value ? 1 : 0,
    );
  }
  get underscoreAlignof(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UnderscoreAlignof,
    ) !== 0;
  }
  set underscoreAlignof(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UnderscoreAlignof,
      value ? 1 : 0,
    );
  }
  get useVoidForZeroParams(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UseVoidForZeroParams,
    ) !== 0;
  }
  set useVoidForZeroParams(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_UseVoidForZeroParams,
      value ? 1 : 0,
    );
  }
  get terseOutput(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_TerseOutput,
    ) !== 0;
  }
  set terseOutput(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_TerseOutput,
      value ? 1 : 0,
    );
  }
  get polishForDeclaration(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_PolishForDeclaration,
    ) !== 0;
  }
  set polishForDeclaration(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_PolishForDeclaration,
      value ? 1 : 0,
    );
  }
  get half(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Half,
    ) !== 0;
  }
  set half(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_Half,
      value ? 1 : 0,
    );
  }
  get mSWChar(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSWChar,
    ) !== 0;
  }
  set mSWChar(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSWChar,
      value ? 1 : 0,
    );
  }
  get includeNewlines(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeNewlines,
    ) !== 0;
  }
  set includeNewlines(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_IncludeNewlines,
      value ? 1 : 0,
    );
  }
  get mSVCFormatting(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSVCFormatting,
    ) !== 0;
  }
  set mSVCFormatting(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_MSVCFormatting,
      value ? 1 : 0,
    );
  }
  get constantsAsWritten(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantsAsWritten,
    ) !== 0;
  }
  set constantsAsWritten(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_ConstantsAsWritten,
      value ? 1 : 0,
    );
  }
  get suppressImplicitBase(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressImplicitBase,
    ) !== 0;
  }
  set suppressImplicitBase(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_SuppressImplicitBase,
      value ? 1 : 0,
    );
  }
  get fullyQualifiedName(): boolean {
    return libclang.symbols.clang_PrintingPolicy_getProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_FullyQualifiedName,
    ) !== 0;
  }
  set fullyQualifiedName(value: boolean) {
    libclang.symbols.clang_PrintingPolicy_setProperty(
      this.#pointer,
      CXPrintingPolicyProperty.CXPrintingPolicy_FullyQualifiedName,
      value ? 1 : 0,
    );
  }

  dispose(): void {
    libclang.symbols.clang_PrintingPolicy_dispose(this.#pointer);
  }
}

const DIAGNOSTIC_SET_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeDiagnosticSet(pointer));
export class CXDiagnosticSet {
  #pointer: Deno.PointerValue;
  #length: number;
  #disposed = false;

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
    DIAGNOSTIC_SET_FINALIZATION_REGISTRY.register(this, pointer, this);
    this.#length = libclang.symbols.clang_getNumDiagnosticsInSet(this.#pointer);
  }

  get length(): number {
    return this.#length;
  }

  at(index: number) {
    if (this.#disposed) {
      throw new Error(
        "Cannot get CXDiagnostic at index from a disposed CXDiagnosticSet",
      );
    }
    if (index < 0 || this.#length <= index) {
      throw new Error("Out of bounds");
    }
    return new CXDiagnostic(
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
    return new CXDiagnosticSet(pointer);
  }

  dispose() {
    libclang.symbols.clang_disposeDiagnosticSet(this.#pointer);
    this.#disposed = true;
    DIAGNOSTIC_SET_FINALIZATION_REGISTRY.unregister(this);
  }
}

const DIAGNOSTIC_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_disposeDiagnostic(pointer));
export class CXDiagnostic {
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
    DIAGNOSTIC_FINALIZATION_REGISTRY.register(this, pointer, this);

    libclang.symbols.clang_getDiagnosticCategory;
  }

  getChildDiagnostics(): null | CXDiagnosticSet {
    const pointer = libclang.symbols.clang_getChildDiagnostics(this.#pointer);
    if (pointer === NULL) {
      return null;
    }
    const diagnosticSet = new CXDiagnosticSet(pointer);
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
    return new CXSourceLocation(
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
      throw new Error("Out of bounds");
    }
    return new CXSourceRange(
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

  dispose() {
    libclang.symbols.clang_disposeDiagnostic(this.#pointer);
    this.#disposed = true;
    DIAGNOSTIC_FINALIZATION_REGISTRY.unregister(this);
  }
}
