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

let libclang: ReturnType<typeof Deno.dlopen<typeof IMPORTS>>;

if (Deno.build.os === "windows") {
  try {
    if (libclangPath.includes(".dll")) {
      libclang = Deno.dlopen(libclangPath, IMPORTS);
    } else {
      throw null;
    }
  } catch {
    libclang = Deno.dlopen(
      join(libclangPath, "libclang.dll"),
      IMPORTS,
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
  try {
    if (libclangPath.includes(".so")) {
      libclang = Deno.dlopen(libclangPath, IMPORTS);
    } else {
      throw null;
    }
  } catch {
    // Try plain libclang first, then 14.0.6, then 14, and finally try 13.
    try {
      libclang = Deno.dlopen(join(libclangPath, "libclang.so"), IMPORTS);
    } catch {
      try {
        libclang = Deno.dlopen(
          join(libclangPath, "libclang.so.14.0.6"),
          IMPORTS,
        );
      } catch {
        try {
          libclang = Deno.dlopen(
            join(libclangPath, "libclang.so.14"),
            IMPORTS,
          );
        } catch {
          libclang = Deno.dlopen(
            join(libclangPath, "libclang.so.13"),
            IMPORTS,
          );
        }
      }
    }
  }
}

export { libclang };
