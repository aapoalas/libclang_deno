import { CXSourceLocationT, CXSourceRangeT } from "./typeDefinitions.ts";

/**
 * Physical source locations
 *
 * Clang represents physical source locations in its abstract syntax tree in
 * great detail, with file, line, and column information for the majority of
 * the tokens parsed in the source code. These data types and functions are
 * used to represent source location information, either for a particular
 * point in the program or for a range of points in the program, and extract
 * specific location information from those data types.
 */

/**
 * Retrieve a NULL (invalid) source location.
 */
export const clang_getNullLocation = {
  parameters: [],
  result: CXSourceLocationT,
} as const;

/**
 * Determine whether two source locations, which must refer into
 * the same translation unit, refer to exactly the same point in the source
 * code.
 *
 * @param loc1
 * @param loc2
 * @returns non-zero if the source locations refer to the same location, zero
 * if they refer to different locations.
 */
export const clang_equalLocations = {
  parameters: [CXSourceLocationT, CXSourceLocationT],
  result: "u32",
} as const;

/**
 * Returns non-zero if the given source location is in a system header.
 * @param location
 */
export const clang_Location_isInSystemHeader = {
  parameters: [CXSourceLocationT],
  result: "i32",
} as const;

/**
 * Returns non-zero if the given source location is in the main file of
 * the corresponding translation unit.
 * @param location
 */
export const clang_Location_isFromMainFile = {
  parameters: [CXSourceLocationT],
  result: "i32",
} as const;

/**
 * Retrieve a NULL (invalid) source range.
 */
export const clang_getNullRange = {
  parameters: [],
  result: CXSourceRangeT,
} as const;

/**
 * Retrieve a source range given the beginning and ending source
 * locations.
 *
 * @param begin
 * @param end
 */
export const clang_getRange = {
  parameters: [CXSourceLocationT, CXSourceLocationT],
  result: CXSourceRangeT,
} as const;

/**
 * Determine whether two ranges are equivalent.
 *
 * @param range1
 * @param range2
 * @returns non-zero if the ranges are the same, zero if they differ.
 */
export const clang_equalRanges = {
  parameters: [CXSourceRangeT, CXSourceRangeT],
  result: "u32",
} as const;

/**
 * Returns non-zero if `range` is null.
 * @param range
 */
export const clang_Range_isNull = {
  parameters: [CXSourceRangeT],
  result: "i32",
} as const;

/**
 * Retrieve the file, line, column, and offset represented by
 * the given source location.
 *
 * If the location refers into a macro expansion, retrieves the
 * location of the macro expansion.
 *
 * @param location the location within a source file that will be decomposed
 * into its parts.
 *
 * @param file [out] (`CXFile*`) if non-NULL, will be set to the file to which the given
 * source location points.
 *
 * @param line [out] (`unsigned *`) if non-NULL, will be set to the line to which the given
 * source location points.
 *
 * @param column [out] (`unsigned *`) if non-NULL, will be set to the column to which the given
 * source location points.
 *
 * @param offset [out] (`unsigned *`) if non-NULL, will be set to the offset into the
 * buffer to which the given source location points.
 */
export const clang_getExpansionLocation = {
  parameters: [
    CXSourceLocationT,
    "buffer",
    "buffer",
    "buffer",
    "buffer",
  ],
  result: "void",
} as const;

/**
 * Retrieve the file, line and column represented by the given source
 * location, as specified in a # line directive.
 *
 * Example: given the following source code in a file somefile.c
 *
 * ```c
 * #123 "dummy.c" 1
 *
 * static int func(void)
 * {
 *     return 0;
 * }
 * ```
 *
 * the location information returned by this function would be
 *
 * File: dummy.c Line: 124 Column: 12
 *
 * whereas clang_getExpansionLocation would have returned
 *
 * File: somefile.c Line: 3 Column: 12
 *
 * @param location the location within a source file that will be decomposed
 * into its parts.
 *
 * @param filename [out] (`CXFile *`) if non-NULL, will be set to the filename of the
 * source location. Note that filenames returned will be for "virtual" files,
 * which don't necessarily exist on the machine running clang - e.g. when
 * parsing preprocessed output obtained from a different environment. If
 * a non-NULL value is passed in, remember to dispose of the returned value
 * using {@link clang_disposeString}() once you've finished with it. For an invalid
 * source location, an empty string is returned.
 *
 * @param line [out] (`unsigned *`) if non-NULL, will be set to the line number of the
 * source location. For an invalid source location, zero is returned.
 *
 * @param column [out] (`unsigned *`) if non-NULL, will be set to the column number of the
 * source location. For an invalid source location, zero is returned.
 */
