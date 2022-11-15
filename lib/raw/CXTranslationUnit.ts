import { libclang } from "../ffi.ts";
import { throwIfError } from "../include/ErrorCode.h.ts";
import {
  CXAvailabilityKind,
  CXCursorKind,
  CXLanguageKind,
  CXLinkageKind,
  CXReparse_Flags,
  CXSaveError,
  CXTLSKind,
  CXVisibilityKind,
  NULL,
  NULLBUF,
} from "../include/typeDefinitions.ts";
import { charBufferToString, cstr, cxstringToString } from "../utils.ts";
import { CXDiagnostic, CXDiagnosticSet } from "./CXDiagnostic.ts";

const OUT = new Uint8Array(16);
const OUT_2 = OUT.subarray(8);
const OUT_64 = new BigUint64Array(OUT.buffer);

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
    const rangeArrayPointer = Number(view.getBigUint64(8));
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

const BUFFER = Symbol("[[buffer]]");

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
