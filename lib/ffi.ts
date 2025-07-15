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
import { tryLoadLibclang } from "./baseUtils.ts";

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

export const libclang = tryLoadLibclang(libclangPath, IMPORTS);