export const clang_getPresumedLocation = {
  parameters: [
    CXSourceLocationT,
    "buffer",
    "buffer",
    "buffer",
  ],
  result: "void",
} as const;

/**
 * Legacy API to retrieve the file, line, column, and offset represented
 * by the given source location.
 *
 * This interface has been replaced by the newer interface
 * #clang_getExpansionLocation(). See that interface's documentation for
 * details.
 *
 * @param location
 * @param {CXFile *} file
 * @param line
 * @param column
 * @param offset
 */
export const clang_getInstantiationLocation = {
  parameters: [
    CXSourceLocationT,
    "buffer",
    /* `unsigned *` */
    "buffer",
    /* `unsigned *` */
    "buffer",
    /* `unsigned *` */
    "buffer",
  ],
  result: "void",
} as const;

/**
 * Retrieve the file, line, column, and offset represented by
 * the given source location.
 *
 * If the location refers into a macro instantiation, return where the
 * location was originally spelled in the source file.
 *
 * @param location the location within a source file that will be decomposed
 * into its parts.
 *
 * @param file [out] (`CXFile *`) if non-NULL, will be set to the file to which the given
 * source location points.
 *
 * @param line [out] (`unsigned *`) if non-NULL, will be set to the line to which the given
 * source location points.
 *
 * @param column [out] (`unsigned *`) if non-NULL, will be set to the column to which the given
 * source location points.
 *
 * @param offset [out] (`unsigned *`) if non-NULL, will be set to the offset into the
 * buffer to which the given source location points.
 */
export const clang_getSpellingLocation = {
  parameters: [
    CXSourceLocationT,
    "buffer",
    "buffer",
    "buffer",
    "buffer",
  ],
  result: "void",
} as const;

/**
 * Retrieve the file, line, column, and offset represented by
 * the given source location.
 *
 * If the location refers into a macro expansion, return where the macro was
 * expanded or where the macro argument was written, if the location points at
 * a macro argument.
 *
 * @param location the location within a source file that will be decomposed
 * into its parts.
 *
 * @param file [out] (`CXFile *`) if non-NULL, will be set to the file to which the given
 * source location points.
 *
 * @param line [out] (`unsigned *`) if non-NULL, will be set to the line to which the given
 * source location points.
 *
 * @param column [out] (`unsigned *`) if non-NULL, will be set to the column to which the given
 * source location points.
 *
 * @param offset [out] (`unsigned *`) if non-NULL, will be set to the offset into the
 * buffer to which the given source location points.
 */
export const clang_getFileLocation = {
  parameters: [
    CXSourceLocationT,
    "buffer",
    "buffer",
    "buffer",
    "buffer",
  ],
  result: "void",
} as const;

/**
 * Retrieve a source location representing the first character within a
 * source range.
 *
 * @param range
 */
export const clang_getRangeStart = {
  parameters: [CXSourceRangeT],
  result: CXSourceLocationT,
} as const;

/**
 * Retrieve a source location representing the last character within a
 * source range.
 *
 * @param range
 */
export const clang_getRangeEnd = {
  parameters: [CXSourceRangeT],
  result: CXSourceLocationT,
} as const;

/**
 * Destroy the given {@link CXSourceRangeList}.
 * @param ranges (`CXSourceRangeList *`)
 */
export const clang_disposeSourceRangeList = {
  parameters: ["pointer"],
  result: "void",
} as const;
