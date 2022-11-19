import {
  constCharPtr,
  CXString,
  CXStringSetT,
  ptr,
} from "./typeDefinitions.ts";

/**
 * Retrieve the character data associated with the given string.
 * @param string
 * @returns {const char *}
 */
export const clang_getCString = {
  parameters: [CXString],
  result: constCharPtr,
} as const;

/**
 * Free the given string.
 * @param string
 */
export const clang_disposeString = {
  parameters: [CXString],
  result: "void",
} as const;

/**
 * Free the given string set.
 * @param {CXStringSet *} set
 */
export const clang_disposeStringSet = {
  parameters: [ptr(CXStringSetT)],
  result: "void",
} as const;
