import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.170.0/path/mod.ts";
import { format } from "https://deno.land/std@0.170.0/path/win32.ts";
import {
  CXChildVisitResult,
  CXCursorKind,
} from "../lib/include/typeDefinitions.ts";
import * as libclang from "../lib/mod.ts";
import { CXCursor } from "../lib/mod.ts";
import {
  AnyType,
  anyTypeToString,
  commentToJSDcoString,
  FunctionParameter,
  FunctionType,
  toAnyType,
} from "./build_utils.ts";

const formatSync = (filePath: string) => {
  const command = new Deno.Command("deno", {
    args: ["fmt", filePath],
  }).outputSync();
};

const index = new libclang.CXIndex(false, true);

const includeDirectory = join(dirname(fromFileUrl(import.meta.url)), "include");

const includePaths = [
  "-I/usr/lib/clang/14.0.6/include/",
  `-I${includeDirectory}`,
];

const HEADER_FILES = [
  "ExternC.h",
  "FatalErrorHandler.h",
  "Platform.h",
  "CXErrorCode.h",
  "CXString.h",
  "BuildSystem.h",
  "CXCompilationDatabase.h",
  "CXFile.h",
  "CXSourceLocation.h",
  "CXDiagnostic.h",
  "Index.h",
  "Documentation.h",
  "Rewrite.h",
];

const TYPE_MEMORY = new Map<string, AnyType>();

const FUNCTIONS_MAP = new Map<string, FunctionType[]>();

