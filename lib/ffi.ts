import * as BuildSystem from "./include/BuildSystem.h.ts";
import * as CXCompilationDatabase from "./include/CXCompilationDatabase.h.ts";
import * as CXDiagnostic from "./include/CXDiagnostic.h.ts";
import * as CXFile from "./include/CXFile.h.ts";
import * as CXSourceLocation from "./include/CXSourceLocation.h.ts";
import * as CXString from "./include/CXString.h.ts";
import * as FatalErrorHandler from "./include/FatalErrorHandler.h.ts";
import * as Index from "./include/Index.h.ts";
import * as Rewrite from "./include/Rewrite.h.ts";

const libclang = Deno.dlopen(
  "/usr/lib/libclang.so.13",
  {
    ...BuildSystem,
    ...CXCompilationDatabase,
    ...CXDiagnostic,
    ...CXFile,
    ...CXSourceLocation,
    ...CXString,
    ...FatalErrorHandler,
    ...Index,
    ...Rewrite,
  } as const,
);
