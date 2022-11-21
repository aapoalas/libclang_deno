import { CXErrorCodeT } from "./ErrorCode.h.ts";
import {
  buf,
  constCharPtr,
  CStringArrayT,
  CX_CXXAccessSpecifierT,
  CX_StorageClassT,
  CXAvailabilityKindT,
  CXCallingConvT,
  CXClientDataT,
  CXCodeCompleteResults,
  CXCompletionChunkKindT,
  CXCompletionResult,
  CXCompletionString,
  CXCursor_ExceptionSpecificationKindT,
  CXCursorAndRangeVisitor,
  CXCursorAndRangeVisitorBlock,
  CXCursorKindT,
  CXCursorSet,
  CXCursorT,
  CXCursorVisitor,
  CXCursorVisitorBlock,
  CXDiagnosticSetT,
  CXDiagnosticT,
  CXEvalResult,
  CXEvalResultKindT,
  CXFieldVisitor,
  CXFileT,
  CXGlobalOptFlagsT,
  CXIdxAttrInfoT,
  CXIdxClientContainer,
  CXIdxClientEntity,
  CXIdxClientFile,
  CXIdxContainerInfoT,
  CXIdxCXXClassDeclInfoT,
  CXIdxDeclInfoT,
  CXIdxEntityInfoT,
  CXIdxEntityKindT,
  CXIdxIBOutletCollectionAttrInfoT,
  CXIdxLoc,
  CXIdxObjCContainerDeclInfoT,
  CXIdxObjCPropertyDeclInfoT,
  CXIdxObjCProtocolRefListInfoT,
  CXInclusionVisitor,
  CXIndexAction,
  CXIndexT,
  CXLanguageKindT,
  CXLinkageKindT,
  CXModule,
  CXPlatformAvailabilityT,
  CXPrintingPolicyPropertyT,
  CXPrintingPolicyT,
  CXRefQualifierKind,
  CXRemapping,
  CXResultT,
  CXSourceLocationT,
  CXSourceRangeList,
  CXSourceRangeT,
  CXString,
  CXStringSetT,
  CXTargetInfoT,
  CXTemplateArgumentKindT,
  CXTLSKindT,
  CXToken,
  CXTokenKindT,
  CXTranslationUnitT,
  CXTUResourceUsageT,
  CXTypeKindT,
  CXTypeNullabilityKindT,
  CXTypeT,
  CXUnsavedFileT,
  CXVisibilityKindT,
  double,
  IndexerCallbacks,
  int,
  longLong,
  out,
  ptr,
  size_t,
  unsigned,
  unsignedLongLong,
} from "./typeDefinitions.ts";

/**
 * Provides a shared context for creating translation units.
 *
 * It provides two options:
 *
 * - `excludeDeclarationsFromPCH`: When non-zero, allows enumeration of "local" declarations (when loading any new translation units). A "local" declaration is one that belongs in the translation unit itself and not in a precompiled header that was used by the translation unit. If zero, all declarations will be enumerated.
 * - `displayDiagnostics`
 *
 * @param excludeDeclarationsFromPCH
 * @param displayDiagnostics
 * @returns CXIndex {@link CXIndexT}
 */
export const clang_createIndex = {
  parameters: ["i32", "i32"],
  result: CXIndexT,
} as const;

/**
 * Destroy the given index.
 *
 * The index must not be destroyed until all of the translation units created within that index have been destroyed.
 */
export const clang_disposeIndex = {
  parameters: [CXIndexT],
  result: "void",
} as const;

/**
 * Sets general options associated with a CXIndex.
 *
 * @param options A bitmask of options, a bitwise OR of CXGlobalOpt_XXX flags.
 */
export const clang_CXIndex_setGlobalOptions = {
  parameters: [CXIndexT, CXGlobalOptFlagsT],
  result: "void",
} as const;

/**
 * Gets the general options associated with a CXIndex.
 *
 * @returns A bitmask of options, a bitwise OR of {@link CXGlobalOptFlags} flags that are associated with the given CXIndex object.
 */
export const clang_CXIndex_getGlobalOptions = {
  parameters: [CXIndexT],
  result: CXGlobalOptFlagsT,
} as const;

/**
 * Sets the invocation emission path option in a CXIndex.
 *
 * The invocation emission path specifies a path which will contain log files for certain libclang invocations. A null value (default) implies that libclang invocations are not logged..
 */
export const clang_CXIndex_setInvocationEmissionPathOption = {
  parameters: [CXIndexT, constCharPtr],
  result: "void",
} as const;

/**
 * Determine whether the given header is guarded against multiple inclusions, either with the conventional #ifndef/#define/#endif macro guards or with #pragma once.
 *
 * @param tu
 * @param file
 */
export const clang_isFileMultipleIncludeGuarded = {
  parameters: [CXTranslationUnitT, CXFileT],
  result: unsigned,
} as const;
/**
 * Retrieve a file handle within the given translation unit.
 *
 * @param tu        the translation unit
 * @param file_name the name of the file.
 * @returns the file handle for the named file in the translation unit tu, or a NULL file handle if the file was not a part of this translation unit.
 */
export const clang_getFile = {
  parameters: [CXTranslationUnitT, constCharPtr],
  result: CXFileT,
} as const;
/**
 * Retrieve the buffer associated with the given file.
 *
 * @param tu    the translation unit
 * @param file  the file for which to retrieve the buffer.
 * @param size  [out] if non-NULL, will be set to the size of the buffer.
 *
 * @returns a pointer to the buffer in memory that holds the contents of file, or a NULL pointer when the file is not loaded.
 */
export const clang_getFileContents = {
  parameters: [CXTranslationUnitT, CXFileT, out(size_t)],
  result: constCharPtr,
} as const;
/**
 * Retrieves the source location associated with a given file/line/column in a particular translation unit.
 * @param tu
 * @param file
 * @param line
 * @param column
 */
export const clang_getLocation = {
  parameters: [CXTranslationUnitT, CXFileT, unsigned, unsigned],
  result: CXSourceLocationT,
} as const;
/**
 * Retrieves the source location associated with a given character offset in a particular translation unit.
 * @param tu
 * @param file
 * @param offset
 */
export const clang_getLocationForOffset = {
  parameters: [CXTranslationUnitT, CXFileT, unsigned],
  result: CXSourceLocationT,
} as const;
/**
 * Retrieve all ranges that were skipped by the preprocessor.
 *
 * The preprocessor will skip lines when they are surrounded by an if/ifdef/ifndef directive whose condition does not evaluate to true.
 *
 * @param tu
 * @param file
 * @returns `CxSourceRangeList*`
 */
export const clang_getSkippedRanges = {
  parameters: [CXTranslationUnitT, CXFileT],
  result: ptr(CXSourceRangeList),
} as const;
/**
 * Retrieve all ranges from all files that were skipped by the preprocessor.
 *
 * The preprocessor will skip lines when they are surrounded by an if/ifdef/ifndef directive whose condition does not evaluate to true.
 *
 * @returns `CXSourceRangeList*`
 */
export const clang_getAllSkippedRanges = {
  parameters: [CXTranslationUnitT],
  result: ptr(CXSourceRangeList),
} as const;
/**
 * Determine the number of diagnostics produced for the given translation unit.
 * @param Unit
 */
export const clang_getNumDiagnostics = {
  parameters: [CXTranslationUnitT],
  result: unsigned,
} as const;
/**
 * Retrieve a diagnostic associated with the given translation unit.
 *
 * @param Unit  the translation unit to query.
 * @param Index the zero-based diagnostic number to retrieve.
 * @returns the requested diagnostic. This diagnostic must be freed via a call to `clang_disposeDiagnostic()`.
 */
export const clang_getDiagnostic = {
  parameters: [CXTranslationUnitT, unsigned],
  result: CXDiagnosticT,
} as const;
/**
 * Retrieve the complete set of diagnostics associated with a translation unit.
 *
 * @param Unit the translation unit to query.
 */
export const clang_getDiagnosticSetFromTU = {
  parameters: [CXTranslationUnitT],
  result: CXDiagnosticSetT,
} as const;

/**
 * Translation unit manipulation
 *
 * The routines in this group provide the ability to create and destroy
 * translation units from files, either by parsing the contents of the files or
 * by reading in a serialized representation of a translation unit.
 */

/**
 * Get the original translation unit source file name.
 * @param CTUnit
 */
export const clang_getTranslationUnitSpelling = {
  parameters: [CXTranslationUnitT],
  result: CXString,
} as const;

/**
 * Return the CXTranslationUnit for a given source file and the provided
 * command line arguments one would pass to the compiler.
 *
 * Note: The 'source_filename' argument is optional.  If the caller provides a
 * NULL pointer, the name of the source file is expected to reside in the
 * specified command line arguments.
 *
 * Note: When encountered in 'clang_command_line_args', the following options
 * are ignored:
 *
 *   '-c'
 *   '-emit-ast'
 *   '-fsyntax-only'
 *   '-o <output file>'  (both '-o' and '<output file>' are ignored)
 *
 * @param CIdx The index object with which the translation unit will be
 * associated.
 *
 * @param source_filename The name of the source file to load, or NULL if the
 * source file is included in `clang_command_line_args`.
 *
 * @param num_clang_command_line_args The number of command-line arguments in
 * `clang_command_line_args`.
 *
 * @param clang_command_line_args The command-line arguments that would be
 * passed to the `clang` executable if it were being invoked out-of-process.
 * These command-line options will be parsed and will affect how the translation
 * unit is parsed. Note that the following options are ignored: '-c',
 * '-emit-ast', '-fsyntax-only' (which is the default), and '-o <output file>'.
 *
 * @param num_unsaved_files the number of unsaved file entries in \p
 * unsaved_files.
 *
 * @param unsaved_files the files that have not yet been saved to disk
 * but may be required for code completion, including the contents of
 * those files.  The contents and name of these files (as specified by
 * CXUnsavedFile) are copied when necessary, so the client only needs to
 * guarantee their validity until the call to this function returns.
 */
export const clang_createTranslationUnitFromSourceFile = {
  parameters: [
    CXIndexT,
    constCharPtr,
    int,
    constCharPtr,
    unsigned,
    CXUnsavedFileT,
  ],
  result: CXTranslationUnitT,
} as const;

/**
 * Same as {@link clang_createTranslationUnit2}, but returns
 * the {@link CXTranslationUnit} instead of an error code.  In case of an error this
 * routine returns a {@link NULL} {@link CXTranslationUnit}, without further detailed
 * error codes.
 * @param CIdx {@link CXIndexT}
 * @param ast_filename
 */
export const clang_createTranslationUnit = {
  parameters: [CXIndexT, constCharPtr],
  result: CXTranslationUnitT,
} as const;

/**
 * Create a translation unit from an AST file (`$1`.
 *
 * @param CIdx
 * @param ast_filename
 * @param out_TU [out] A non-NULL pointer to store the created
 * {@link CXTranslationUnit}.
 *
 * @returns Zero on success, otherwise returns an error code.
 */
export const clang_createTranslationUnit2 = {
  parameters: [CXIndexT, constCharPtr, out(CXTranslationUnitT)],
  result: CXErrorCodeT,
} as const;

/**
 * Returns the set of flags that is suitable for parsing a translation
 * unit that is being edited.
 *
 * The set of flags returned provide options for {@link clang_parseTranslationUnit})
 * to indicate that the translation unit is likely to be reparsed many times,
 * either explicitly (via {@link clang_reparseTranslationUnit})) or implicitly
 * (e.g., by code completion ({@link clang_codeCompletionAt}))). The returned flag
 * set contains an unspecified set of optimizations (e.g., the precompiled
 * preamble) geared toward improving the performance of these routines. The
 * set of optimizations enabled may change from one version to the next.
 */
export const clang_defaultEditingTranslationUnitOptions = {
  parameters: [],
  result: unsigned,
} as const;

/**
 * Same as {@link clang_parseTranslationUnit2}, but returns
 * the {@link CXTranslationUnit} instead of an error code.  In case of an error this
 * routine returns a {@link NULL} {@link CXTranslationUnit}, without further detailed
 * error codes.
 * @param CIdx
 * @param source_filename
 * @param command_line_args
 * @param num_command_line_args
 * @param unsaved_files
 * @param num_unsaved_files
 * @param options
 */
export const clang_parseTranslationUnit = {
  parameters: [
    CXIndexT,
    constCharPtr,
    CStringArrayT,
    int,
    CXUnsavedFileT,
    unsigned,
    unsigned,
  ],
  result: CXTranslationUnitT,
} as const;

/**
 * Parse the given source file and the translation unit corresponding
 * to that file.
 *
 * This routine is the main entry point for the Clang C API, providing the
 * ability to parse a source file into a translation unit that can then be
 * queried by other functions in the API. This routine accepts a set of
 * command-line arguments so that the compilation can be configured in the same
 * way that the compiler is configured on the command line.
 *
 * @param CIdx The index object with which the translation unit will be
 * associated.
 *
 * @param source_filename The name of the source file to load, or NULL if the
 * source file is included in `command_line_args`.
 *
 * @param command_line_args The command-line arguments that would be
 * passed to the `clang` executable if it were being invoked out-of-process.
 * These command-line options will be parsed and will affect how the translation
 * unit is parsed. Note that the following options are ignored: '-c',
 * '-emit-ast', '-fsyntax-only' (which is the default), and '-o <output file>'.
 *
 * @param num_command_line_args The number of command-line arguments in
 * `command_line_args`.
 *
 * @param unsaved_files the files that have not yet been saved to disk
 * but may be required for parsing, including the contents of
 * those files.  The contents and name of these files (as specified by
 * CXUnsavedFile) are copied when necessary, so the client only needs to
 * guarantee their validity until the call to this function returns.
 *
 * @param num_unsaved_files the number of unsaved file entries in \p
 * unsaved_files.
 *
 * @param options A bitmask of options that affects how the translation unit
 * is managed but not its compilation. This should be a bitwise OR of the
 * CXTranslationUnit_XXX flags.
 *
 * @param out_TU [out] A non-NULL pointer to store the created
 * {@link CXTranslationUnit}, describing the parsed code and containing any
 * diagnostics produced by the compiler.
 *
 * @returns Zero on success, otherwise returns an error code.
 */