HEADER_FILES.forEach((fileName) => {
  const functions: FunctionType[] = [];
  FUNCTIONS_MAP.set(fileName, functions);
  const fullPathName = join(includeDirectory, "clang-c", fileName);
  const tu = index.parseTranslationUnit(
    fullPathName,
    includePaths,
    [],
  );

  const cursorChildVisitor = (cx: CXCursor) => {
    if (!cx.getLocation().isFromMainFile()) {
      return CXChildVisitResult.CXChildVisit_Continue;
    }
    switch (cx.kind) {
      case CXCursorKind.CXCursor_EnumDecl: {
        let name = cx.getDisplayName();
        if (!name) {
          // Typedef enums have no name and are handled by the typdef case.
          break;
        }
        if (name.startsWith("enum ")) {
          name = name.substring("enum ".length);
        }
        if (!TYPE_MEMORY.has(name)) {
          const type = toAnyType(TYPE_MEMORY, cx.getType());
          TYPE_MEMORY.set(name, type);
        } else if (!name) {
          console.log(cx.getDisplayName());
        }
        break;
      }
      case CXCursorKind.CXCursor_TypedefDecl: {
        const typedefName = cx.getDisplayName();

        if (!TYPE_MEMORY.has(typedefName)) {
          const originalTypeDeclaration = cx
            .getTypedefDeclarationOfUnderlyingType();
          let structDeclAnyType = toAnyType(
            TYPE_MEMORY,
            originalTypeDeclaration,
          );

          if (
            structDeclAnyType.kind === "pointer" &&
            structDeclAnyType.pointee.kind === "function"
          ) {
            // Inject parameter names from cursor
            const parameters = structDeclAnyType.pointee.parameters;
            let i = 0;
            cx.visitChildren((child) => {
              if (child.kind === CXCursorKind.CXCursor_ParmDecl) {
                const parameter = parameters[i++];
                if (!parameter) {
                  throw new Error(
                    "Parameter count mismatch between type and declaration",
                  );
                }
                parameter.name = child.getSpelling() || parameter.name;
              }
              return CXChildVisitResult.CXChildVisit_Continue;
            });
            structDeclAnyType = {
              ...structDeclAnyType.pointee,
              name: typedefName,
              reprName: `${typedefName}T`,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "pointer") {
            structDeclAnyType = {
              ...structDeclAnyType,
              name: typedefName,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "function") {
            // Inject parameter names from cursor
            const parameters = structDeclAnyType.parameters;
            let i = 0;
            cx.visitChildren((child) => {
              if (child.kind === CXCursorKind.CXCursor_ParmDecl) {
                const parameter = parameters[i++];
                if (!parameter) {
                  throw new Error(
                    "Parameter count mismatch between type and declaration",
                  );
                }
                parameter.name = child.getSpelling() || parameter.name;
              }
              return CXChildVisitResult.CXChildVisit_Continue;
            });
            structDeclAnyType = {
              ...structDeclAnyType,
              name: typedefName,
              reprName: `${typedefName}T`,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "plain") {
            structDeclAnyType = {
              ...structDeclAnyType,
              name: typedefName,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "struct") {
            structDeclAnyType = {
              ...structDeclAnyType,
              name: typedefName,
              reprName: `${typedefName}T`,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "enum") {
            structDeclAnyType = {
              ...structDeclAnyType,
              name: typedefName,
              reprName: `${typedefName}T`,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else if (structDeclAnyType.kind === "ref") {
            structDeclAnyType = {
              ...structDeclAnyType,
              comment: commentToJSDcoString(cx.getParsedComment()),
            };
          } else {
            throw new Error("unreachable");
          }
          TYPE_MEMORY.set(typedefName, structDeclAnyType);
        }
        break;
      }
      case CXCursorKind.CXCursor_FunctionDecl: {
        const parameters: FunctionParameter[] = [];
        const resultAnyType = toAnyType(TYPE_MEMORY, cx.getResultType());
        const length = cx.getNumberOfArguments();
        for (let i = 0; i < length; i++) {
          const argument = cx.getArgument(i);
          const argumentAnyType = toAnyType(TYPE_MEMORY, argument.getType());
          parameters.push({
            comment: commentToJSDcoString(argument.getParsedComment()),
            name: argument.getDisplayName(),
            type: argumentAnyType,
          });
          argumentAnyType.comment =
            commentToJSDcoString(argument.getParsedComment()) ||
            argumentAnyType.comment;
        }
        const comment = commentToJSDcoString(cx.getParsedComment());
        const name = cx.getMangling();
        functions.push({
          comment,
          kind: "function",
          name,
          parameters,
          reprName: `${name}T`,
          result: resultAnyType,
        });
        break;
      }
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  };

  tu.getCursor().visitChildren(cursorChildVisitor);
});

const results: string[] = [
  `export const ptr = (_type: unknown) => "pointer" as const;
export const buf = (_type: unknown) => "buffer" as const;
export const func = (_func: unknown) => "function" as const;
/**
 * \`const char *\`, C string
 */
export const cstringT = "buffer" as const;
/**
 * \`char **\`, C string array
 */
export const cstringArrayT = "buffer" as const;
`,
];

for (const [name, anyType] of TYPE_MEMORY) {
  if (anyType.kind === "plain") {
    if (anyType.name === "void") {
      // Cannot declare "void" type
      continue;
    }
    results.push(
      `${
        anyType.comment ? `${anyType.comment}\n` : ""
      }export const ${name} = "${anyType.type}" as const;
`,
    );
  }
}

for (const anyType of TYPE_MEMORY.values()) {
  if (anyType.kind === "enum") {
    results.push(
      `${
        anyType.comment ? `${anyType.comment}\n` : ""
      }export const enum ${anyType.name} {
${
        anyType.values.map((value) =>
          `${
            value.comment ? `  ${value.comment}\n  ` : "  "
          }${value.name} = ${value.value},`
        ).join("\n")
      }
}
${
        anyType.comment
          ? `${anyType.comment}\n`
          : ""
      }export const ${anyType.reprName} = ${anyTypeToString(anyType.type)};
`,
    );
  }
}

for (const [name, anyType] of TYPE_MEMORY) {
  if (anyType.kind === "enum" || anyType.kind === "plain") {
    // Handled above
    continue;
  } else if (anyType.kind === "function") {
    results.push(
      `${
        anyType.comment ? `${anyType.comment}\n` : ""
      }export const ${anyType.name}Declaration = {
  parameters: [
${
        anyType.parameters.map((param) =>
          `${param.comment ? `    ${param.comment}\n    ` : "    "} ${
            anyTypeToString(param.type)
          }, // ${param.name} `
        ).join("\n")
      }
  ],
  result: ${anyTypeToString(anyType.result)},
} as const;
${
        anyType.comment
          ? `${anyType.comment}\n`
          : ""
      }export const ${anyType.reprName} = "function" as const;
`,
    );
  } else if (anyType.kind === "struct") {
    results.push(
      `${
        anyType.comment ? `${anyType.comment}\n` : ""
      }export const ${anyType.reprName} = {
  /** Struct size: ${anyType.size} */
  struct: [
${
        anyType.fields.map((field) => {
          return `${field.comment ? `    ${field.comment}\n    ` : "    "} ${
            anyTypeToString(field.type)
          }, // ${field.name}, offset ${field.offset}, size ${field.size}`;
        }).join("\n")
      }
  ],
} as const;
  `,
    );
  } else if (anyType.kind === "pointer") {
    if (anyType.name.includes(" ") || anyType.name.includes("*")) {
      throw new Error(
        "Unexpected unnamed Pointer type:" + JSON.stringify(anyType),
      );
    }
    results.push(
      `${
        anyType.comment ? `${anyType.comment}\n` : ""
      }export const ${anyType.name}T = ${anyType.useBuffer ? "buf" : "ptr"}(${
        anyTypeToString(anyType.pointee)
      });
`,
    );
  } else if (anyType.kind === "ref") {
    results.push(
      `${anyType.comment ? `${anyType.comment}\n` : ""}export const ${
        name.endsWith("_t") ? name : `${name}T`
      } = ${anyType.name.endsWith("_t") ? anyType.name : anyType.reprName};
`,
    );
  }
}

Deno.writeTextFileSync("out/typeDefinitions.ts", results.join("\n"));
formatSync("./out/typeDefinitions.ts");

const emplaceRefs = (imports: Set<string>, type: AnyType) => {
  if (type.kind === "ref" || type.kind === "enum") {
    imports.add(type.name.endsWith("_t") ? type.name : type.reprName);
  } else if (type.kind === "plain") {
    if (type.type === "void") {
      return;
    }
    imports.add(type.name);
  } else if (type.kind === "struct") {
    imports.add(type.reprName);
  } else if (type.kind === "function") {
    imports.add("func");
    type.parameters.forEach((param) => {
      emplaceRefs(imports, param.type);
    });
    emplaceRefs(imports, type.result);
  } else if (type.kind === "pointer") {
    if (type.useBuffer) {
      imports.add("buf");
    } else {
      imports.add("ptr");
    }
    emplaceRefs(imports, type.pointee);
  }
};

for (const [fileName, apiFunctions] of FUNCTIONS_MAP) {
  const imports = new Set<string>();

  const functionResults: string[] = [];
  for (const { comment, name, parameters, result } of apiFunctions) {
    emplaceRefs(imports, result);
    parameters.forEach((param) => emplaceRefs(imports, param.type));
    functionResults.push(
      `${comment ? `${comment}\n` : ""}export const ${name} = {
  parameters: [${
        parameters.map((param) => anyTypeToString(param.type)).join(", ")
      }],
  result: ${anyTypeToString(result)},
} as const;
`,
    );
  }
  if (imports.size) {
    functionResults.unshift(`import {
${
      [...imports].sort((a, b) => a.localeCompare(b)).map((importName) =>
        `  ${importName},`
      ).join("\n")
    }
} from "./typeDefinitions.ts";
`);
  }
  if (functionResults.length) {
    Deno.writeTextFileSync(`out/${fileName}.ts`, functionResults.join("\n"));
    formatSync(`./out/${fileName}.ts`);
  }
}
