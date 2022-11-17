import { libclang } from "../ffi.ts";
import { throwIfError } from "../include/ErrorCode.h.ts";
import {
  CXAvailabilityKind,
  CXChildVisitResult,
  CXCursorKind,
  CXCursorVisitorCallbackDefinition,
  CXLanguageKind,
  CXLinkageKind,
  CXPrintingPolicyProperty,
  CXReparse_Flags,
  CXSaveError,
  CXTLSKind,
  CXVisibilityKind,
  NULL,
  NULLBUF,
} from "../include/typeDefinitions.ts";
import { charBufferToString, cstr, cxstringSetToStringArray, cxstringToString } from "../utils.ts";
import { CXDiagnostic, CXDiagnosticSet } from "./CXDiagnostic.ts";

const POINTER = Symbol("[[pointer]]");
const BUFFER = Symbol("[[buffer]]");

const OUT = new Uint8Array(16);
const OUT_2 = OUT.subarray(8);
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
      new CXCursor(cursor, CURRENT_TU),
      new CXCursor(parent, CURRENT_TU),
    );
  },
);

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

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
  }

  save(fileName: string): void {
    if (this.#disposed) {
      throw new Error("Cannot save disposed TranslationUnit");
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
    }
    return libclang.symbols.clang_suspendTranslationUnit(this.#pointer);
  }

  reparse(
    options: CXReparse_Flags = libclang.symbols.clang_defaultReparseOptions(
      this.#pointer,
    ),
  ) {
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
  }

  getTargetInfo(): { triple: string; pointerWidth: number } {
    if (this.#disposed) {
      throw new Error("Cannot get TargetInfo of disposed TranslationUnit");
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

  getAllSkippedRanges() {
    if (this.#disposed) {
      throw new Error("Cannot get skipped ranges of disposed TranslationUnit");
    }
    const listPointer = libclang.symbols.clang_getAllSkippedRanges(
      this.#pointer,
    );
    console.log(listPointer);
  }

  getDiagnostic(index: number) {
    if (this.#disposed) {
      throw new Error("Cannot get diagnostic of disposed TranslationUnit");
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

  getDiagnosticSet() {
    if (this.#disposed) {
      throw new Error("Cannot get diagnostic set of disposed TranslationUnit");
    }
    return new CXDiagnosticSet(
      libclang.symbols.clang_getDiagnosticSetFromTU(this.#pointer),
    );
  }

  getFile(fileName: string): null | CXFile {
    if (this.#disposed) {
      throw new Error("Cannot get file from disposed TranslationUnit");
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
    }
    return libclang.symbols.clang_getNumDiagnostics(this.#pointer);
  }

  getCursor() {
    if (this.#disposed) {
      throw new Error("Cannot get cursor from disposed TranslationUnit");
    }
    const cursor: Uint8Array = libclang.symbols.clang_getTranslationUnitCursor(
      this.#pointer,
    );
    return new CXCursor(cursor, this);
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    for (const file of this.#accessedFiles.values()) {
      file[INNER_DISPOSE]();
    }
    this.#accessedFiles.clear();
    this.#disposed = true;
    libclang.symbols.clang_disposeTranslationUnit(this.#pointer);
  }
}

const INNER_DISPOSE = Symbol("[[dispose]]");

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
    if (pointer === 0) {
      throw new Error("File not loaded");
    }
    const byteLength = Number(OUT_64[0]);
    const buffer = Deno.UnsafePointerView.getArrayBuffer(pointer, byteLength);
    return charBufferToString(new Uint8Array(buffer));
  }

  getLocation(_line: number, _column: number) {
    throw new Error("Cannot implement getLocation without struct support");
    // if (this.#disposed) {
    //     throw new Error("Cannot get location of disposed File");
    // }
    // if (!Number.isFinite(line) || line < 0) {
    // throw new Error("Invalid arugment, line must be unsigned integer");
    // }
    // if (!Number.isFinite(column) || column < 0) {
    // throw new Error("Invalid arugment, column must be unsigned integer");
    // }
    // const res = libclang.symbols.clang_getLocation(this.#tu, this.#pointer, line, column);
    // console.log(res);
  }

  getSkippedRanges() {
    const listPointer = libclang.symbols.clang_getSkippedRanges(
      this.#tu,
      this.#pointer,
    );
    const view = new Deno.UnsafePointerView(listPointer);
    const count = view.getUint32();
    const ranges: unknown[] = [];
    if (count === 0) {
      return ranges;
    }
    const rangesPointer = Number(view.getBigUint64(8));
    const rangesView = new Deno.UnsafePointerView(rangesPointer);
    for (let i = 0; i < count; i++) {
    }
    return ranges;
  }

  isFileMultipleIncludeGuarded(): boolean {
    return libclang.symbols.clang_isFileMultipleIncludeGuarded(
      this.#tu,
      this.#pointer,
    ) > 0;
  }

  getLocationForOffset(_offset: number) {
    throw new Error(
      "Cannot implement getLocationOffset without struct support",
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

  static getNullCursor() {
    new CXCursor(libclang.symbols.clang_getNullCursor(), null);
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
    return cxstringSetToStringArray(libclang.symbols.clang_Cursor_getObjCManglings(this.#buffer));
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
    const language = cxstringToString(languageOut) || null;
    const definedIn = cxstringToString(definedInOut) || null;
    const isGenerated = isGeneratedOut[0] !== 0 || isGeneratedOut[1] !== 0 ||
      isGeneratedOut[2] !== 0 || isGeneratedOut[3] !== 0;
    return isExternalSymbol
      ? {
        language,
        definedIn,
        isGenerated,
      }
      : null;
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
    CURRENT_VISITOR_CALLBACK = callback;
    return libclang.symbols.clang_visitChildren(this.#buffer, CX_CURSOR_VISITOR_CALLBACK.pointer, NULL) > 0;
  }

  getCXXManglings(): string[] {
    return cxstringSetToStringArray(libclang.symbols.clang_Cursor_getCXXManglings(this.#buffer));
  }
}

class CXSourceRangeList {
  #pointer: Deno.PointerValue;

  constructor(pointer: Deno.PointerValue) {
    this.#pointer = pointer;
  }

  dispose() {
    libclang.symbols.clang_disposeSourceRangeList(this.#pointer);
  }
}

class CXSourceRange {
  #buffer: Uint8Array;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;
  }

  isNull() {
    return libclang.symbols.clang_Range_isNull(this.#buffer);
  }

  equals(other: CXSourceRange): boolean {
    return libclang.symbols.clang_equalCursors(this.#buffer, other.#buffer) !==
      0;
  }

  getRangeStart() {
    return new CXSourceLocation(
      libclang.symbols.clang_getRangeStart(this.#buffer),
    );
  }

  getRangeEnd() {
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

  static getNullLocation() {
    return new CXSourceLocation(libclang.symbols.clang_getNullLocation());
  }

  equals(other: CXSourceLocation) {
    return libclang.symbols.clang_equalLocations(this.#buffer, other.#buffer);
  }

  isInSystemHeader(): boolean {

  }

  isFromMainFile(): boolean {

  }

  getExpansionLocation() {

  }

  getPresumedLocation() {
    
  }

  getSpellingLocation() {

  }

  getFileLocation() {

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

  get [POINTER]() {
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

  dispose() {
    libclang.symbols.clang_PrintingPolicy_dispose(this.#pointer);
  }
}
