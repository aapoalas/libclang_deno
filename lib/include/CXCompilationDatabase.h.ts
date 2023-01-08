import {
  buf,
  cstringT,
  CXCompilationDatabase_ErrorT,
  CXCompilationDatabaseT,
  CXCompileCommandsT,
  CXCompileCommandT,
  CXStringT,
  unsignedInt,
} from "./typeDefinitions.ts";

/**
 * Creates a compilation database from the database found in directory
 * buildDir. For example, CMake can output a compile_commands.json which can
 * be used to build the database.
 *
 * It must be freed by `clang_CompilationDatabase_dispose.`
 */
export const clang_CompilationDatabase_fromDirectory = {
  parameters: [
    cstringT, // BuildDir
    buf(CXCompilationDatabase_ErrorT), // ErrorCode
  ],
  result: CXCompilationDatabaseT,
} as const;

/**
 * Free the given compilation database
 */
export const clang_CompilationDatabase_dispose = {
  parameters: [
    CXCompilationDatabaseT,
  ],
  result: "void",
} as const;

/**
 * Find the compile commands used for a file. The compile commands
 * must be freed by `clang_CompileCommands_dispose.`
 */
export const clang_CompilationDatabase_getCompileCommands = {
  parameters: [
    CXCompilationDatabaseT,
    cstringT, // CompleteFileName
  ],
  result: CXCompileCommandsT,
} as const;

/**
 * Get all the compile commands in the given compilation database.
 */
export const clang_CompilationDatabase_getAllCompileCommands = {
  parameters: [
    CXCompilationDatabaseT,
  ],
  result: CXCompileCommandsT,
} as const;

/**
 * Free the given CompileCommands
 */
export const clang_CompileCommands_dispose = {
  parameters: [
    CXCompileCommandsT,
  ],
  result: "void",
} as const;

/**
 * Get the number of CompileCommand we have for a file
 */
export const clang_CompileCommands_getSize = {
  parameters: [
    CXCompileCommandsT,
  ],
  result: unsignedInt,
} as const;

/**
 * Get the I'th CompileCommand for a file
 *
 * Note : 0 \<= i \< clang_CompileCommands_getSize(CXCompileCommands)
 */
export const clang_CompileCommands_getCommand = {
  parameters: [
    CXCompileCommandsT,
    unsignedInt, // I
  ],
  result: CXCompileCommandT,
} as const;

/**
 * Get the working directory where the CompileCommand was executed from
 */
export const clang_CompileCommand_getDirectory = {
  parameters: [
    CXCompileCommandT,
  ],
  result: CXStringT,
} as const;

/**
 * Get the filename associated with the CompileCommand.
 */
export const clang_CompileCommand_getFilename = {
  parameters: [
    CXCompileCommandT,
  ],
  result: CXStringT,
} as const;

/**
 * Get the number of arguments in the compiler invocation.
 */
export const clang_CompileCommand_getNumArgs = {
  parameters: [
    CXCompileCommandT,
  ],
  result: unsignedInt,
} as const;

/**
 * Get the I'th argument value in the compiler invocations
 *
 * Invariant :
 * - argument 0 is the compiler executable
 */
export const clang_CompileCommand_getArg = {
  parameters: [
    CXCompileCommandT,
    unsignedInt, // I
  ],
  result: CXStringT,
} as const;

/**
 * Get the number of source mappings for the compiler invocation.
 */
export const clang_CompileCommand_getNumMappedSources = {
  parameters: [
    CXCompileCommandT,
  ],
  result: unsignedInt,
} as const;

/**
 * Get the I'th mapped source path for the compiler invocation.
 */
export const clang_CompileCommand_getMappedSourcePath = {
  parameters: [
    CXCompileCommandT,
    unsignedInt, // I
  ],
  result: CXStringT,
} as const;

/**
 * Get the I'th mapped source content for the compiler invocation.
 */
export const clang_CompileCommand_getMappedSourceContent = {
  parameters: [
    CXCompileCommandT,
    unsignedInt, // I
  ],
  result: CXStringT,
} as const;
