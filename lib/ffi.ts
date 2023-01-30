import { join } from "https://deno.land/std@0.170.0/path/mod.ts";
// is deprecated, but we need to improve error handling
import { existsSync } from "https://deno.land/std@0.170.0/fs/mod.ts";

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
import { winSubset } from "./winSubset.ts";

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

let libclang = null as unknown as ReturnType<typeof Deno.dlopen<typeof IMPORTS>>;

if (Deno.build.os === "windows") {
  const exportSet = new Set(winSubset);
  // drop all the exports that are not in the winSubset and cast to the original type to keep intellisense
  const IMPORTS_WIN = Object.fromEntries(Object.entries(IMPORTS).filter(([key]) => exportSet.has(key))) as typeof IMPORTS
  try {
    if (libclangPath.includes(".dll")) {
      libclang = Deno.dlopen(libclangPath, IMPORTS_WIN);
    } else {
      throw null;
    }
  } catch {
    libclang = Deno.dlopen(
      join(libclangPath, "libclang.dll"),
      IMPORTS_WIN,
    );
  }
} else if (Deno.build.os === "darwin") {
  try {
    if (libclangPath.includes(".dylib")) {
      libclang = Deno.dlopen(libclangPath, IMPORTS);
    } else {
      throw null;
    }
  } catch {
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
    // Try plain libclang first, then 14.0.6, then 14, and finally try 13.
    let LastError: null | Error = null;
    for (const file in ["libclang.so", "libclang.so.14.0.6", "libclang.so.14", "libclang.so.13"]) {
      const fullpath = join(libclangPath, file)
      if (!existsSync(fullpath))
        continue
      try {
        libclang = Deno.dlopen(join(libclangPath, "libclang.so"), IMPORTS);
      } catch (e) {
        LastError = e;
      }
    }
    if (LastError && !libclang) {
      throw LastError;
    }
  }
}

export { libclang };
