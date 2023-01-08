import { libclang } from "./ffi.ts";
import { cstr, cxstringToString, NULL } from "./utils.ts";

const COMPILATION_DATABASE_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_CompilationDatabase_dispose(pointer));

export interface SourceMapping {
  content: string;
  path: string;
}

export interface CompileCommand {
  arguments: string[];
  filename: string;
  directory: string;
  sourceMappings: SourceMapping[];
}

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

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_CompilationDatabase_dispose(this.#pointer);
    COMPILATION_DATABASE_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
