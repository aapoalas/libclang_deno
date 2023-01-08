import {
  cstringT,
  CXRewriterT,
  CXSourceLocationT,
  CXSourceRangeT,
  CXTranslationUnitT,
  int,
} from "./typeDefinitions.ts";

/**
 * Create CXRewriter.
 */
export const clang_CXRewriter_create = {
  parameters: [
    CXTranslationUnitT, // TU
  ],
  result: CXRewriterT,
} as const;

/**
 * Insert the specified string at the specified location in the original buffer.
 */
export const clang_CXRewriter_insertTextBefore = {
  parameters: [
    CXRewriterT, // Rew
    CXSourceLocationT, // Loc
    cstringT, // Insert
  ],
  result: "void",
} as const;

/**
 * Replace the specified range of characters in the input with the specified
 * replacement.
 */
export const clang_CXRewriter_replaceText = {
  parameters: [
    CXRewriterT, // Rew
    CXSourceRangeT, // ToBeReplaced
    cstringT, // Replacement
  ],
  result: "void",
} as const;

/**
 * Remove the specified range.
 */
export const clang_CXRewriter_removeText = {
  parameters: [
    CXRewriterT, // Rew
    CXSourceRangeT, // ToBeRemoved
  ],
  result: "void",
} as const;

/**
 * Save all changed files to disk.
 * Returns 1 if any files were not saved successfully, returns 0 otherwise.
 */
export const clang_CXRewriter_overwriteChangedFiles = {
  parameters: [
    CXRewriterT, // Rew
  ],
  result: int,
} as const;

/**
 * Write out rewritten version of the main file to stdout.
 */
export const clang_CXRewriter_writeMainFileToStdOut = {
  parameters: [
    CXRewriterT, // Rew
  ],
  result: "void",
} as const;

/**
 * Free the given CXRewriter.
 */
export const clang_CXRewriter_dispose = {
  parameters: [
    CXRewriterT, // Rew
  ],
  result: "void",
} as const;
