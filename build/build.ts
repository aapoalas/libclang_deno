import {
  CXChildVisitResult,
  CXCommentInlineCommandRenderKind,
  CXCommentKind,
  CXCursorKind,
  CXTranslationUnit_Flags,
  CXTypeKind,
} from "../lib/include/typeDefinitions.ts";
import * as libclang from "../lib/mod.ts";

const index = new libclang.CXIndex(false, true);

const includePaths = [
  "-I/home/valmet/libclang-deno/include/",
];

const FILE_NAME = "/home/valmet/libclang-deno/include/clang-c/CXString.h";

const tu = index.parseTranslationUnit(
  FILE_NAME,
  [...includePaths],
  [],
);

const typeMappingFunctions = new Map<CXTypeKind, Function>();

typeMappingFunctions.set(CXTypeKind.CXType_Bool, () => "bool");
typeMappingFunctions.set(CXTypeKind.CXType_LongDouble, () => "double");
typeMappingFunctions.set(CXTypeKind.CXType_Double, () => "double");
typeMappingFunctions.set(CXTypeKind.CXType_Float, () => "float");
typeMappingFunctions.set(CXTypeKind.CXType_Int, () => "int");
typeMappingFunctions.set(CXTypeKind.CXType_Short, () => "short");
typeMappingFunctions.set(CXTypeKind.CXType_UShort, () => "ushort");
typeMappingFunctions.set(CXTypeKind.CXType_UInt, () => "uint");
typeMappingFunctions.set(CXTypeKind.CXType_Char_S, () => "char");
typeMappingFunctions.set(CXTypeKind.CXType_SChar, () => "char");
typeMappingFunctions.set(CXTypeKind.CXType_Char_U, () => "uchar");
typeMappingFunctions.set(CXTypeKind.CXType_UChar, () => "uchar");
typeMappingFunctions.set(
  CXTypeKind.CXType_Pointer,
  (pointee: string) => `ptr(${pointee})`,
);

const cursor = tu.getCursor();

console.log(cursor.getKindSpelling(), cursor.getSpelling());

const structDecls: libclang.CXCursor[] = [];

const typedefs: libclang.CXCursor[] = [];

const functions: libclang.CXCursor[] = [];

cursor.visitChildren((cursor, parent) => {
  switch (cursor.kind) {
    case CXCursorKind.CXCursor_StructDecl:
      structDecls.push(cursor);
      break;
    case CXCursorKind.CXCursor_TypedefDecl:
      typedefs.push(cursor);
      break;
    case CXCursorKind.CXCursor_FunctionDecl:
      functions.push(cursor);
      break;
  }
  return CXChildVisitResult.CXChildVisit_Continue;
});

const paragraphToJSDoc = (paragraph: libclang.CXComment): string => {
  const parts: string[] = [" *"];
  paragraph.visitChildren((child) => {
    if (child.kind === CXCommentKind.CXComment_Paragraph) {
      throw new Error("Did not expect recursive paragraphs");
    } else if (child.kind === CXCommentKind.CXComment_Text) {
      parts.push(child.getText());
    } else if (child.kind === CXCommentKind.CXComment_InlineCommand) {
      const style = child.getRenderKind();
      for (let i = 0; i < child.getNumberOfArguments(); i++) {
        const argText = child.getArgumentText(i);
        switch (style) {
          case CXCommentInlineCommandRenderKind
            .CXCommentInlineCommandRenderKind_Normal:
            parts.push(argText);
            break;
          case CXCommentInlineCommandRenderKind
            .CXCommentInlineCommandRenderKind_Bold:
            parts.push(`**${argText}**`);
            break;
          case CXCommentInlineCommandRenderKind
            .CXCommentInlineCommandRenderKind_Monospaced:
            parts.push(`\`${argText}\``);
            break;
          case CXCommentInlineCommandRenderKind
            .CXCommentInlineCommandRenderKind_Emphasized:
            parts.push(`*${argText}*`);
            break;
          default:
            continue;
        }
      }
    }

    return CXChildVisitResult.CXChildVisit_Continue;
  });

  return parts.join("");
};

const commentToJSDcoString = (comment: libclang.CXComment): null | string => {
  if (comment.kind === CXCommentKind.CXComment_Null) {
    return null;
  }
  const lines: string[] = ["/**"];
  comment.visitChildren((child) => {
    if (child.kind === CXCommentKind.CXComment_Text) {
      lines.push(` * ${child.getText()}`);
    } else if (child.kind === CXCommentKind.CXComment_Paragraph) {
      lines.push(paragraphToJSDoc(child));
      lines.push(" *");
    } else if (child.kind === CXCommentKind.CXComment_InlineCommand) {
      throw new Error("Did not expect main level inline command");
    } else {
      console.log(child.getKindSpelling());
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  });
  if (lines.at(-1) === " *") {
    lines.pop();
  }
  lines.push(" */");
  return lines.join("\n");
};

const structMap = new Map<string, any>();

const structData = structDecls.map((struct) => {
  const structType = struct.getType();
  const typeName = structType.getSpelling();
  if (!typeName) {
    throw new Error("Why doesn't it work again?");
  }
  const typeSize = structType.getSizeOf();
  const fields: {
    name: string;
    type: string;
    offset: number;
    comment: string;
  }[] = [];

  struct.visitChildren((cursor) => {
    if (cursor.kind === CXCursorKind.CXCursor_FieldDecl) {
      fields.push({
        name: cursor.getDisplayName(),
        type: cursor.getType().getKindSpelling(),
        offset: cursor.getOffsetOfField() / 8,
        comment: cursor.getRawCommentText(),
      });
    } else {
      console.log("Unknown struct member:", cursor.getKindSpelling());
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  });

  const comment = commentToJSDcoString(struct.getParsedComment());

  return {
    name: `${typeName}T`,
    size: typeSize,
    fields,
    comment,
  };
});

const results = structData.map((x) => {
  return `${x.comment ? `${x.comment}\n` : ""}export const ${x.name} = {
  // Byte size: ${x.size}
  struct: [
${
    x.fields.map((field) => {
      return `${
        field.comment ? `  ${field.comment}\n    ` : "    "
      }/** ${field.name}, offset ${field.offset} */ ${field.type},`;
    }).join("\n")
  }
  ],
} as const;
`;
});

Deno.writeTextFileSync("test_out.ts", results.join("\n"));

// typedefs.map((typedef) =>
//   {
//     const type = typedef.getType();
//     const undertype = typedef.getTypedefDeclarationOfUnderlyingType();
//     console.log(type.getTypedefName(), type.getSpelling());
//     console.log(undertype.getKindSpelling(), undertype.getSpelling());
//     return typedef.visitChildren((cursor) => {
//       return CXChildVisitResult.CXChildVisit_Continue;
//     });
//   }
// );
// functions.map((func) =>
//   func.visitChildren((cursor) => {
//     console.log(cursor.getKindSpelling());
//     return CXChildVisitResult.CXChildVisit_Continue;
//   })
// );
