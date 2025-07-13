import { cstringT, CXStringSetT, CXStringT, ptr } from "./typeDefinitions.ts";

/**
 * Retrieve the character data associated with the given string.
 *
 * The returned data is a reference and not owned by the user. This data
 * is only valid while the `CXString` is valid. This function is similar
 * to `std::string::c_str()`.
 */
export const clang_getCString = {
  parameters: [
    CXStringT, // string
  ],
  result: cstringT,
} as const;

/**
 * Free the given string.
 */
export const clang_disposeString = {
  parameters: [
    CXStringT, // string
  ],
  result: "void",
} as const;

/**
 * Free the given string set.
 */
export const clang_disposeStringSet = {
  parameters: [
    ptr(CXStringSetT), // set
  ],
  result: "void",
} as const;
