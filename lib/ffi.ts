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
  if (libclangPath.includes(".dll")) {
    libclang = Deno.dlopen(libclangPath, IMPORTS);
  } else {
    libclang = Deno.dlopen(
      join(libclangPath, "libclang.dll"),
      IMPORTS,
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
        "libclang.so.16",
        "libclang.so.16.0.6",
        "libclang-14.so.1",
        "libclang.so.14.0.6",
        "libclang.so.14",
        "libclang.so.13",
      ]
    ) {
      const fullpath = join(libclangPath, file);
      try {
        libclang = Deno.dlopen(fullpath, IMPORTS);
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError && !libclang!) {
      throw lastError;
    }
  }
}

export { libclang };
