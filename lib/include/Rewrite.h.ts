import {
  constCharPtr,
  CXRewriter,
  CXSourceLocationT,
  CXSourceRangeT,
  CXTranslationUnitT,
  int,
} from "./typeDefinitions.ts";

/**
 * Create CXRewriter.
 * @param TU
 */
export const clang_CXRewriter_create = {
  parameters: [CXTranslationUnitT],
  result: CXRewriter,
} as const;

/**
 * Insert the specified string at the specified location in the original buffer.
 * @param Rew
 * @param Loc
 * @param Insert CString
 */
export const clang_CXRewriter_insertTextBefore = {
  parameters: [CXRewriter, CXSourceLocationT, constCharPtr],
  result: "void",
} as const;

/**
 * Replace the specified range of characters in the input with the specified
 * replacement.
 * @param Rew
 * @param ToBeReplaced
 * @param Replacement CString
 */
export const clang_CXRewriter_replaceText = {
  parameters: [CXRewriter, CXSourceRangeT, constCharPtr],
  result: "void",
} as const;

/**
 * Remove the specified range.
 * @param Rew
 * @param ToBeRemoved
 */
export const clang_CXRewriter_removeText = {
  parameters: [CXRewriter, CXSourceRangeT],
  result: "void",
} as const;

/**
 * Save all changed files to disk.
 * Returns 1 if any files were not saved successfully, returns 0 otherwise.
 * @param Rew
 */
export const clang_CXRewriter_overwriteChangedFiles = {
  parameters: [CXRewriter],
  result: int,
} as const;

/**
 * Write out rewritten version of the main file to stdout.
 * @param Rew
 */
export const clang_CXRewriter_writeMainFileToStdOut = {
  parameters: [CXRewriter],
  result: "void",
} as const;

/**
 * Free the given CXRewriter.
 * @param Rew
 */
export const clang_CXRewriter_dispose = {
  parameters: [CXRewriter],
  result: "void",
} as const;
