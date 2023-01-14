import { libclang } from "./ffi.ts";
import { cstr, cxstringToString, NULL } from "./utils.ts";

const COMPILATION_DATABASE_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_CompilationDatabase_dispose(pointer));

/**
 * Mapping from source path to source content for a compiler invocation.
 */
export interface SourceMapping {
  /**
   * Source content.
   */
  content: string;
  /**
   * Source path.
   */
  path: string;
}

/**
 * Represents the command line invocation to compile a specific file.
 *
 * When searching for the compile command for a file, the compilation database can
 * return several commands, as the file may have been compiled with
 * different options in different places of the project.
 */
export interface CompileCommand {
  /**
   * Argument values of the compiler invocation.
   *
   * Invariant:
   * - Argument 0 is the compiler executable.
   */
  arguments: string[];
  /**
   * The filename associated with the {@link CompileCommand}.
   */
  filename: string;
  /**
   * The working directory where the {@link CompileCommand} was executed from.
   */
  directory: string;
  /**
   * The source mappings for the compiler invocation.
   */
  sourceMappings: SourceMapping[];
}

/**
 * A compilation database holds all information used to compile files in a
 * project. For each file in the database, it can be queried for the working
 * directory or the command line used for the compiler invocation.
 */
export class CXCompilationDatabase {
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor(buildDirectory: string) {
    const out = new Uint8Array(4);
    this.#pointer = libclang.symbols.clang_CompilationDatabase_fromDirectory(
      cstr(buildDirectory),
      out,
    );
    const errorCode = out[0] || out[1] || out[2] || out[3]; // Small enough that one of these contains the entire code.
    if (this.#pointer === NULL || errorCode) {
      throw new Error(
        `Failed to create CXCompilationDatabase from directory: Could not load database`,
        { cause: errorCode },
      );
    }
    COMPILATION_DATABASE_FINALIZATION_REGISTRY.register(
      this,
      this.#pointer,
      this,
    );
  }

  /**
   * Get all the compile commands in the given compilation database.
   */
  getCompileCommands(): CompileCommand[];
  /**
   * Find the compile commands used for a file.
   */
  getCompileCommands(completeFileName: string): CompileCommand[];
  getCompileCommands(completeFileName?: string): CompileCommand[] {
    const result = completeFileName
      ? libclang.symbols.clang_CompilationDatabase_getCompileCommands(
        this.#pointer,
        cstr(completeFileName),
      )
      : libclang.symbols.clang_CompilationDatabase_getAllCompileCommands(
        this.#pointer,
      );

    const length = libclang.symbols.clang_CompileCommands_getSize(result);
    const compileCommands: CompileCommand[] = [];
    for (let i = 0; i < length; i++) {
      const command = libclang.symbols.clang_CompileCommands_getCommand(
        result,
        i,
      );
      const filename = cxstringToString(
        libclang.symbols.clang_CompileCommand_getFilename(command),
      );
      const directory = cxstringToString(
        libclang.symbols.clang_CompileCommand_getDirectory(command),
      );
      const numberOfMappedSources = libclang.symbols
        .clang_CompileCommand_getNumMappedSources(command);
      const numberOfArguments = libclang.symbols
        .clang_CompileCommand_getNumArgs(command);
      const sourceMappings: SourceMapping[] = [];
      const args: string[] = [];
      let j = 0;
      for (j = 0; j < numberOfMappedSources; j++) {
        sourceMappings.push({
          content: cxstringToString(
            libclang.symbols.clang_CompileCommand_getMappedSourceContent(
              command,
              j,
            ),
          ),
          path: cxstringToString(
            libclang.symbols.clang_CompileCommand_getMappedSourcePath(
              command,
              j,
            ),
          ),
        });
      }
      for (j = 0; j < numberOfArguments; j++) {
        args.push(
          cxstringToString(
            libclang.symbols.clang_CompileCommand_getArg(command, j),
          ),
        );
      }

      compileCommands.push({
        directory,
        filename,
        sourceMappings,
        arguments: args,
      });
    }
    // TODO: It might be that this causes double free when all commands of the database are fetched.
    libclang.symbols.clang_CompileCommands_dispose(result);
    return compileCommands;
  }

  /**
   * Free the given compilation database.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_CompilationDatabase_dispose(this.#pointer);
    COMPILATION_DATABASE_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