export const clang_parseTranslationUnit2 = {
  parameters: [
    CXIndexT,
    constCharPtr,
    CStringArrayT,
    int,
    ptr(CXUnsavedFileT),
    unsigned,
    unsigned,
    out(CXTranslationUnitT),
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Same as clang_parseTranslationUnit2 but requires a full command line
 * for `$1` including argv[0]. This is useful if the standard
 * library paths are relative to the binary.
 * @param CIdx
 * @param source_filename
 * @param command_line_args
 * @param num_command_line_args
 * @param unsaved_files
 * @param num_unsaved_files
 * @param options
 * @param out_TU
 */
export const clang_parseTranslationUnit2FullArgv = {
  parameters: [
    CXIndexT,
    constCharPtr,
    CStringArrayT,
    int,
    CXUnsavedFileT,
    unsigned,
    unsigned,
    out(CXTranslationUnitT),
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Returns the set of flags that is suitable for saving a translation
 * unit.
 *
 * The set of flags returned provide options for
 * {@link clang_saveTranslationUnit}) by default. The returned flag
 * set contains an unspecified set of options that save translation units with
 * the most commonly-requested data.
 *
 * @param TU
 */
export const clang_defaultSaveOptions = {
  parameters: [CXTranslationUnitT],
  result: unsigned,
} as const;

/**
 * Saves a translation unit into a serialized representation of
 * that translation unit on disk.
 *
 * Any translation unit that was parsed without error can be saved
 * into a file. The translation unit can then be deserialized into a
 * new {@link CXTranslationUnit} with {@link clang_createTranslationUnit}) or,
 * if it is an incomplete translation unit that corresponds to a
 * header, used as a precompiled header when parsing other translation
 * units.
 *
 * @param TU The translation unit to save.
 *
 * @param FileName The file to which the translation unit will be saved.
 *
 * @param options A bitmask of options that affects how the translation unit
 * is saved. This should be a bitwise OR of the
 * CXSaveTranslationUnit_XXX flags.
 *
 * @returns A value that will match one of the enumerators of the CXSaveError
 * enumeration. Zero (CXSaveError_None) indicates that the translation unit was
 * saved successfully, while a non-zero value indicates that a problem occurred.
 */
export const clang_saveTranslationUnit = {
  parameters: [CXTranslationUnitT, constCharPtr, unsigned],
  result: int,
} as const;

/**
 * Suspend a translation unit in order to free memory associated with it.
 *
 * A suspended translation unit uses significantly less memory but on the other
 * side does not support any other calls than {@link clang_reparseTranslationUnit}
 * to resume it or {@link clang_disposeTranslationUnit} to dispose it completely.
 */
export const clang_suspendTranslationUnit = {
  parameters: [CXTranslationUnitT],
  result: unsigned,
} as const;

/**
 * Destroy the specified CXTranslationUnit object.
 */
export const clang_disposeTranslationUnit = {
  parameters: [CXTranslationUnitT],
  result: "void",
} as const;

/**
 * Returns the set of flags that is suitable for reparsing a translation
 * unit.
 *
 * The set of flags returned provide options for
 * {@link clang_reparseTranslationUnit}) by default. The returned flag
 * set contains an unspecified set of optimizations geared toward common uses
 * of reparsing. The set of optimizations enabled may change from one version
 * to the next.
 * @param TU
 */
export const clang_defaultReparseOptions = {
  parameters: [CXTranslationUnitT],
  result: unsigned,
} as const;

/**
 * Reparse the source files that produced this translation unit.
 *
 * This routine can be used to re-parse the source files that originally
 * created the given translation unit, for example because those source files
 * have changed (either on disk or as passed via `unsaved_files`). The
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
 * @param TU The translation unit whose contents will be re-parsed. The
 * translation unit must originally have been built with
 * {@link clang_createTranslationUnitFromSourceFile}).
 *
 * @param num_unsaved_files The number of unsaved file entries in \p
 * unsaved_files.
 *
 * @param unsaved_files The files that have not yet been saved to disk
 * but may be required for parsing, including the contents of
 * those files.  The contents and name of these files (as specified by
 * CXUnsavedFile) are copied when necessary, so the client only needs to
 * guarantee their validity until the call to this function returns.
 *
 * @param options A bitset of options composed of the flags in CXReparse_Flags.
 * The function {@link clang_defaultReparseOptions}) produces a default set of
 * options recommended for most uses, based on the translation unit.
 *
 * @returns 0 if the sources could be reparsed.  A non-zero error code will be
 * returned if reparsing was impossible, such that the translation unit is
 * invalid. In such cases, the only valid call for `$1` is
 * {@link clang_disposeTranslationUnit}().  The error codes returned by this
 * routine are described by the {@link CXErrorCode} enum.
 */
export const clang_reparseTranslationUnit = {
  parameters: [CXTranslationUnitT, unsigned, CXUnsavedFileT, unsigned],
  result: int,
} as const;

/**
 * Returns the human-readable null-terminated C string that represents
 *  the name of the memory category.  This string should never be freed.
 * @param kind {@link CXTUResourceUsageKind}
 */
export const clang_getTUResourceUsageName = {
  parameters: [unsigned],
  result: constCharPtr,
} as const;

/**
 * Return the memory usage of a translation unit.  This object
 *  should be released with clang_disposeCXTUResourceUsage().
 * @param TU
 */
export const clang_getCXTUResourceUsage = {
  parameters: [CXTranslationUnitT],
  result: CXTUResourceUsageT,
} as const;

/**
 * @param usage
 */
export const clang_disposeCXTUResourceUsage = {
  parameters: [CXTUResourceUsageT],
  result: "void",
} as const;

/**
 * Get target information for this translation unit.
 *
 * The CXTargetInfo object cannot outlive the CXTranslationUnit object.
 * @param CTUnit
 */
export const clang_getTranslationUnitTargetInfo = {
  parameters: [CXTranslationUnitT],
  result: CXTargetInfoT,
} as const;

/**
 * Destroy the CXTargetInfo object.
 * @param Info
 */
export const clang_TargetInfo_dispose = {
  parameters: [CXTargetInfoT],
  result: "void",
} as const;

/**
 * Get the normalized target triple as a string.
 *
 * Returns the empty string in case of any error.
 * @param Info
 */
export const clang_TargetInfo_getTriple = {
  parameters: [CXTargetInfoT],
  result: CXString,
} as const;

/**
 * Get the pointer width of the target in bits.
 *
 * Returns -1 in case of error.
 * @param Info
 */
export const clang_TargetInfo_getPointerWidth = {
  parameters: [CXTargetInfoT],
  result: int,
} as const;

/**
 * Retrieve the NULL cursor, which represents no entity.
 */
export const clang_getNullCursor = {
  parameters: [],
  result: CXCursorT,
} as const;

/**
 * Retrieve the cursor that represents the given translation unit.
 *
 * The translation unit cursor can be used to start traversing the
 * various declarations within the given translation unit.
 */
export const clang_getTranslationUnitCursor = {
  parameters: [CXTranslationUnitT],
  result: CXCursorT,
} as const;

/**
 * Determine whether two cursors are equivalent.
 */
export const clang_equalCursors = {
  parameters: [CXCursorT, CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns non-zero if `cursor` is null.
 * @param cursor {@link CXCursor}
 */
export const clang_Cursor_isNull = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Compute a hash value for the given cursor.
 */
export const clang_hashCursor = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Retrieve the kind of the given cursor.
 */
export const clang_getCursorKind = {
  parameters: [CXCursorT],
  result: CXCursorKindT,
} as const;

/**
 * Determine whether the given cursor kind represents a declaration.
 */
export const clang_isDeclaration = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given declaration is invalid.
 *
 * A declaration is invalid if it could not be parsed successfully.
 *
 * \returns non-zero if the cursor represents a declaration and it is
 * invalid, otherwise NULL.
 */
export const clang_isInvalidDeclaration = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents a simple
 * reference.
 *
 * Note that other kinds of cursors (such as expressions) can also refer to
 * other cursors. Use clang_getCursorReferenced() to determine whether a
 * particular cursor refers to another entity.
 */
export const clang_isReference = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents an expression.
 */
export const clang_isExpression = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents a statement.
 */
export const clang_isStatement = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents an attribute.
 */
export const clang_isAttribute = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor has any attributes.
 */
export const clang_Cursor_hasAttrs = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents an invalid
 * cursor.
 */
export const clang_isInvalid = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor kind represents a translation
 * unit.
 */
export const clang_isTranslationUnit = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/***
 * Determine whether the given cursor represents a preprocessing
 * element, such as a preprocessor directive or macro instantiation.
 */
export const clang_isPreprocessing = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/***
 * Determine whether the given cursor represents a currently
 *  unexposed piece of the AST (e.g., CXCursor_UnexposedStmt).
 */
export const clang_isUnexposed = {
  parameters: [CXCursorKindT],
  result: unsigned,
} as const;

/**
 * Determine the linkage of the entity referred to by a given cursor.
 * @param cursor {@link CXCursor}
 */
export const clang_getCursorLinkage = {
  parameters: [CXCursorT],
  result: CXLinkageKindT,
} as const;

/**
 * Describe the visibility of the entity referred to by a cursor.
 *
 * This returns the default visibility if not explicitly specified by
 * a visibility attribute. The default visibility may be changed by
 * commandline arguments.
 *
 * @param cursor The cursor to query.
 *
 * \returns The visibility of the cursor.
 * @param cursor {@link CXCursor}
 */
export const clang_getCursorVisibility = {
  parameters: [CXCursorT],
  result: CXVisibilityKindT,
} as const;

/**
 * Determine the availability of the entity that this cursor refers to,
 * taking the current target platform into account.
 *
 * @param cursor The cursor to query.
 *
 * \returns The availability of the cursor.
 * @param cursor {@link CXCursor}
 */
export const clang_getCursorAvailability = {
  parameters: [CXCursorT],
  result: CXAvailabilityKindT,
} as const;

/**
 * Determine the availability of the entity that this cursor refers to
 * on any platforms for which availability information is known.
 *
 * @param cursor The cursor to query.
 *
 * @param always_deprecated If non-NULL, will be set to indicate whether the
 * entity is deprecated on all platforms.
 *
 * @param deprecated_message If non-NULL, will be set to the message text
 * provided along with the unconditional deprecation of this entity. The client
 * is responsible for deallocating this string.
 *
 * @param always_unavailable If non-NULL, will be set to indicate whether the
 * entity is unavailable on all platforms.
 *
 * @param unavailable_message If non-NULL, will be set to the message text
 * provided along with the unconditional unavailability of this entity. The
 * client is responsible for deallocating this string.
 *
 * @param availability If non-NULL, an array of CXPlatformAvailability instances
 * that will be populated with platform availability information, up to either
 * the number of platforms for which availability information is available (as
 * returned by this function) or `$1`, whichever is smaller.
 *
 * @param availability_size The number of elements available in the
 * `availability` array.
 *
 * \returns The number of platforms (N) for which availability information is
 * available (which is unrelated to `$1`.
 *
 * Note that the client is responsible for calling
 * {@link clang_disposeCXPlatformAvailability} to free each of the
 * platform-availability structures returned. There are
 * `availability_size` such structures.
 */
export const clang_getCursorPlatformAvailability = {
  parameters: [
    CXCursorT,
    out(int),
    out(CXString),
    out(int),
    out(CXString),
    out(CXPlatformAvailabilityT),
    int,
  ],
  result: int,
} as const;

/**
 * Free the memory associated with a {@link CXPlatformAvailabilityT} structure.
 * @param availability (`CXPlatformAvailability *`)
 */
export const clang_disposeCXPlatformAvailability = {
  parameters: [out(CXPlatformAvailabilityT)],
  result: "void",
} as const;

/**
 * If cursor refers to a variable declaration and it has initializer returns
 * cursor referring to the initializer otherwise return null cursor.
 * @param cursor {@link CXCursor}
 */
export const clang_Cursor_getVarDeclInitializer = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * If cursor refers to a variable declaration that has global storage returns 1.
 * If cursor refers to a variable declaration that doesn't have global storage
 * returns 0. Otherwise returns -1.
 * @param cursor {@link CXCursor}
 */
export const clang_Cursor_hasVarDeclGlobalStorage = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * If cursor refers to a variable declaration that has external storage
 * returns 1. If cursor refers to a variable declaration that doesn't have
 * external storage returns 0. Otherwise returns -1.
 * @param cursor {@link CXCursor}
 */
export const clang_Cursor_hasVarDeclExternalStorage = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Determine the "language" of the entity referred to by a given cursor.
 * @param cursor {@link CXCursor}
 * @returns CXLanguageKind {@link CXLanguageKind}
 */
export const clang_getCursorLanguage = {
  parameters: [CXCursorT],
  result: CXLanguageKindT,
} as const;

/**
 * Determine the "thread-local storage (TLS) kind" of the declaration
 * referred to by a cursor.
 * @param cursor {@link CXCursor}
 * @returns CXTLSKind {@link CXTLSKind}
 */
export const clang_getCursorTLSKind = {
  parameters: [CXCursorT],
  result: CXTLSKindT,
} as const;

/**
 * Returns the translation unit that a cursor originated from.
 */
export const clang_Cursor_getTranslationUnit = {
  parameters: [CXCursorT],
  result: CXTranslationUnitT,
} as const;

/**
 * Creates an empty CXCursorSet.
 */
export const clang_createCXCursorSet = {
  parameters: [],
  result: CXCursorSet,
} as const;

/**
 * Disposes a CXCursorSet and releases its associated memory.
 * @param cset
 */
export const clang_disposeCXCursorSet = {
  parameters: [CXCursorSet],
  result: "void",
} as const;

/**
 * Queries a CXCursorSet to see if it contains a specific CXCursor.
 *
 * \returns non-zero if the set contains the specified cursor.
 * @param cset
 * @param cursor
 */
export const clang_CXCursorSet_contains = {
  parameters: [CXCursorSet, CXCursorT],
  result: unsigned,
} as const;

/**
 * Inserts a CXCursor into a CXCursorSet.
 *
 * \returns zero if the CXCursor was already in the set, and non-zero otherwise.
 * @param cset
 * @param cursor
 */
export const clang_CXCursorSet_insert = {
  parameters: [CXCursorSet, CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine the semantic parent of the given cursor.
 *
 * The semantic parent of a cursor is the cursor that semantically contains
 * the given `cursor`. For many declarations, the lexical and semantic parents
 * are equivalent (the lexical parent is returned by
 * {@link clang_getCursorLexicalParent}()). They diverge when declarations or
 * definitions are provided out-of-line. For example:
 *
 * ```c++
 * class C {
 *  void f();
 * };
 *
 * void C::f() { }
 * ```
 *
 * In the out-of-line definition of `$1`, the semantic parent is
 * the class `$1`, of which this function is a member. The lexical parent is
 * the place where the declaration actually occurs in the source code; in this
 * case, the definition occurs in the translation unit. In general, the
 * lexical parent for a given entity can change without affecting the semantics
 * of the program, and the lexical parent of different declarations of the
 * same entity may be different. Changing the semantic parent of a declaration,
 * on the other hand, can have a major impact on semantics, and redeclarations
 * of a particular entity should all have the same semantic context.
 *
 * In the example above, both declarations of `$1` have `$1` as their
 * semantic context, while the lexical context of the first `$1` is `$1`
 * and the lexical context of the second `$1` is the translation unit.
 *
 * For global declarations, the semantic parent is the translation unit.
 * @param cursor {@link CXCursor}
 */
export const clang_getCursorSemanticParent = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * Determine the lexical parent of the given cursor.
 *
 * The lexical parent of a cursor is the cursor in which the given `cursor`
 * was actually written. For many declarations, the lexical and semantic parents
 * are equivalent (the semantic parent is returned by
 * {@link clang_getCursorSemanticParent}()). They diverge when declarations or
 * definitions are provided out-of-line. For example:
 *
 * ```c++
 * class C {
 *  void f();
 * };
 *
 * void C::f() { }
 * ```
 *
 * In the out-of-line definition of `$1`, the semantic parent is
 * the class `$1`, of which this function is a member. The lexical parent is
 * the place where the declaration actually occurs in the source code; in this
 * case, the definition occurs in the translation unit. In general, the
 * lexical parent for a given entity can change without affecting the semantics
 * of the program, and the lexical parent of different declarations of the
 * same entity may be different. Changing the semantic parent of a declaration,
 * on the other hand, can have a major impact on semantics, and redeclarations
 * of a particular entity should all have the same semantic context.
 *
 * In the example above, both declarations of `$1` have `$1` as their
 * semantic context, while the lexical context of the first `$1` is `$1`
 * and the lexical context of the second `$1` is the translation unit.
 *
 * For declarations written in the global scope, the lexical parent is
 * the translation unit.
 * @param cursor {@link CXCursor}
 */
export const clang_getCursorLexicalParent = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * Determine the set of methods that are overridden by the given
 * method.
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
 * @param cursor A cursor representing an Objective-C or C++
 * method. This routine will compute the set of methods that this
 * method overrides.
 *
 * @param overridden A pointer whose pointee will be replaced with a
 * pointer to an array of cursors, representing the set of overridden
 * methods. If there are no overridden methods, the pointee will be
 * set to NULL. The pointee must be freed via a call to
 * {@link clang_disposeOverriddenCursors}().
 *
 * @param num_overridden A pointer to the number of overridden
 * functions, will be set to the number of overridden functions in the
 * array pointed to by `overridden`.
 */
export const clang_getOverriddenCursors = {
  parameters: [CXCursorT, out(out(CXCursorT)), out(unsigned)],
  result: "void",
} as const;

/**
 * Free the set of overridden cursors returned by {@link clang_getOverriddenCursors}().
 * @param {CxCursor *} overridden
 */
export const clang_disposeOverriddenCursors = {
  parameters: [ptr(CXCursorT)],
  result: "void",
} as const;

/**
 * Retrieve the file that is included by the given inclusion directive
 * cursor.
 * @param cursor {@link CXCursor}
 */
export const clang_getIncludedFile = {
  parameters: [CXCursorT],
  result: CXFileT,
} as const;

/**
 * Mapping between cursors and source code
 *
 * Cursors represent a location within the Abstract Syntax Tree (AST). These
 * routines help map between cursors and the physical locations where the
 * described entities occur in the source code. The mapping is provided in
 * both directions, so one can map from source code to the AST and back.
 */

/**
 * Map a source location to the cursor that describes the entity at that
 * location in the source code.
 *
 * clang_getCursor() maps an arbitrary source location within a translation
 * unit down to the most specific cursor that describes the entity at that
 * location. For example, given an expression `$1` + y, invoking
 * clang_getCursor() with a source location pointing to "x" will return the
 * cursor for "x"; similarly for "y". If the cursor points anywhere between
 * "x" or "y" (e.g., on the + or the whitespace around it), clang_getCursor()
 * will return a cursor referring to the "+" expression.
 *
 * @returns a cursor representing the entity at the given source location, or
 * a NULL cursor if no such entity can be found.
 */
export const clang_getCursor = {
  parameters: [CXTranslationUnitT, CXSourceLocationT],
  result: CXCursorT,
} as const;

/**
 * Retrieve the physical location of the source constructor referenced
 * by the given cursor.
 *
 * The location of a declaration is typically the location of the name of that
 * declaration, where the name of that declaration would occur if it is
 * unnamed, or some keyword that introduces that particular declaration.
 * The location of a reference is where that reference occurs within the
 * source code.
 */
export const clang_getCursorLocation = {
  parameters: [CXCursorT],
  result: CXSourceLocationT,
} as const;

/**
 * Retrieve the physical extent of the source construct referenced by
 * the given cursor.
 *
 * The extent of a cursor starts with the file/line/column pointing at the
 * first character within the source construct that the cursor refers to and
 * ends with the last character within that source construct. For a
 * declaration, the extent covers the declaration itself. For a reference,
 * the extent covers the location of the reference (e.g., where the referenced
 * entity was actually used).
 */
export const clang_getCursorExtent = {
  parameters: [CXCursorT],
  result: CXSourceRangeT,
} as const;

/**
 * Retrieve the type of a CXCursor (if any).
 * @param C
 */
export const clang_getCursorType = {
  parameters: [CXCursorT],
  result: CXTypeT,
} as const;

/**
 * Pretty-print the underlying type using the rules of the
 * language of the translation unit from which it came.
 *
 * If the type is invalid, an empty string is returned.
 * @param CT
 */
export const clang_getTypeSpelling = {
  parameters: [CXTypeT],
  result: CXString,
} as const;

/**
 * Retrieve the underlying type of a typedef declaration.
 *
 * If the cursor does not reference a typedef declaration, an invalid type is
 * returned.
 * @param C
 */
export const clang_getTypedefDeclUnderlyingType = {
  parameters: [CXCursorT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the integer type of an enum declaration.
 *
 * If the cursor does not reference an enum declaration, an invalid type is
 * returned.
 * @param C
 */
export const clang_getEnumDeclIntegerType = {
  parameters: [CXCursorT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the integer value of an enum constant declaration as a signed
 *  long long.
 *
 * If the cursor does not reference an enum constant declaration, LLONG_MIN is
 * returned. Since this is also potentially a valid constant value, the kind of
 * the cursor must be verified before calling this function.
 * @param C
 */
export const clang_getEnumConstantDeclValue = {
  parameters: [CXCursorT],
  result: longLong,
} as const;

/**
 * Retrieve the integer value of an enum constant declaration as an unsigned
 *  long long.
 *
 * If the cursor does not reference an enum constant declaration, ULLONG_MAX is
 * returned. Since this is also potentially a valid constant value, the kind of
 * the cursor must be verified before calling this function.
 * @param C
 */
export const clang_getEnumConstantDeclUnsignedValue = {
  parameters: [CXCursorT],
  result: unsignedLongLong,
} as const;

/**
 * Retrieve the bit width of a bit field declaration as an integer.
 *
 * If a cursor that is not a bit field declaration is passed in, -1 is returned.
 * @param C
 */
export const clang_getFieldDeclBitWidth = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Retrieve the number of non-variadic arguments associated with a given
 * cursor.
 *
 * The number of arguments can be determined for calls as well as for
 * declarations of functions or methods. For other cursors -1 is returned.
 * @param C
 */
export const clang_Cursor_getNumArguments = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Retrieve the argument cursor of a function or method.
 *
 * The argument cursor can be determined for calls as well as for declarations
 * of functions or methods. For other cursors and for invalid indices, an
 * invalid cursor is returned.
 * @param C
 * @param i
 */
export const clang_Cursor_getArgument = {
  parameters: [CXCursorT, unsigned],
  result: CXCursorT,
} as const;

/**
 * Returns the number of template args of a function, struct, or class decl
 * representing a template specialization.
 *
 * If the argument cursor cannot be converted into a template function
 * declaration, -1 is returned.
 *
 * For example, for the following declaration and specialization:
 *   template <typename T, int kInt, bool kBool>
 *   void foo() { ... }
 *
 *   template <>
 *   void foo<float, -7, true>();
 *
 * The value 3 would be returned from this call.
 * @param C
 */
export const clang_Cursor_getNumTemplateArguments = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Retrieve the kind of the I'th template argument of the CXCursor C.
 *
 * If the argument CXCursor does not represent a FunctionDecl, StructDecl, or
 * ClassTemplatePartialSpecialization, an invalid template argument kind is
 * returned.
 *
 * For example, for the following declaration and specialization:
 *   template <typename T, int kInt, bool kBool>
 *   void foo() { ... }
 *
 *   template <>
 *   void foo<float, -7, true>();
 *
 * For I = 0, 1, and 2, Type, Integral, and Integral will be returned,
 * respectively.
 * @param C
 * @param I
 */
export const clang_Cursor_getTemplateArgumentKind = {
  parameters: [CXCursorT, unsigned],
  result: CXTemplateArgumentKindT,
} as const;

/**
 * Retrieve a CXType representing the type of a TemplateArgument of a
 *  function decl representing a template specialization.
 *
 * If the argument CXCursor does not represent a FunctionDecl, StructDecl,
 * ClassDecl or ClassTemplatePartialSpecialization whose I'th template argument
 * has a kind of CXTemplateArgKind_Integral, an invalid type is returned.
 *
 * For example, for the following declaration and specialization:
 *   template <typename T, int kInt, bool kBool>
 *   void foo() { ... }
 *
 *   template <>
 *   void foo<float, -7, true>();
 *
 * If called with I = 0, "float", will be returned.
 * Invalid types will be returned for I == 1 or 2.
 * @param C
 * @param I
 */
export const clang_Cursor_getTemplateArgumentType = {
  parameters: [CXCursorT, unsigned],
  result: CXTypeT,
} as const;

/**
 * Retrieve the value of an Integral TemplateArgument (of a function
 *  decl representing a template specialization) as a signed long long.
 *
 * It is undefined to call this function on a CXCursor that does not represent a
 * FunctionDecl, StructDecl, ClassDecl or ClassTemplatePartialSpecialization
 * whose I'th template argument is not an integral value.
 *
 * For example, for the following declaration and specialization:
 *   template <typename T, int kInt, bool kBool>
 *   void foo() { ... }
 *
 *   template <>
 *   void foo<float, -7, true>();
 *
 * If called with I = 1 or 2, -7 or true will be returned, respectively.
 * For I == 0, this function's behavior is undefined.
 */
export const clang_Cursor_getTemplateArgumentValue = {
  parameters: [CXCursorT, unsigned],
  result: longLong,
} as const;

/**
 * Retrieve the value of an Integral TemplateArgument (of a function
 *  decl representing a template specialization) as an unsigned long long.
 *
 * It is undefined to call this function on a CXCursor that does not represent a
 * FunctionDecl, StructDecl, ClassDecl or ClassTemplatePartialSpecialization or
 * whose I'th template argument is not an integral value.
 *
 * For example, for the following declaration and specialization:
 *   template <typename T, int kInt, bool kBool>
 *   void foo() { ... }
 *
 *   template <>
 *   void foo<float, 2147483649, true>();
 *
 * If called with I = 1 or 2, 2147483649 or true will be returned, respectively.
 * For I == 0, this function's behavior is undefined.
 */
export const clang_Cursor_getTemplateArgumentUnsignedValue = {
  parameters: [CXCursorT, unsigned],
  result: unsignedLongLong,
} as const;

/**
 * Determine whether two CXTypes represent the same type.
 *
 * \returns non-zero if the CXTypes represent the same type and
 *          zero otherwise.
 */
export const clang_equalTypes = {
  parameters: [CXTypeT, CXTypeT],
  result: unsigned,
} as const;

/**
 * Return the canonical type for a CXType.
 *
 * Clang's type system explicitly models typedefs and all the ways
 * a specific type can be represented.  The canonical type is the underlying
 * type with all the "sugar" removed.  For example, if 'T' is a typedef
 * for 'int', the canonical type for 'T' would be 'int'.
 */
export const clang_getCanonicalType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Determine whether a CXType has the "const" qualifier set,
 * without looking through typedefs that may have added "const" at a
 * different level.
 */
export const clang_isConstQualifiedType = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Determine whether a  CXCursor that is a macro, is
 * function like.
 * @param C
 */
export const clang_Cursor_isMacroFunctionLike = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether a  CXCursor that is a macro, is a
 * builtin one.
 * @param C
 */
export const clang_Cursor_isMacroBuiltin = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether a  CXCursor that is a function declaration, is an
 * inline declaration.
 * @param C
 */
export const clang_Cursor_isFunctionInlined = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether a CXType has the "volatile" qualifier set,
 * without looking through typedefs that may have added "volatile" at
 * a different level.
 */
export const clang_isVolatileQualifiedType = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Determine whether a CXType has the "restrict" qualifier set,
 * without looking through typedefs that may have added "restrict" at a
 * different level.
 */
export const clang_isRestrictQualifiedType = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Returns the address space of the given type.
 */
export const clang_getAddressSpace = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Returns the typedef name of the given type.
 * @param CT
 */
export const clang_getTypedefName = {
  parameters: [CXTypeT],
  result: CXString,
} as const;

/**
 * For pointer types, returns the type of the pointee.
 */
export const clang_getPointeeType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the unqualified variant of the given type, removing as
 * little sugar as possible.
 *
 * For example, given the following series of typedefs:
 *
 * ```c++
 * typedef int Integer;
 * typedef const Integer CInteger;
 * typedef CInteger DifferenceType;
 * ```
 *
 * Executing {@link clang_getUnqualifiedType}() on a {@link CXType} that
 * represents `$1`, will desugar to a type representing
 * `$1`, that has no qualifiers.
 *
 * And, executing {@link clang_getUnqualifiedType}() on the type of the
 * first argument of the following function declaration:
 *
 * ```c++
 * void foo(const int);
 * ```
 *
 * Will return a type representing `$1`, removing the `$1`
 * qualifier.
 *
 * Sugar over array types is not desugared.
 *
 * A type can be checked for qualifiers with {@link clang_isConstQualifiedType}(), {@link clang_isVolatileQualifiedType}()
 * and {@link clang_isRestrictQualifiedType}().
 *
 * A type that resulted from a call to {@link clang_getUnqualifiedType}
 * will return `$1` for all of the above calls.
 * @param CT
 */
const _clang_getUnqualifiedType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * For reference types (e.g., "const int&"), returns the type that the
 * reference refers to (e.g "const int").
 *
 * Otherwise, returns the type itself.
 *
 * A type that has kind {@link CXType_LValueReference} or
 * {@link CXType_RValueReference} is a reference type.
 * @param CT
 */
const _clang_getNonReferenceType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Return the cursor for the declaration of the given type.
 */
export const clang_getTypeDeclaration = {
  parameters: [CXTypeT],
  result: CXCursorT,
} as const;

/**
 * Returns the Objective-C type encoding for the specified declaration.
 * @param C
 */
export const clang_getDeclObjCTypeEncoding = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Returns the Objective-C type encoding for the specified CXType.
 * @param type
 */
export const clang_Type_getObjCEncoding = {
  parameters: [CXTypeT],
  result: CXString,
} as const;

/**
 * Retrieve the spelling of a given CXTypeKind.
 * @param K {@link CXTypeKind}
 */
export const clang_getTypeKindSpelling = {
  parameters: [CXTypeKindT],
  result: CXString,
} as const;

/**
 * Retrieve the calling convention associated with a function type.
 *
 * If a non-function type is passed in, CXCallingConv_Invalid is returned.
 */
export const clang_getFunctionTypeCallingConv = {
  parameters: [CXTypeT],
  result: CXCallingConvT,
} as const;

/**
 * Retrieve the return type associated with a function type.
 *
 * If a non-function type is passed in, an invalid type is returned.
 */
export const clang_getResultType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the exception specification type associated with a function type.
 * This is a value of type CXCursor_ExceptionSpecificationKind.
 *
 * If a non-function type is passed in, an error code of -1 is returned.
 */
export const clang_getExceptionSpecificationType = {
  parameters: [CXTypeT],
  result: CXCursor_ExceptionSpecificationKindT,
} as const;

/**
 * Retrieve the number of non-variadic parameters associated with a
 * function type.
 *
 * If a non-function type is passed in, -1 is returned.
 */
export const clang_getNumArgTypes = {
  parameters: [CXTypeT],
  result: int,
} as const;

/**
 * Retrieve the type of a parameter of a function type.
 *
 * If a non-function type is passed in or the function does not have enough
 * parameters, an invalid type is returned.
 * @param T
 * @param i
 */
export const clang_getArgType = {
  parameters: [CXTypeT, unsigned],
  result: CXTypeT,
} as const;

/**
 * Retrieves the base type of the ObjCObjectType.
 *
 * If the type is not an ObjC object, an invalid type is returned.
 */
export const clang_Type_getObjCObjectBaseType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the number of protocol references associated with an ObjC object/id.
 *
 * If the type is not an ObjC object, 0 is returned.
 */
export const clang_Type_getNumObjCProtocolRefs = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Retrieve the decl for a protocol reference for an ObjC object/id.
 *
 * If the type is not an ObjC object or there are not enough protocol
 * references, an invalid cursor is returned.
 * @param T
 * @param i
 */
export const clang_Type_getObjCProtocolDecl = {
  parameters: [CXTypeT, unsigned],
  result: CXCursorT,
} as const;

/**
 * Retrieve the number of type arguments associated with an ObjC object.
 *
 * If the type is not an ObjC object, 0 is returned.
 */
export const clang_Type_getNumObjCTypeArgs = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Retrieve a type argument associated with an ObjC object.
 *
 * If the type is not an ObjC or the index is not valid,
 * an invalid type is returned.
 * @param T
 * @param i
 */
export const clang_Type_getObjCTypeArg = {
  parameters: [CXTypeT, unsigned],
  result: CXTypeT,
} as const;

/**
 * Return 1 if the CXType is a variadic function type, and 0 otherwise.
 */
export const clang_isFunctionTypeVariadic = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Retrieve the return type associated with a given cursor.
 *
 * This only returns a valid type if the cursor refers to a function or method.
 * @param C
 */
export const clang_getCursorResultType = {
  parameters: [CXCursorT],
  result: CXTypeT,
} as const;

/**
 * Retrieve the exception specification type associated with a given cursor.
 * This is a value of type CXCursor_ExceptionSpecificationKind.
 *
 * This only returns a valid result if the cursor refers to a function or
 * method.
 * @param C
 */
export const clang_getCursorExceptionSpecificationType = {
  parameters: [CXCursorT],
  result: CXCursor_ExceptionSpecificationKindT,
} as const;

/**
 * Return 1 if the CXType is a POD (plain old data) type, and 0
 *  otherwise.
 */
export const clang_isPODType = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Return the element type of an array, complex, or vector type.
 *
 * If a type is passed in that is not an array, complex, or vector type,
 * an invalid type is returned.
 */
export const clang_getElementType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Return the number of elements of an array or vector type.
 *
 * If a type is passed in that is not an array or vector type,
 * -1 is returned.
 */
export const clang_getNumElements = {
  parameters: [CXTypeT],
  result: longLong,
} as const;

/**
 * Return the element type of an array type.
 *
 * If a non-array type is passed in, an invalid type is returned.
 */
export const clang_getArrayElementType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Return the array size of a constant array.
 *
 * If a non-array type is passed in, -1 is returned.
 */
export const clang_getArraySize = {
  parameters: [CXTypeT],
  result: longLong,
} as const;

/**
 * Retrieve the type named by the qualified-id.
 *
 * If a non-elaborated type is passed in, an invalid type is returned.
 */
export const clang_Type_getNamedType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Determine if a typedef is 'transparent' tag.
 *
 * A typedef is considered 'transparent' if it shares a name and spelling
 * location with its underlying tag type, as is the case with the NS_ENUM macro.
 *
 * \returns non-zero if transparent and zero otherwise.
 */
export const clang_Type_isTransparentTagTypedef = {
  parameters: [CXTypeT],
  result: unsigned,
} as const;

/**
 * Retrieve the nullability kind of a pointer type.
 */
export const clang_Type_getNullability = {
  parameters: [CXTypeT],
  result: CXTypeNullabilityKindT,
} as const;

/**
 * Return the alignment of a type in bytes as per C++[expr.alignof]
 *   standard.
 *
 * If the type declaration is invalid, CXTypeLayoutError_Invalid is returned.
 * If the type declaration is an incomplete type, CXTypeLayoutError_Incomplete
 *   is returned.
 * If the type declaration is a dependent type, CXTypeLayoutError_Dependent is
 *   returned.
 * If the type declaration is not a constant size type,
 *   CXTypeLayoutError_NotConstantSize is returned.
 */
export const clang_Type_getAlignOf = {
  parameters: [CXTypeT],
  result: longLong,
} as const;

/**
 * Return the class type of an member pointer type.
 *
 * If a non-member-pointer type is passed in, an invalid type is returned.
 */
export const clang_Type_getClassType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Return the size of a type in bytes as per C++[expr.sizeof] standard.
 *
 * If the type declaration is invalid, CXTypeLayoutError_Invalid is returned.
 * If the type declaration is an incomplete type, CXTypeLayoutError_Incomplete
 *   is returned.
 * If the type declaration is a dependent type, CXTypeLayoutError_Dependent is
 *   returned.
 */
export const clang_Type_getSizeOf = {
  parameters: [CXTypeT],
  result: longLong,
} as const;

/**
 * Return the offset of a field named S in a record of type T in bits
 *   as it would be returned by __offsetof__ as per C++11[18.2p4]
 *
 * If the cursor is not a record field declaration, CXTypeLayoutError_Invalid
 *   is returned.
 * If the field's type declaration is an incomplete type,
 *   CXTypeLayoutError_Incomplete is returned.
 * If the field's type declaration is a dependent type,
 *   CXTypeLayoutError_Dependent is returned.
 * If the field's name S is not found,
 *   CXTypeLayoutError_InvalidFieldName is returned.
 * @param T
 * @param S
 */
export const clang_Type_getOffsetOf = {
  parameters: [CXTypeT, constCharPtr],
  result: longLong,
} as const;

/**
 * Return the type that was modified by this attributed type.
 *
 * If the type is not an attributed type, an invalid type is returned.
 */
export const clang_Type_getModifiedType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Gets the type contained by this atomic type.
 *
 * If a non-atomic type is passed in, an invalid type is returned.
 * @param CT
 */
export const clang_Type_getValueType = {
  parameters: [CXTypeT],
  result: CXTypeT,
} as const;

/**
 * Return the offset of the field represented by the Cursor.
 *
 * If the cursor is not a field declaration, -1 is returned.
 * If the cursor semantic parent is not a record field declaration,
 *   CXTypeLayoutError_Invalid is returned.
 * If the field's type declaration is an incomplete type,
 *   CXTypeLayoutError_Incomplete is returned.
 * If the field's type declaration is a dependent type,
 *   CXTypeLayoutError_Dependent is returned.
 * If the field's name S is not found,
 *   CXTypeLayoutError_InvalidFieldName is returned.
 * @param C
 */
export const clang_Cursor_getOffsetOfField = {
  parameters: [CXCursorT],
  result: longLong,
} as const;

/**
 * Determine whether the given cursor represents an anonymous
 * tag or namespace
 * @param C
 */
export const clang_Cursor_isAnonymous = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor represents an anonymous record
 * declaration.
 * @param C
 */
export const clang_Cursor_isAnonymousRecordDecl = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine whether the given cursor represents an inline namespace
 * declaration.
 * @param C
 */
export const clang_Cursor_isInlineNamespace = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns the number of template arguments for given template
 * specialization, or -1 if type `$1` is not a template specialization.
 */
export const clang_Type_getNumTemplateArguments = {
  parameters: [CXTypeT],
  result: int,
} as const;

/**
 * Returns the type template argument of a template class specialization
 * at given index.
 *
 * This function only returns template type arguments and does not handle
 * template template arguments or variadic packs.
 */
export const clang_Type_getTemplateArgumentAsType = {
  parameters: [CXTypeT, unsigned],
  result: CXTypeT,
} as const;

/**
 * Retrieve the ref-qualifier kind of a function or method.
 *
 * The ref-qualifier is returned for C++ functions or methods. For other types
 * or non-C++ declarations, CXRefQualifier_None is returned.
 */
export const clang_Type_getCXXRefQualifier = {
  parameters: [CXTypeT],
  result: CXRefQualifierKind,
} as const;

/**
 * Returns non-zero if the cursor specifies a Record member that is a
 *   bitfield.
 * @param C
 */
export const clang_Cursor_isBitField = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns 1 if the base class specified by the cursor with kind
 *   CX_CXXBaseSpecifier is virtual.
 */
export const clang_isVirtualBase = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns the access control level for the referenced object.
 *
 * If the cursor refers to a C++ declaration, its access control level within
 * its parent scope is returned. Otherwise, if the cursor refers to a base
 * specifier or access specifier, the specifier itself is returned.
 */
export const clang_getCXXAccessSpecifier = {
  parameters: [CXCursorT],
  result: CX_CXXAccessSpecifierT,
} as const;

/**
 * Returns the storage class for a function or variable declaration.
 *
 * If the passed in Cursor is not a function or variable declaration,
 * CX_SC_Invalid is returned else the storage class.
 */
export const clang_Cursor_getStorageClass = {
  parameters: [CXCursorT],
  result: CX_StorageClassT,
} as const;

/**
 * Determine the number of overloaded declarations referenced by a
 * {@link CXCursor_OverloadedDeclRef} cursor.
 *
 * \param cursor The cursor whose overloaded declarations are being queried.
 *
 * \returns The number of overloaded declarations referenced by `$1`. If it
 * is not a {@link CXCursor_OverloadedDeclRef} cursor, returns 0.
 */
export const clang_getNumOverloadedDecls = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Retrieve a cursor for one of the overloaded declarations referenced
 * by a {@link CXCursor_OverloadedDeclRef} cursor.
 *
 * \param cursor The cursor whose overloaded declarations are being queried.
 *
 * \param index The zero-based index into the set of overloaded declarations in
 * the cursor.
 *
 * \returns A cursor representing the declaration referenced by the given
 * `$1` at the specified `$1`. If the cursor does not have an
 * associated set of overloaded declarations, or if the index is out of bounds,
 * returns {@link clang_getNullCursor}();
 */
export const clang_getOverloadedDecl = {
  parameters: [CXCursorT, unsigned],
  result: CXCursorT,
} as const;

/**
 * Information for attributes
 */

/**
 * For cursors representing an iboutletcollection attribute,
 *  this function returns the collection element type.
 */
export const clang_getIBOutletCollectionType = {
  parameters: [CXCursorT],
  result: CXTypeT,
} as const;

/**
 * Traversing the AST with cursors
 *
 * These routines provide the ability to traverse the abstract syntax tree
 * using cursors.
 */

/**
 * Visit the children of a particular cursor.
 *
 * This function visits all the direct children of the given cursor,
 * invoking the given `visitor` function with the cursors of each
 * visited child. The traversal may be recursive, if the visitor returns
 * {@link CXChildVisit_Recurse}. The traversal may also be ended prematurely, if
 * the visitor returns {@link CXChildVisit_Break}.
 *
 * \param parent the cursor whose child may be visited. All kinds of
 * cursors can be visited, including invalid cursors (which, by
 * definition, have no children).
 *
 * \param visitor the visitor function that will be invoked for each
 * child of `parent`.
 *
 * \param client_data pointer data supplied by the client, which will
 * be passed to the visitor each time it is invoked.
 *
 * \returns a non-zero value if the traversal was terminated
 * prematurely by the visitor returning {@link CXChildVisit_Break}.
 */
export const clang_visitChildren = {
  parameters: [CXCursorT, CXCursorVisitor, CXClientDataT],
  result: unsigned,
} as const;

/**
 * Visits the children of a cursor using the specified block.  Behaves
 * identically to clang_visitChildren() in all other respects.
 * @param parent {@link CXCursor}
 * @param {Deno.UnsafeCallback<CXCursorVisitorBlockCallbackDefinition>} block
 */
export const clang_visitChildrenWithBlock = {
  parameters: [CXCursorT, CXCursorVisitorBlock],
  result: unsigned,
} as const;

/**
 * Cross-referencing in the AST
 *
 * These routines provide the ability to determine references within and
 * across translation units, by providing the names of the entities referenced
 * by cursors, follow reference cursors to the declarations they reference,
 * and associate declarations with their definitions.
 */

/**
 * Retrieve a Unified Symbol Resolution (USR) for the entity referenced
 * by the given cursor.
 *
 * A Unified Symbol Resolution (USR) is a string that identifies a particular
 * entity (function, class, variable, etc.) within a program. USRs can be
 * compared across translation units to determine, e.g., when references in
 * one translation refer to an entity defined in another translation unit.
 */
export const clang_getCursorUSR = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C class.
 * @param class_name
 */
export const clang_constructUSR_ObjCClass = {
  parameters: [constCharPtr],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C category.
 * @param class_name
 * @param category_name
 */
export const clang_constructUSR_ObjCCategory = {
  parameters: [constCharPtr, constCharPtr],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C protocol.
 * @param protocol_name
 */
export const clang_constructUSR_ObjCProtocol = {
  parameters: [constCharPtr],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C instance variable and
 *   the USR for its containing class.
 * @param name
 * @param classUSR
 */
export const clang_constructUSR_ObjCIvar = {
  parameters: [constCharPtr, CXString],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C method and
 *   the USR for its containing class.
 * @param name
 * @param isInstanceMethod
 * @param classUSR
 */
export const clang_constructUSR_ObjCMethod = {
  parameters: [constCharPtr, unsigned, CXString],
  result: CXString,
} as const;

/**
 * Construct a USR for a specified Objective-C property and the USR
 *  for its containing class.
 * @param property
 * @param classUSR
 */
export const clang_constructUSR_ObjCProperty = {
  parameters: [constCharPtr, CXString],
  result: CXString,
} as const;

/**
 * Retrieve a name for the entity referenced by this cursor.
 */
export const clang_getCursorSpelling = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Retrieve a range for a piece that forms the cursors spelling name.
 * Most of the times there is only one range for the complete spelling but for
 * Objective-C methods and Objective-C message expressions, there are multiple
 * pieces for each selector identifier.
 *
 * @param pieceIndex the index of the spelling name piece. If this is greater
 * than the actual number of pieces, it will return a NULL (invalid) range.
 *
 * @param options Reserved.
 */
export const clang_Cursor_getSpellingNameRange = {
  parameters: [CXCursorT, unsigned, unsigned],
  result: CXSourceRangeT,
} as const;

/**
 * Get a property value for the given printing policy.
 * @param Policy
 * @param Property
 */
export const clang_PrintingPolicy_getProperty = {
  parameters: [CXPrintingPolicyT, CXPrintingPolicyPropertyT],
  result: unsigned,
} as const;

/**
 * Set a property value for the given printing policy.
 * @param Policy
 * @param Property
 * @param Value
 */
export const clang_PrintingPolicy_setProperty = {
  parameters: [CXPrintingPolicyT, CXPrintingPolicyPropertyT, unsigned],
  result: "void",
} as const;

/**
 * Retrieve the default policy for the cursor.
 *
 * The policy should be released after use with {@link clang_PrintingPolicy_dispose}.
 */
export const clang_getCursorPrintingPolicy = {
  parameters: [CXCursorT],
  result: CXPrintingPolicyT,
} as const;

/**
 * Release a printing policy.
 * @param Policy
 */
export const clang_PrintingPolicy_dispose = {
  parameters: [CXPrintingPolicyT],
  result: "void",
} as const;

/**
 * Pretty print declarations.
 *
 * @param Cursor The cursor representing a declaration.
 *
 * @param Policy The policy to control the entities being printed. If
 * NULL, a default policy is used.
 *
 * @returns The pretty printed declaration or the empty string for
 * other cursors.
 */
export const clang_getCursorPrettyPrinted = {
  parameters: [CXCursorT, CXPrintingPolicyT],
  result: CXString,
} as const;

/**
 * Retrieve the display name for the entity referenced by this cursor.
 *
 * The display name contains extra information that helps identify the cursor,
 * such as the parameters of a function or template or the arguments of a
 * class template specialization.
 */
export const clang_getCursorDisplayName = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/** For a cursor that is a reference, retrieve a cursor representing the
 * entity that it references.
 *
 * Reference cursors refer to other entities in the AST. For example, an
 * Objective-C superclass reference cursor refers to an Objective-C class.
 * This function produces the cursor for the Objective-C class from the
 * cursor for the superclass reference. If the input cursor is a declaration or
 * definition, it returns that declaration or definition unchanged.
 * Otherwise, returns the NULL cursor.
 */
export const clang_getCursorReferenced = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 *  For a cursor that is either a reference to or a declaration
 *  of some entity, retrieve a cursor that describes the definition of
 *  that entity.
 *
 *  Some entities can be declared multiple times within a translation
 *  unit, but only one of those declarations can also be a
 *  definition. For example, given:
 *
 *  \code
 *  int f(int, int);
 *  int g(int x, int y) { return f(x, y); }
 *  int f(int a, int b) { return a + b; }
 *  int f(int, int);
 *  \endcode
 *
 *  there are three declarations of the function "f", but only the
 *  second one is a definition. The clang_getCursorDefinition()
 *  function will take any cursor pointing to a declaration of "f"
 *  (the first or fourth lines of the example) or a cursor referenced
 *  that uses "f" (the call to "f' inside "g") and will return a
 *  declaration cursor pointing to the definition (the second "f"
 *  declaration).
 *
 *  If given a cursor for which there is no corresponding definition,
 *  e.g., because there is no definition of that entity within this
 *  translation unit, returns a NULL cursor.
 */
export const clang_getCursorDefinition = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * Determine whether the declaration pointed to by this cursor
 * is also a definition of that entity.
 */
export const clang_isCursorDefinition = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Retrieve the canonical cursor corresponding to the given cursor.
 *
 * In the C family of languages, many kinds of entities can be declared several
 * times within a single translation unit. For example, a structure type can
 * be forward-declared (possibly multiple times) and later defined:
 *
 * ```c++
 * struct X;
 * struct X;
 * struct X {
 *   int member;
 * };
 * ```
 *
 * The declarations and the definition of `$1` are represented by three
 * different cursors, all of which are declarations of the same underlying
 * entity. One of these cursor is considered the "canonical" cursor, which
 * is effectively the representative for the underlying entity. One can
 * determine if two cursors are declarations of the same underlying entity by
 * comparing their canonical cursors.
 *
 * @returns The canonical cursor for the entity referred to by the given cursor.
 */
export const clang_getCanonicalCursor = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * If the cursor points to a selector identifier in an Objective-C
 * method or message expression, this returns the selector index.
 *
 * After getting a cursor with #clang_getCursor, this can be called to
 * determine if the location points to a selector identifier.
 *
 * @returns The selector index if the cursor is an Objective-C method or message
 * expression and the cursor is pointing to a selector identifier, or -1
 * otherwise.
 */
export const clang_Cursor_getObjCSelectorIndex = {
  parameters: [CXCursorT],
  result: int,
} as const;

/**
 * Given a cursor pointing to a C++ method call or an Objective-C
 * message, returns non-zero if the method/message is "dynamic", meaning:
 *
 * For a C++ method: the call is virtual.
 * For an Objective-C message: the receiver is an object instance, not 'super'
 * or a specific class.
 *
 * If the method/message is "static" or the cursor does not point to a
 * method/message, it will return zero.
 */
export const clang_Cursor_isDynamicCall = {
  parameters: [CXCursorT],
  result: int,
};

/**
 * Given a cursor pointing to an Objective-C message or property
 * reference, or C++ method call, returns the CXType of the receiver.
 */
export const clang_Cursor_getReceiverType = {
  parameters: [CXCursorT],
  result: CXTypeT,
};

/**
 * Given a cursor that represents a property declaration, return the
 * associated property attributes. The bits are formed from
 * {@link CXObjCPropertyAttrKind}.
 *
 * @param reserved Reserved for future use, pass 0.
 */
export const clang_Cursor_getObjCPropertyAttributes = {
  parameters: [CXCursorT, unsigned],
  result: unsigned,
} as const;

/**
 * Given a cursor that represents a property declaration, return the
 * name of the method that implements the getter.
 */
export const clang_Cursor_getObjCPropertyGetterName = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Given a cursor that represents a property declaration, return the
 * name of the method that implements the setter, if any.
 */
export const clang_Cursor_getObjCPropertySetterName = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Given a cursor that represents an Objective-C method or parameter
 * declaration, return the associated Objective-C qualifiers for the return
 * type or the parameter respectively. The bits are formed from
 * CXObjCDeclQualifierKind.
 */
export const clang_Cursor_getObjCDeclQualifiers = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Given a cursor that represents an Objective-C method or property
 * declaration, return non-zero if the declaration was affected by "\@optional".
 * Returns zero if the cursor is not such a declaration or it is "\@required".
 */
export const clang_Cursor_isObjCOptional = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns non-zero if the given cursor is a variadic function or method.
 */
export const clang_Cursor_isVariadic = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Returns non-zero if the given cursor points to a symbol marked with
 * external_source_symbol attribute.
 *
 * @param Cursor
 *
 * @param language (`CXString *`) If non-NULL, and the attribute is present, will be set to
 * the 'language' string from the attribute.
 *
 * @param definedIn (`CXString *`) If non-NULL, and the attribute is present, will be set to
 * the 'definedIn' string from the attribute.
 *
 * @param isGenerated (`unsigned *`) If non-NULL, and the attribute is present, will be set to
 * non-zero if the 'generated_declaration' is set in the attribute.
 */
export const clang_Cursor_isExternalSymbol = {
  parameters: [CXCursorT, out(CXString), out(CXString), out(unsigned)],
  result: unsigned,
} as const;

/**
 * Given a cursor that represents a declaration, return the associated
 * comment's source range.  The range may include multiple consecutive comments
 * with whitespace in between.
 */
export const clang_Cursor_getCommentRange = {
  parameters: [CXCursorT],
  result: CXSourceRangeT,
} as const;

/**
 * Given a cursor that represents a declaration, return the associated
 * comment text, including comment markers.
 */
export const clang_Cursor_getRawCommentText = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Given a cursor that represents a documentable entity (e.g.,
 * declaration), return the associated \paragraph; otherwise return the
 * first paragraph.
 */
export const clang_Cursor_getBriefCommentText = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/** Name Mangling API Functions
 */

/**
 * Retrieve the CXString representing the mangled name of the cursor.
 */
export const clang_Cursor_getMangling = {
  parameters: [CXCursorT],
  result: CXString,
} as const;

/**
 * Retrieve the CXStrings representing the mangled symbols of the C++
 * constructor or destructor at the cursor.
 * @returns {CXStringSet *}
 */
export const clang_Cursor_getCXXManglings = {
  parameters: [CXCursorT],
  result: CXStringSetT,
} as const;

/**
 * Retrieve the CXStrings representing the mangled symbols of the ObjC
 * class interface or implementation at the cursor.
 * @returns {CXStringSet *}
 */
export const clang_Cursor_getObjCManglings = {
  parameters: [CXCursorT],
  result: CXStringSetT,
} as const;

/**
 * Given a CXCursor_ModuleImportDecl cursor, return the associated module.
 */
export const clang_Cursor_getModule = {
  parameters: [CXCursorT],
  result: CXModule,
} as const;

/**
 * Given a CXFile header file, return the module that contains it, if one
 * exists.
 */
export const clang_getModuleForFile = {
  parameters: [CXTranslationUnitT, CXFileT],
  result: CXModule,
} as const;

/**
 * @param Module a module object.
 *
 * @returns the module file where the provided module object came from.
 */
export const clang_Module_getASTFile = {
  parameters: [CXModule],
  result: CXFileT,
} as const;

/**
 * @param Module a module object.
 *
 * @returns the parent of a sub-module or NULL if the given module is top-level,
 * e.g. for 'std.vector' it will return the 'std' module.
 */
export const clang_Module_getParent = {
  parameters: [CXModule],
  result: CXModule,
} as const;

/**
 * @param Module a module object.
 *
 * @returns the name of the module, e.g. for the 'std.vector' sub-module it
 * will return "vector".
 */
export const clang_Module_getName = {
  parameters: [CXModule],
  result: CXString,
} as const;

/**
 * @param Module a module object.
 *
 * @returns the full name of the module, e.g. "std.vector".
 */
export const clang_Module_getFullName = {
  parameters: [CXModule],
  result: CXString,
} as const;

/**
 * @param Module a module object.
 *
 * @returns non-zero if the module is a system one.
 */
export const clang_Module_isSystem = {
  parameters: [CXModule],
  result: int,
} as const;

/**
 * @param Module a module object.
 *
 * @returns the number of top level headers associated with this module.
 */
export const clang_Module_getNumTopLevelHeaders = {
  parameters: [CXTranslationUnitT, CXModule],
  result: unsigned,
} as const;

/**
 * @param Module a module object.
 *
 * @param Index top level header index (zero-based).
 *
 * @returns the specified top level header associated with the module.
 */
export const clang_Module_getTopLevelHeader = {
  parameters: [CXTranslationUnitT, CXModule, unsigned],
  result: CXFileT,
} as const;

/**
 * C++ AST introspection
 *
 * The routines in this group provide access information in the ASTs specific
 * to C++ language features.
 */

/**
 * Determine if a C++ constructor is a converting constructor.
 */
export const clang_CXXConstructor_isConvertingConstructor = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ constructor is a copy constructor.
 */
export const clang_CXXConstructor_isCopyConstructor = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ constructor is the default constructor.
 */
export const clang_CXXConstructor_isDefaultConstructor = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ constructor is a move constructor.
 */
export const clang_CXXConstructor_isMoveConstructor = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ field is declared 'mutable'.
 */
export const clang_CXXField_isMutable = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ method is declared '= default'.
 */
export const clang_CXXMethod_isDefaulted = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ method is declared '= delete'.
 */
const _clang_CXXMethod_isDeleted = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ member function or member function template is
 * pure virtual.
 */
export const clang_CXXMethod_isPureVirtual = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ member function or member function template is
 * declared 'static'.
 */
export const clang_CXXMethod_isStatic = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ member function or member function template is
 * explicitly declared 'virtual' or if it overrides a virtual method from
 * one of the base classes.
 */
export const clang_CXXMethod_isVirtual = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ member function is a copy-assignment operator,
 * returning 1 if such is the case and 0 otherwise.
 *
 * > A copy-assignment operator `X::operator=` is a non-static,
 * > non-template member function of _class_ `X` with exactly one
 * > parameter of type `X`, `X&`, `const X&`, `volatile X&` or `const
 * > volatile X&`.
 *
 * That is, for example, the `operator=` in:
 *
 *    class Foo {
 *        bool operator=(const volatile Foo&);
 *    };
 *
 * Is a copy-assignment operator, while the `operator=` in:
 *
 *    class Bar {
 *        bool operator=(const int&);
 *    };
 *
 * Is not.
 */
const _clang_CXXMethod_isCopyAssignmentOperator = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ record is abstract, i.e. whether a class or struct
 * has a pure virtual member function.
 */
export const clang_CXXRecord_isAbstract = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if an enum declaration refers to a scoped enum.
 */
export const clang_EnumDecl_isScoped = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Determine if a C++ member function or member function template is
 * declared 'const'.
 */
export const clang_CXXMethod_isConst = {
  parameters: [CXCursorT],
  result: unsigned,
} as const;

/**
 * Given a cursor that represents a template, determine
 * the cursor kind of the specializations would be generated by instantiating
 * the template.
 *
 * This routine can be used to determine what flavor of function template,
 * class template, or class template partial specialization is stored in the
 * cursor. For example, it can describe whether a class template cursor is
 * declared with "struct", "class" or "union".
 *
 * @param C The cursor to query. This cursor should represent a template
 * declaration.
 *
 * @returns The cursor kind of the specializations that would be generated
 * by instantiating the template `C`. If `C` is not a template, returns
 * {@link CXCursor_NoDeclFound}.
 */
export const clang_getTemplateCursorKind = {
  parameters: [CXCursorT],
  result: CXCursorKindT,
} as const;

/**
 * Given a cursor that may represent a specialization or instantiation
 * of a template, retrieve the cursor that represents the template that it
 * specializes or from which it was instantiated.
 *
 * This routine determines the template involved both for explicit
 * specializations of templates and for implicit instantiations of the template,
 * both of which are referred to as "specializations". For a class template
 * specialization (e.g., `$1`, this routine will return
 * either the primary template (`$1` or, if the specialization was
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
 * @param C A cursor that may be a specialization of a template or a member
 * of a template.
 *
 * @returns If the given cursor is a specialization or instantiation of a
 * template or a member thereof, the template or member that it specializes or
 * from which it was instantiated. Otherwise, returns a NULL cursor.
 */
export const clang_getSpecializedCursorTemplate = {
  parameters: [CXCursorT],
  result: CXCursorT,
} as const;

/**
 * Given a cursor that references something else, return the source range
 * covering that reference.
 *
 * @param C A cursor pointing to a member reference, a declaration reference, or
 * an operator call.
 * @param NameFlags A bitset with three independent flags:
 * CXNameRange_WantQualifier, CXNameRange_WantTemplateArgs, and
 * CXNameRange_WantSinglePiece.
 * @param PieceIndex For contiguous names or when passing the flag
 * CXNameRange_WantSinglePiece, only one piece with index 0 is
 * available. When the CXNameRange_WantSinglePiece flag is not passed for a
 * non-contiguous names, this index can be used to retrieve the individual
 * pieces of the name. See also CXNameRange_WantSinglePiece.
 *
 * @returns The piece of the name pointed to by the given cursor. If there is no
 * name, or if the PieceIndex is out-of-range, a null-cursor will be returned.
 */
export const clang_getCursorReferenceNameRange = {
  parameters: [CXCursorT, unsigned, unsigned],
  result: CXSourceRangeT,
} as const;

/**
 * Get the raw lexical token starting with the given location.
 *
 * @param TU the translation unit whose text is being tokenized.
 *
 * @param Location the source location with which the token starts.
 *
 * @returns The token starting with the given location or NULL if no such token
 * exist. The returned pointer must be freed with clang_disposeTokens before the
 * translation unit is destroyed.
 */
export const clang_getToken = {
  parameters: [CXTranslationUnitT, CXSourceLocationT],
  result: ptr(CXToken),
} as const;

/**
 * Determine the kind of the given token.
 */
export const clang_getTokenKind = {
  parameters: [CXToken],
  result: CXTokenKindT,
} as const;

/**
 * Determine the spelling of the given token.
 *
 * The spelling of a token is the textual representation of that token, e.g.,
 * the text of an identifier or keyword.
 */
export const clang_getTokenSpelling = {
  parameters: [CXTranslationUnitT, CXToken],
  result: CXString,
} as const;

/**
 * Retrieve the source location of the given token.
 */
export const clang_getTokenLocation = {
  parameters: [CXTranslationUnitT, CXToken],
  result: CXSourceLocationT,
} as const;

/**
 * Retrieve a source range that covers the given token.
 */
export const clang_getTokenExtent = {
  parameters: [CXTranslationUnitT, CXToken],
  result: CXSourceRangeT,
} as const;

/**
 * Tokenize the source code described by the given range into raw
 * lexical tokens.
 *
 * @param TU the translation unit whose text is being tokenized.
 *
 * @param Range the source range in which text should be tokenized. All of the
 * tokens produced by tokenization will fall within this source range,
 *
 * @param {CXTokens **} Tokens [out] this pointer will be set to point to the array of tokens
 * that occur within the given source range. The returned pointer must be
 * freed with clang_disposeTokens() before the translation unit is destroyed.
 *
 * @param {unsinged *} NumTokens [out] will be set to the number of tokens in the `$1`
 * array.
 */
export const clang_tokenize = {
  parameters: [
    CXTranslationUnitT,
    CXSourceRangeT,
    out(out(CXToken)),
    out(unsigned),
  ],
  result: "void",
} as const;

/**
 * Annotate the given set of tokens by providing cursors for each token
 * that can be mapped to a specific entity within the abstract syntax tree.
 *
 * This token-annotation routine is equivalent to invoking
 * clang_getCursor() for the source locations of each of the
 * tokens. The cursors provided are filtered, so that only those
 * cursors that have a direct correspondence to the token are
 * accepted. For example, given a function call `$1`,
 * clang_getCursor() would provide the following cursors:
 *
 *   * when the cursor is over the 'f', a DeclRefExpr cursor referring to 'f'.
 *   * when the cursor is over the '(' or the ')', a CallExpr referring to 'f'.
 *   * when the cursor is over the 'x', a DeclRefExpr cursor referring to 'x'.
 *
 * Only the first and last of these cursors will occur within the
 * annotate, since the tokens "f" and "x' directly refer to a function
 * and a variable, respectively, but the parentheses are just a small
 * part of the full syntax of the function call expression, which is
 * not provided as an annotation.
 *
 * @param TU the translation unit that owns the given tokens.
 *
 * @param {CXToken *} Tokens the set of tokens to annotate.
 *
 * @param NumTokens the number of tokens in `Tokens`.
 *
 * @param {CXCursor *} Cursors an array of `NumTokens` cursors, whose contents will be
 * replaced with the cursors corresponding to each token.
 */
export const clang_annotateTokens = {
  parameters: [CXTranslationUnitT, CXToken, unsigned, CXCursorT],
  result: "void",
} as const;

/**
 * Free the given set of tokens.
 * @param TU
 *
 * @param {CXToken *} Tokens
 *
 * @param NumTokens
 */
export const clang_disposeTokens = {
  parameters: [CXTranslationUnitT, ptr(CXToken), unsigned],
  result: "void",
} as const;

/**
 * Debugging facilities
 *
 * These routines are used for testing and debugging, only, and should not
 * be relied upon.
 */

/** for debug/testing */
export const clang_getCursorKindSpelling = {
  parameters: [CXCursorKindT],
  result: CXString,
} as const;
export const clang_getDefinitionSpellingAndExtent = {
  parameters: [
    CXCursorT,
    out(constCharPtr),
    out(constCharPtr),
    out(unsigned),
    out(unsigned),
    out(unsigned),
    out(unsigned),
  ],
  result: "void",
} as const;
export const clang_enableStackTraces = {
  parameters: [],
  result: "void",
} as const;
export const clang_executeOnThread = {
  parameters: ["function", ptr("void"), unsigned],
  result: "void",
} as const;

/**
 * Code completion
 *
 * Code completion involves taking an (incomplete) source file, along with
 * knowledge of where the user is actively editing that file, and suggesting
 * syntactically- and semantically-valid constructs that the user might want to
 * use at that particular point in the source code. These data structures and
 * routines provide support for code completion.
 */

/**
 * Determine the kind of a particular chunk within a completion string.
 *
 * @param completion_string the completion string to query.
 *
 * @param chunk_number the 0-based index of the chunk in the completion string.
 *
 * @returns the kind of the chunk at the index `$1`.
 */
export const clang_getCompletionChunkKind = {
  parameters: [CXCompletionString, unsigned],
  result: CXCompletionChunkKindT,
} as const;

/**
 * Retrieve the text associated with a particular chunk within a
 * completion string.
 *
 * @param completion_string the completion string to query.
 *
 * @param chunk_number the 0-based index of the chunk in the completion string.
 *
 * @returns the text associated with the chunk at index `$1`.
 */
export const clang_getCompletionChunkText = {
  parameters: [CXCompletionString, unsigned],
  result: CXString,
} as const;

/**
 * Retrieve the completion string associated with a particular chunk
 * within a completion string.
 *
 * @param completion_string the completion string to query.
 *
 * @param chunk_number the 0-based index of the chunk in the completion string.
 *
 * @returns the completion string associated with the chunk at index
 * `$1`.
 */
export const clang_getCompletionChunkCompletionString = {
  parameters: [CXCompletionString, unsigned],
  result: CXCompletionString,
} as const;

/**
 * Retrieve the number of chunks in the given code-completion string.
 */
export const clang_getNumCompletionChunks = {
  parameters: [CXCompletionString],
  result: unsigned,
} as const;

/**
 * Determine the priority of this code completion.
 *
 * The priority of a code completion indicates how likely it is that this
 * particular completion is the completion that the user will select. The
 * priority is selected by various internal heuristics.
 *
 * @param completion_string The completion string to query.
 *
 * @returns The priority of this completion string. Smaller values indicate
 * higher-priority (more likely) completions.
 */
export const clang_getCompletionPriority = {
  parameters: [CXCompletionString],
  result: unsigned,
} as const;

/**
 * Determine the availability of the entity that this code-completion
 * string refers to.
 *
 * @param completion_string The completion string to query.
 *
 * @returns The availability of the completion string.
 */
export const clang_getCompletionAvailability = {
  parameters: [CXCompletionString],
  result: CXAvailabilityKindT,
} as const;

/**
 * Retrieve the number of annotations associated with the given
 * completion string.
 *
 * @param completion_string the completion string to query.
 *
 * @returns the number of annotations associated with the given completion
 * string.
 */
export const clang_getCompletionNumAnnotations = {
  parameters: [CXCompletionString],
  result: unsigned,
} as const;

/**
 * Retrieve the annotation associated with the given completion string.
 *
 * @param completion_string the completion string to query.
 *
 * @param annotation_number the 0-based index of the annotation of the
 * completion string.
 *
 * @returns annotation string associated with the completion at index
 * `$1`, or a NULL string if that annotation is not available.
 */
export const clang_getCompletionAnnotation = {
  parameters: [CXCompletionString, unsigned],
  result: CXString,
} as const;

/**
 * Retrieve the parent context of the given completion string.
 *
 * The parent context of a completion string is the semantic parent of
 * the declaration (if any) that the code completion represents. For example,
 * a code completion for an Objective-C method would have the method's class
 * or protocol as its context.
 *
 * @param completion_string The code completion string whose parent is
 * being queried.
 *
 * @param kind DEPRECATED: always set to CXCursor_NotImplemented if non-NULL.
 *
 * @returns The name of the completion parent, e.g., "NSObject" if
 * the completion string represents a method in the NSObject class.
 */
export const clang_getCompletionParent = {
  parameters: [CXCompletionString, ptr(CXCursorKindT)],
  result: CXString,
} as const;

/**
 * Retrieve the brief documentation comment attached to the declaration
 * that corresponds to the given completion string.
 */
export const clang_getCompletionBriefComment = {
  parameters: [CXCompletionString],
  result: CXString,
} as const;

/**
 * Retrieve a completion string for an arbitrary declaration or macro
 * definition cursor.
 *
 * @param cursor The cursor to query.
 *
 * @returns A non-context-sensitive completion string for declaration and macro
 * definition cursors, or NULL for other kinds of cursors.
 */
export const clang_getCursorCompletionString = {
  parameters: [CXCursorT],
  result: CXCompletionString,
} as const;

/**
 * Retrieve the number of fix-its for the given completion index.
 *
 * Calling this makes sense only if CXCodeComplete_IncludeCompletionsWithFixIts
 * option was set.
 *
 * @param {CXCodeCompleteResults *} results The structure keeping all completion results
 *
 * @param completion_index The index of the completion
 *
 * \return The number of fix-its which must be applied before the completion at
 * completion_index can be applied
 */
export const clang_getCompletionNumFixIts = {
  parameters: [CXCodeCompleteResults, unsigned],
  result: unsigned,
} as const;

/**
 * Fix-its that *must* be applied before inserting the text for the
 * corresponding completion.
 *
 * By default, clang_codeCompleteAt() only returns completions with empty
 * fix-its. Extra completions with non-empty fix-its should be explicitly
 * requested by setting CXCodeComplete_IncludeCompletionsWithFixIts.
 *
 * For the clients to be able to compute position of the cursor after applying
 * fix-its, the following conditions are guaranteed to hold for
 * replacement_range of the stored fix-its:
 *  - Ranges in the fix-its are guaranteed to never contain the completion
 *  point (or identifier under completion point, if any) inside them, except
 *  at the start or at the end of the range.
 *  - If a fix-it range starts or ends with completion point (or starts or
 *  ends after the identifier under completion point), it will contain at
 *  least one character. It allows to unambiguously recompute completion
 *  point after applying the fix-it.
 *
 * The intuition is that provided fix-its change code around the identifier we
 * complete, but are not allowed to touch the identifier itself or the
 * completion point. One example of completions with corrections are the ones
 * replacing '.' with '->' and vice versa:
 *
 * std::unique_ptr<std::vector<int>> vec_ptr;
 * In 'vec_ptr.^', one of the completions is 'push_back', it requires
 * replacing '.' with '->'.
 * In 'vec_ptr->^', one of the completions is 'release', it requires
 * replacing '->' with '.'.
 *
 * @param {CXCodeCompleteResults *} results The structure keeping all completion results
 *
 * @param completion_index The index of the completion
 *
 * @param fixit_index The index of the fix-it for the completion at
 * completion_index
 *
 * @param {CXSourceRange *} replacement_range The fix-it range that must be replaced before the
 * completion at completion_index can be applied
 *
 * @returns The fix-it string that must replace the code at replacement_range
 * before the completion at completion_index can be applied
 */
export const clang_getCompletionFixIt = {
  parameters: [CXCodeCompleteResults, unsigned, unsigned, CXSourceRangeT],
  result: CXString,
} as const;

/**
 * Returns a default set of code-completion options that can be
 * passed to{@link clang_codeCompleteAt}().
 */
export const clang_defaultCodeCompleteOptions = {
  parameters: [],
  result: unsigned,
} as const;

/**
 * Perform code completion at a given location in a translation unit.
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
 * code-completion location will coincide with the cursor. For example, if `$1`
 * is a pointer, code-completion might be triggered after the "-" and then
 * after the ">" in `$1`. When the code-completion location is after the ">",
 * the completion results will provide, e.g., the members of the struct that
 * "p" points to. The client is responsible for placing the cursor at the
 * beginning of the token currently being typed, then filtering the results
 * based on the contents of the token. For example, when code-completing for
 * the expression `$1`, the client should provide the location just after
 * the ">" (e.g., pointing at the "g") to this code-completion hook. Then, the
 * client can filter the results based on the current token text ("get"), only
 * showing those results that start with "get". The intent of this interface
 * is to separate the relatively high-latency acquisition of code-completion
 * results from the filtering of results on a per-character basis, which must
 * have a lower latency.
 *
 * @param TU The translation unit in which code-completion should
 * occur. The source files for this translation unit need not be
 * completely up-to-date (and the contents of those source files may
 * be overridden via `unsaved_files`). Cursors referring into the
 * translation unit may be invalidated by this invocation.
 *
 * @param complete_filename The name of the source file where code
 * completion should be performed. This filename may be any file
 * included in the translation unit.
 *
 * @param complete_line The line at which code-completion should occur.
 *
 * @param complete_column The column at which code-completion should occur.
 * Note that the column should point just after the syntactic construct that
 * initiated code completion, and not in the middle of a lexical token.
 *
 * @param {struct CXUnsavedFile *} unsaved_files the Files that have not yet been saved to disk
 * but may be required for parsing or code completion, including the
 * contents of those files.  The contents and name of these files (as
 * specified by CXUnsavedFile) are copied when necessary, so the
 * client only needs to guarantee their validity until the call to
 * this function returns.
 *
 * @param num_unsaved_files The number of unsaved file entries in \p
 * unsaved_files.
 *
 * @param options Extra options that control the behavior of code
 * completion, expressed as a bitwise OR of the enumerators of the
 * CXCodeComplete_Flags enumeration. The
 * {@link clang_defaultCodeCompleteOptions}() function returns a default set
 * of code-completion options.
 *
 * @returns {CXCodeCompleteResults *} If successful, a new {@link CXCodeCompleteResults} structure
 * containing code-completion results, which should eventually be
 * freed with {@link clang_disposeCodeCompleteResults}(). If code
 * completion fails, returns NULL.
 */
export const clang_codeCompleteAt = {
  parameters: [
    CXTranslationUnitT,
    constCharPtr,
    unsigned,
    unsigned,
    ptr(CXUnsavedFileT),
    unsigned,
    unsigned,
  ],
  result: ptr(CXCodeCompleteResults),
} as const;

/**
 * Sort the code-completion results in case-insensitive alphabetical
 * order.
 *
 * @param {CXCompletionResult *} Results The set of results to sort.
 * @param NumResults The number of results in `Results`.
 */
export const clang_sortCodeCompletionResults = {
  parameters: [CXCompletionResult, unsigned],
  result: "void",
} as const;

/**
 * Free the given set of code-completion results.
 *
 * @param {CXCodeCompleteResults *} Results
 */
export const clang_disposeCodeCompleteResults = {
  parameters: [CXCodeCompleteResults],
  result: "void",
} as const;

/**
 * Determine the number of diagnostics produced prior to the
 * location where code completion was performed.
 *
 * @param {CXCodeCompleteResults *} Results
 */
export const clang_codeCompleteGetNumDiagnostics = {
  parameters: [CXCodeCompleteResults],
  result: unsigned,
} as const;

/**
 * Retrieve a diagnostic associated with the given code completion.
 *
 * @param {CXCodeCompleteResults *} Results the code completion results to query.
 * @param Index the zero-based diagnostic number to retrieve.
 *
 * @returns the requested diagnostic. This diagnostic must be freed
 * via a call to {@link clang_disposeDiagnostic}().
 */
export const clang_codeCompleteGetDiagnostic = {
  parameters: [CXCodeCompleteResults, unsigned],
  result: CXDiagnosticT,
} as const;

/**
 * Determines what completions are appropriate for the context
 * the given code completion.
 *
 * @param {CXCodeCompleteResults *} Results the code completion results to query.
 *
 * @returns the kinds of completions that are appropriate for use
 * along with the given code completion results.
 */
export const clang_codeCompleteGetContexts = {
  parameters: [CXCodeCompleteResults],
  result: unsignedLongLong,
} as const;

/**
 * Returns the cursor kind for the container for the current code
 * completion context. The container is only guaranteed to be set for
 * contexts where a container exists (i.e. member accesses or Objective-C
 * message sends); if there is not a container, this function will return
 * CXCursor_InvalidCode.
 *
 * @param {CXCodeCompleteResults *} Results the code completion results to query.
 *
 * @param {unsigned *} IsIncomplete on return, this value will be false if Clang has complete
 * information about the container. If Clang does not have complete
 * information, this value will be true.
 *
 * @returns the container kind, or CXCursor_InvalidCode if there is not a
 * container
 */
export const clang_codeCompleteGetContainerKind = {
  parameters: [out(CXCodeCompleteResults), out(unsigned)],
  result: CXCursorKindT,
} as const;

/**
 * Returns the USR for the container for the current code completion
 * context. If there is not a container for the current context, this
 * function will return the empty string.
 *
 * @param {CXCodeCompleteResults *} Results the code completion results to query.
 *
 * @returns the USR for the container
 */
export const clang_codeCompleteGetContainerUSR = {
  parameters: [CXCodeCompleteResults],
  result: CXString,
} as const;

/**
 * Returns the currently-entered selector for an Objective-C message
 * send, formatted like "initWithFoo:bar:". Only guaranteed to return a
 * non-empty string for CXCompletionContext_ObjCInstanceMessage and
 * CXCompletionContext_ObjCClassMessage.
 *
 * @param {CXCodeCompleteResults *} Results the code completion results to query.
 *
 * @returns the selector (or partial selector) that has been entered thus far
 * for an Objective-C message send.
 */
export const clang_codeCompleteGetObjCSelector = {
  parameters: [CXCodeCompleteResults],
  result: CXString,
} as const;

/**
 * Miscellaneous utility functions
 */

/**
 * Return a version string, suitable for showing to a user, but not
 *        intended to be parsed (the format is not guaranteed to be stable).
 */
export const clang_getClangVersion = {
  parameters: [],
  result: CXString,
} as const;

/**
 * Enable/disable crash recovery.
 *
 * @param isEnabled Flag to indicate if crash recovery is enabled.  A non-zero
 *        value enables crash recovery, while 0 disables it.
 */
export const clang_toggleCrashRecovery = {
  parameters: [unsigned],
  result: "void",
} as const;

/**
 * Visit the set of preprocessor inclusions in a translation unit.
 *   The visitor function is called with the provided data for every included
 *   file.  This does not include headers included by the PCH file (unless one
 *   is inspecting the inclusions in the PCH file itself).
 */
export const clang_getInclusions = {
  parameters: [CXTranslationUnitT, CXInclusionVisitor, CXClientDataT],
  result: "void",
} as const;

/**
 * If cursor is a statement declaration tries to evaluate the
 * statement and if its variable, tries to evaluate its initializer,
 * into its corresponding type.
 * If it's an expression, tries to evaluate the expression.
 */
export const clang_Cursor_Evaluate = {
  parameters: [CXCursorT],
  result: CXEvalResult,
} as const;

/**
 * Returns the kind of the evaluated result.
 */
export const clang_EvalResult_getKind = {
  parameters: [CXEvalResult],
  result: CXEvalResultKindT,
} as const;

/**
 * Returns the evaluation result as integer if the
 * kind is Int.
 */
export const clang_EvalResult_getAsInt = {
  parameters: [CXEvalResult],
  result: int,
} as const;

/**
 * Returns the evaluation result as a long long integer if the
 * kind is Int. This prevents overflows that may happen if the result is
 * returned with clang_EvalResult_getAsInt.
 */
export const clang_EvalResult_getAsLongLong = {
  parameters: [CXEvalResult],
  result: longLong,
} as const;

/**
 * Returns a non-zero value if the kind is Int and the evaluation
 * result resulted in an unsigned integer.
 */
export const clang_EvalResult_isUnsignedInt = {
  parameters: [CXEvalResult],
  result: unsigned,
} as const;

/**
 * Returns the evaluation result as an unsigned integer if
 * the kind is Int and clang_EvalResult_isUnsignedInt is non-zero.
 */
export const clang_EvalResult_getAsUnsigned = {
  parameters: [CXEvalResult],
  result: unsignedLongLong,
} as const;

/**
 * Returns the evaluation result as double if the
 * kind is double.
 */
export const clang_EvalResult_getAsDouble = {
  parameters: [CXEvalResult],
  result: double,
} as const;

/**
 * Returns the evaluation result as a constant string if the
 * kind is other than Int or float. User must not free this pointer,
 * instead call clang_EvalResult_dispose on the CXEvalResult returned
 * by clang_Cursor_Evaluate.
 */
export const clang_EvalResult_getAsStr = {
  parameters: [CXEvalResult],
  result: constCharPtr,
} as const;

/**
 * Disposes the created Eval memory.
 */
export const clang_EvalResult_dispose = {
  parameters: [CXEvalResult],
  result: "void",
} as const;

/** Remapping functions
 */

/**
 * Retrieve a remapping.
 *
 * @param path the path that contains metadata about remappings.
 *
 * @returns the requested remapping. This remapping must be freed
 * via a call to {@link clang_remap_dispose}(). Can return NULL if an error occurred.
 */
export const clang_getRemappings = {
  parameters: [constCharPtr],
  result: CXRemapping,
} as const;

/**
 * Retrieve a remapping.
 *
 * @param filePaths pointer to an array of file paths containing remapping info.
 *
 * @param numFiles number of file paths.
 *
 * @returns the requested remapping. This remapping must be freed
 * via a call to {@link clang_remap_dispose}(). Can return NULL if an error occurred.
 */
export const clang_getRemappingsFromFileList = {
  parameters: [constCharPtr, unsigned],
  result: CXRemapping,
} as const;

/**
 * Determine the number of remappings.
 */
export const clang_remap_getNumFiles = {
  parameters: [CXRemapping],
  result: unsigned,
} as const;

/**
 * Get the original and the associated filename from the remapping.
 *
 * @param {CXString *} original If non-NULL, will be set to the original filename.
 *
 * @param {CXString *} transformed If non-NULL, will be set to the filename that the original
 * is associated with.
 */
export const clang_remap_getFilenames = {
  parameters: [CXRemapping, unsigned, CXString, CXString],
  result: "void",
} as const;

/**
 * Dispose the remapping.
 */
export const clang_remap_dispose = {
  parameters: [CXRemapping],
  result: "void",
} as const;

/** Higher level API functions
 */

/**
 * Find references of a declaration in a specific file.
 *
 * @param cursor pointing to a declaration or a reference of one.
 *
 * @param file to search for references.
 *
 * @param visitor callback that will receive pairs of CXCursor/CXSourceRange for
 * each reference found.
 * The CXSourceRange will point inside the file; if the reference is inside
 * a macro (and not a macro argument) the CXSourceRange will be invalid.
 *
 * @returns one of the CXResult enumerators.
 */
export const clang_findReferencesInFile = {
  parameters: [CXCursorT, CXFileT, CXCursorAndRangeVisitor],
  result: CXResultT,
} as const;

/**
 * Find #import/#include directives in a specific file.
 *
 * @param TU translation unit containing the file to query.
 *
 * @param file to search for #import/#include directives.
 *
 * @param visitor callback that will receive pairs of CXCursor/CXSourceRange for
 * each directive found.
 *
 * @returns one of the CXResult enumerators.
 */
export const clang_findIncludesInFile = {
  parameters: [CXTranslationUnitT, CXFileT, CXCursorAndRangeVisitor],
  result: CXResultT,
} as const;

//  #ifdef __has_feature
//  #if __has_feature(blocks)

export const clang_findReferencesInFileWithBlock = {
  parameters: [CXCursorT, CXFileT, CXCursorAndRangeVisitorBlock],
  result: CXResultT,
} as const;

export const clang_findIncludesInFileWithBlock = {
  parameters: [CXTranslationUnitT, CXFileT, CXCursorAndRangeVisitorBlock],
  result: CXResultT,
} as const;

//  #endif
//  #endif

export const clang_index_isEntityObjCContainerKind = {
  parameters: [CXIdxEntityKindT],
  result: int,
} as const;
/**
 * @param {const CXIdxDeclInfo *}
 * @returns {const CXIdxObjCContainerDeclInfo *}
 */
export const clang_index_getObjCContainerDeclInfo = {
  parameters: [buf(CXIdxDeclInfoT)],
  result: ptr(CXIdxObjCContainerDeclInfoT),
} as const;

/**
 * @returns {const CXIdxObjCInterfaceDeclInfo *}
 */
export const clang_index_getObjCInterfaceDeclInfo = {
  parameters: [CXIdxDeclInfoT],
  result: ptr(CXIdxObjCContainerDeclInfoT),
} as const;

/**
 * @returns {const CXIdxObjCCategoryDeclInfo *}
 */
export const clang_index_getObjCCategoryDeclInfo = {
  parameters: [CXIdxDeclInfoT],
  result: ptr(CXIdxObjCContainerDeclInfoT),
} as const;

/**
 * @returns {const CXIdxObjCProtocolRefListInfo *}
 */
export const clang_index_getObjCProtocolRefListInfo = {
  parameters: [CXIdxDeclInfoT],
  result: ptr(CXIdxObjCProtocolRefListInfoT),
} as const;

/**
 * @returns {const CXIdxObjCPropertyDeclInfo *}
 */
export const clang_index_getObjCPropertyDeclInfo = {
  parameters: [CXIdxDeclInfoT],
  result: ptr(CXIdxObjCPropertyDeclInfoT),
} as const;

/**
 * @returns {const CXIdxIBOutletCollectionAttrInfo *}
 */
export const clang_index_getIBOutletCollectionAttrInfo = {
  parameters: [CXIdxAttrInfoT],
  result: ptr(CXIdxIBOutletCollectionAttrInfoT),
} as const;

/**
 * @returns {const CXIdxCXXClassDeclInfo *}
 */
export const clang_index_getCXXClassDeclInfo = {
  parameters: [CXIdxDeclInfoT],
  result: ptr(CXIdxCXXClassDeclInfoT),
} as const;

/**
 * For retrieving a custom CXIdxClientContainer attached to a
 * container.
 * @param {const CXIdxContainerInfo *}
 */
export const clang_index_getClientContainer = {
  parameters: [CXIdxContainerInfoT],
  result: CXIdxClientContainer,
} as const;

/**
 * For setting a custom CXIdxClientContainer attached to a
 * container.
 */
export const clang_index_setClientContainer = {
  parameters: [CXIdxContainerInfoT, CXIdxClientContainer],
  result: "void",
} as const;

/**
 * For retrieving a custom CXIdxClientEntity attached to an entity.
 * @param {const CXIdxEntityInfo *}
 */
export const clang_index_getClientEntity = {
  parameters: [CXIdxEntityInfoT],
  result: CXIdxClientEntity,
} as const;

/**
 * For setting a custom CXIdxClientEntity attached to an entity.
 * @param {const CXIdxEntityInfo *}
 */
export const clang_index_setClientEntity = {
  parameters: [CXIdxEntityInfoT, CXIdxClientEntity],
  result: "void",
} as const;

/**
 * An indexing action/session, to be applied to one or multiple
 * translation units.
 *
 * @param CIdx The index object with which the index action will be associated.
 */
export const clang_IndexAction_create = {
  parameters: [CXIndexT],
  result: CXIndexAction,
} as const;

/**
 * Destroy the given index action.
 *
 * The index action must not be destroyed until all of the translation units
 * created within that index action have been destroyed.
 */
export const clang_IndexAction_dispose = {
  parameters: [CXIndexAction],
  result: "void",
} as const;

/**
 * Index the given source file and the translation unit corresponding
 * to that file via callbacks implemented through #IndexerCallbacks.
 *
 * @param client_data pointer data supplied by the client, which will
 * be passed to the invoked callbacks.
 *
 * @param index_callbacks Pointer to indexing callbacks that the client
 * implements.
 *
 * @param index_callbacks_size Size of #IndexerCallbacks structure that gets
 * passed in index_callbacks.
 *
 * @param index_options A bitmask of options that affects how indexing is
 * performed. This should be a bitwise OR of the CXIndexOpt_XXX flags.
 *
 * @param[out] out_TU pointer to store a {@link CXTranslationUnit} that can be
 * reused after indexing is finished. Set to {@link NULL} if you do not require it.
 *
 * @returns 0 on success or if there were errors from which the compiler could
 * recover.  If there is a failure from which there is no recovery, returns
 * a non-zero {@link CXErrorCode}.
 *
 * The rest of the parameters are the same as #clang_parseTranslationUnit.
 */
export const clang_indexSourceFile = {
  parameters: [
    CXIndexAction,
    CXClientDataT,
    IndexerCallbacks,
    unsigned,
    unsigned,
    constCharPtr,
    buf(constCharPtr),
    int,
    CXUnsavedFileT,
    unsigned,
    CXTranslationUnitT,
    unsigned,
  ],
  result: int,
} as const;

/**
 * Same as clang_indexSourceFile but requires a full command line
 * for `$1` including argv[0]. This is useful if the standard
 * library paths are relative to the binary.
 * @param client_data
 * @param {IndexerCallbacks *} index_callback
 * @param index_callbacks_size
 * @param source_filename
 * @param command_line_arg
 * @param num_command_line_args
 * @param {struct CXUnsavedFile *} unsaved_file
 * @param num_unsaved_files
 * @param {@link CXTranslationUnit} out_TU
 * @param TU_options
 */
export const clang_indexSourceFileFullArgv = {
  parameters: [
    CXIndexAction,
    CXClientDataT,
    buf(IndexerCallbacks),
    unsigned,
    unsigned,
    constCharPtr,
    buf(constCharPtr),
    int,
    CXUnsavedFileT,
    unsigned,
    CXTranslationUnitT,
    unsigned,
  ],
  result: int,
} as const;

/**
 * Index the given translation unit via callbacks implemented through
 * #IndexerCallbacks.
 *
 * The order of callback invocations is not guaranteed to be the same as
 * when indexing a source file. The high level order will be:
 *
 *   -Preprocessor callbacks invocations
 *   -Declaration/reference callbacks invocations
 *   -Diagnostic callback invocations
 *
 * The parameters are the same as #clang_indexSourceFile.
 *
 * @returns If there is a failure from which there is no recovery, returns
 * non-zero, otherwise returns 0.
 */
export const clang_indexTranslationUnit = {
  parameters: [
    CXIndexAction,
    CXClientDataT,
    IndexerCallbacks,
    unsigned,
    unsigned,
    CXTranslationUnitT,
  ],
  result: int,
} as const;

/**
 * Retrieve the CXIdxFile, file, line, column, and offset represented by
 * the given CXIdxLoc.
 *
 * If the location refers into a macro expansion, retrieves the
 * location of the macro expansion and if it refers into a macro argument
 * retrieves the location of the argument.
 */
export const clang_indexLoc_getFileLocation = {
  parameters: [
    CXIdxLoc,
    out(CXIdxClientFile),
    out(CXFileT),
    out(unsigned),
    out(unsigned),
    out(unsigned),
  ],
  result: "void",
} as const;

/**
 * Retrieve the CXSourceLocation represented by the given CXIdxLoc.
 */
export const clang_indexLoc_getCXSourceLocation = {
  parameters: [CXIdxLoc],
  result: CXSourceLocationT,
} as const;

/**
 * Visit the fields of a particular type.
 *
 * This function visits all the direct fields of the given cursor,
 * invoking the given `visitor` function with the cursors of each
 * visited field. The traversal may be ended prematurely, if
 * the visitor returns {@link CXFieldVisit_Break}.
 *
 * @param T the record type whose field may be visited.
 *
 * @param visitor the visitor function that will be invoked for each
 * field of `T`.
 *
 * @param client_data pointer data supplied by the client, which will
 * be passed to the visitor each time it is invoked.
 *
 * @returns a non-zero value if the traversal was terminated
 * prematurely by the visitor returning {@link CXFieldVisit_Break}.
 */
export const clang_Type_visitFields = {
  parameters: [CXTypeT, CXFieldVisitor, CXClientDataT],
  result: unsigned,
} as const;
