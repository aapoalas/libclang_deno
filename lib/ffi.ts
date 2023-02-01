import { join } from "https://deno.land/std@0.170.0/path/mod.ts";
import * as BuildSystem from "./include/BuildSystem.h.ts";
import * as CXCompilationDatabase from "./include/CXCompilationDatabase.h.ts";
import * as CXDiagnostic from "./include/CXDiagnostic.h.ts";
import * as CXFile from "./include/CXFile.h.ts";
import * as CXSourceLocation from "./include/CXSourceLocation.h.ts";
import * as CXString from "./include/CXString.h.ts";
import * as Documentation from "./include/Documentation.h.ts";
import * as FatalErrorHandler from "./include/FatalErrorHandler.h.ts";
import * as Index from "./include/Index.h.ts";
import * as Rewrite from "./include/Rewrite.h.ts";

const IMPORTS = {
  ...BuildSystem,
  ...CXCompilationDatabase,
  ...CXDiagnostic,
  ...CXFile,
  ...CXSourceLocation,
  ...CXString,
  ...Documentation,
  ...FatalErrorHandler,
  ...Index,
  ...Rewrite,
} as const;

const libclangPath = Deno.env.get("LIBCLANG_PATH");

if (!libclangPath) {
  throw new Error(
    "Cannot load libclang without LIBCLANG_PATH environment variable",
  );
}

type ClangSymbols = typeof IMPORTS;

let libclang: ReturnType<
  typeof Deno.dlopen<ClangSymbols>
>;

if (Deno.build.os === "windows") {
  /**
   * Windows DLL does not have error handler related symbols.
   * Windows DLL from `choco install --version 14.0.6 llvm`
   * md5 59beb52cef40898b0f24cdffc6cf2984
   * `dumpbin /exports libclang.dll`
   */
  const IMPORTS_WIN = Object.fromEntries(
    Object.entries(IMPORTS).filter(([symbol]: [string, unknown]) =>
      symbol === "clang_install_aborting_llvm_fatal_error_handler" ||
      symbol === "clang_uninstall_llvm_fatal_error_handler"
    ),
  ) as ClangSymbols;

  if (libclangPath.includes(".dll")) {
    libclang = Deno.dlopen(libclangPath, IMPORTS_WIN);
  } else {
    libclang = Deno.dlopen(
      join(libclangPath, "libclang.dll"),
      IMPORTS_WIN,
    );
  }
} else if (Deno.build.os === "darwin") {
  if (libclangPath.includes(".dylib")) {
    libclang = Deno.dlopen(libclangPath, IMPORTS);
  } else {
    libclang = Deno.dlopen(
      join(libclangPath, "libclang.dylib"),
      IMPORTS,
    );
  }
} else {
  const isFullPath = libclangPath.includes(".so");
  if (isFullPath) {
    // if LIBCLANG_PATH point to a so file, we try to load it directly
    libclang = Deno.dlopen(libclangPath, IMPORTS);
  } else {
    // Try various known libclang shared object names.
    let lastError: null | Error = null;
    for (
      const file of [
        "libclang.so",
        "libclang-14.so.1",
        "libclang.so.14.0.6",
        "libclang.so.14",
        "libclang.so.13",
      ]
    ) {
      const fullpath = join(libclangPath, file);
      try {
        libclang = Deno.dlopen(fullpath, IMPORTS);
      } catch (e) {
        lastError = e;
      }
      break;
    }
    if (lastError && !libclang!) {
      throw lastError;
    }
  }
}

export { libclang };
