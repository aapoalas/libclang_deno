import {
  buf,
  CXFileT,
  CXFileUniqueIDT,
  CXStringT,
  int,
  time_t,
} from "./typeDefinitions.ts";

/**
 * Retrieve the complete file and path name of the given file.
 */
export const clang_getFileName = {
  parameters: [
    CXFileT, // SFile
  ],
  result: CXStringT,
} as const;

/**
 * Retrieve the last modification time of the given file.
 */
export const clang_getFileTime = {
  parameters: [
    CXFileT, // SFile
  ],
  result: time_t,
} as const;

/**
 * Retrieve the unique ID for the given `file.`
 *
 * @param file the file to get the ID for.
 *
 * @param outID stores the returned CXFileUniqueID.
 *
 * @returns If there was a failure getting the unique ID, returns non-zero,
 * otherwise returns 0.
 */
export const clang_getFileUniqueID = {
  parameters: [
    CXFileT, // file
    buf(CXFileUniqueIDT), // outID
  ],
  result: int,
} as const;

/**
 * Returns non-zero if the `file1` and `file2` point to the same file,
 * or they are both NULL.
 */
export const clang_File_isEqual = {
  parameters: [
    CXFileT, // file1
    CXFileT, // file2
  ],
  result: int,
} as const;

/**
 * Returns the real path name of `file.`
 *
 * An empty string may be returned. Use `clang_getFileName(`) in that case.
 */
export const clang_File_tryGetRealPathName = {
  parameters: [
    CXFileT, // file
  ],
  result: CXStringT,
} as const;
