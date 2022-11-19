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

export const libclang = Deno.dlopen(
  "/lib64/libclang.so.13",
  {
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
  } as const,
);
