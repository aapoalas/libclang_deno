import {
  constCharPtr,
  CXCompilationDatabase,
  CXCompilationDatabase_ErrorT,
  CXCompileCommand,
  CXCompileCommands,
  CXStringT,
  out,
  unsigned,
} from "./typeDefinitions.ts";

/** CompilationDatabase functions
 */

/**
 * Creates a compilation database from the database found in directory
 * buildDir. For example, CMake can output a compile_commands.json which can
 * be used to build the database.
 *
 * It must be freed by {@link clang_CompilationDatabase_dispose}.
 *
 * @param {const char *} BuildDir
 * @param {CXCompilationDatabase_ErrorT *} ErrorCode out pointer
 */
export const clang_CompilationDatabase_fromDirectory = {
  parameters: [constCharPtr, buf(CXCompilationDatabase_ErrorT)],
  result: CXCompilationDatabase,
} as const;

/**
 * Free the given compilation database
 */
export const clang_CompilationDatabase_dispose = {
  parameters: [CXCompilationDatabase],
  result: "void",
} as const;

/**
 * Find the compile commands used for a file. The compile commands
 * must be freed by {@link clang_CompileCommands_dispose}.
 *
 * @param database
 * @param {const char *} CompleteFileName
 */
export const clang_CompilationDatabase_getCompileCommands = {
  parameters: [CXCompilationDatabase, constCharPtr],
  result: CXCompileCommands,
} as const;

/**
 * Get all the compile commands in the given compilation database.
 */
export const clang_CompilationDatabase_getAllCompileCommands = {
  parameters: [CXCompilationDatabase],
  result: CXCompileCommands,
} as const;

/**
 * Free the given CompileCommands
 */
export const clang_CompileCommands_dispose = {
  parameters: [CXCompileCommands],
  result: "void",
} as const;

/**
 * Get the number of CompileCommand we have for a file
 */
export const clang_CompileCommands_getSize = {
  parameters: [CXCompileCommands],
  result: unsigned,
} as const;

/**
 * Get the I'th CompileCommand for a file
 *
 * Note : 0 <= i < clang_CompileCommands_getSize(CXCompileCommands)
 */
export const clang_CompileCommands_getCommand = {
  parameters: [CXCompileCommands, unsigned],
  result: CXCompileCommand,
} as const;

/**
 * Get the working directory where the CompileCommand was executed from
 */
export const clang_CompileCommand_getDirectory = {
  parameters: [CXCompileCommand],
  result: CXStringT,
} as const;

/**
 * Get the filename associated with the CompileCommand.
 */
export const clang_CompileCommand_getFilename = {
  parameters: [CXCompileCommand],
  result: CXStringT,
} as const;

/**
 * Get the number of arguments in the compiler invocation.
 */
export const clang_CompileCommand_getNumArgs = {
  parameters: [CXCompileCommand],
  result: unsigned,
} as const;

/**
 * Get the I'th argument value in the compiler invocations
 *
 * Invariant :
 *  - argument 0 is the compiler executable
 */
export const clang_CompileCommand_getArg = {
  parameters: [CXCompileCommand, unsigned],
  result: CXStringT,
} as const;

/**
 * Get the number of source mappings for the compiler invocation.
 */
export const clang_CompileCommand_getNumMappedSources = {
  parameters: [CXCompileCommand],
  result: unsigned,
} as const;

/**
 * Get the I'th mapped source path for the compiler invocation.
 */
export const clang_CompileCommand_getMappedSourcePath = {
  parameters: [CXCompileCommand, unsigned],
  result: CXStringT,
} as const;

/**
 * Get the I'th mapped source content for the compiler invocation.
 */
export const clang_CompileCommand_getMappedSourceContent = {
  parameters: [CXCompileCommand, unsigned],
  result: CXStringT,
} as const;
