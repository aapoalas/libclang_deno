import {
  CXChildVisitResult,
  CXCommentInlineCommandRenderKind,
  CXCommentKind,
  CXCursorKind,
  CXTypeKind,
  CXTypeLayoutError,
  CXVisitorResult,
} from "../lib/include/typeDefinitions.ts";
import { CXComment, type CXType, enableStackTraces } from "../lib/mod.ts";
import { func } from "../out/typeDefinitions.ts";

export interface PlainType {
  kind: "plain";
  name: string;
  type:
    | "void"
    | "bool"
    | "u8"
    | "i8"
    | "u16"
    | "i16"
    | "u32"
    | "i32"
    | "u64"
    | "i64"
    | "f32"
    | "f64"
    | "usize"
    | "isize"
    // Only null pointer appears here
    | "pointer";
  comment: null | string;
}

export interface EnumValue {
  name: string;
  value: number;
  comment: null | string;
}

export interface EnumType {
  kind: "enum";
  name: string;
  reprName: `${string}T`;
  type: AnyType;
  values: EnumValue[];
  comment: null | string;
}

export interface FunctionParameter {
  name: string;
  type: AnyType;
  comment: null | string;
}

export interface FunctionType {
  kind: "function";
  name: string;
  reprName: `${string}T`;
  parameters: FunctionParameter[];
  result: AnyType;
  comment: null | string;
}

export interface StructField {
  name: string;
  type: AnyType;
  size: number;
  offset: number;
  comment: null | string;
}

export interface StructType {
  kind: "struct";
  name: string;
  reprName: `${string}T`;
  fields: StructField[];
  size: number;
  comment: null | string;
}

export interface PointerType {
  kind: "pointer";
  name: string;
  pointee: AnyType;
  comment: null | string;
  useBuffer: boolean;
}

export interface TypeReference {
  kind: "ref";
  name: string;
  reprName: `${string}T`;
  comment: null | string;
}

export type AnyType =
  | PlainType
  | EnumType
  | FunctionType
  | StructType
  | PointerType
  | TypeReference;

export const structFieldToDeinlineString = (
  results: string[],
  struct: StructType,
  field: StructField,
) => {
  if (field.type.kind !== "pointer" || field.type.pointee.kind !== "function") {
    return anyTypeToString(field.type);
  }

  const functionsCount =
    struct.fields.filter((structField) =>
      structField.type.kind === "pointer" &&
      structField.type.pointee.kind === "function"
    ).length;

  const fieldNamePart = functionsCount > 1
    ? `${field.name.replaceAll(/^(\w)|_(\w)/g, (_, m) => m.toUpperCase())}`
    : "";

  // De-inline functions in structs
  const functionName = `${struct.name}${fieldNamePart}CallbackDefinition`;
  results.push(
    `export const ${functionName} = ${
      anyTypeToString(field.type.pointee)
    } as const;`,
  );

  return `func(${
    anyTypeToString({
      kind: "ref",
      comment: null,
      name: functionName,
      // @ts-expect-error Callback definition names do not end with T.
      reprName: functionName,
    })
  })`;
};

export const anyTypeToString = (type: AnyType): string => {
  if (type.kind === "plain") {
    if (type.type === "void") {
      return '"void"';
    }
    return type.name;
  } else if (type.kind === "function") {
    return `{
      /** ${type.name} */
      parameters: [${
      type.parameters.map((param) =>
        `${anyTypeToString(param.type)}, // ${param.name}${
          param.comment ? `, ${param.comment}` : ""
        }`
      ).join("\n")
    }
  ], result: ${anyTypeToString(type.result)}
}`;
  } else if (
    type.kind === "struct" || type.kind === "ref" ||
    type.kind === "enum"
  ) {
    if (type.kind === "ref" && type.name.endsWith("_t")) {
      return type.name;
    }
    return type.reprName;
  } else if (type.kind === "pointer") {
    let func: "buf" | "func" | "ptr" = "ptr";
    if (type.pointee.kind === "function") {
      func = "func";
    } else if (type.useBuffer) {
      func = "buf";
    }
    return `${func}(${anyTypeToString(type.pointee)})`;
  } else {
    throw new Error("Invalid AnyType");
  }
};

export const toAnyType = (
  typeMemory: Map<string, AnyType>,
  type: CXType,
): AnyType => {
  const typekind = type.kind;
  if (typekind === CXTypeKind.CXType_Elaborated) {
    const typeDeclaration = type.getTypeDeclaration();
    if (typeDeclaration.kind === CXCursorKind.CXCursor_EnumDecl) {
      const values: EnumValue[] = [];
      const name = type.getSpelling().substring(5); // drop `enum ` prefix
      if (typeMemory.has(name)) {
        return typeMemory.get(name)!;
      }
      const enumType = typeDeclaration.getEnumDeclarationIntegerType();
      const isUnsignedInt = type.kind === CXTypeKind.CXType_Bool ||
        type.kind === CXTypeKind.CXType_Char_U ||
        type.kind === CXTypeKind.CXType_UChar ||
        type.kind === CXTypeKind.CXType_UShort ||
        type.kind === CXTypeKind.CXType_UInt ||
        type.kind === CXTypeKind.CXType_ULong ||
        type.kind === CXTypeKind.CXType_ULongLong;
      const result: EnumType = {
        kind: "enum",
        name,
        reprName: `${name}T`,
        type: toAnyType(typeMemory, enumType),
        values,
        comment: commentToJSDcoString(typeDeclaration.getParsedComment()),
      };
      typeDeclaration.visitChildren((child) => {
        if (child.kind === CXCursorKind.CXCursor_EnumConstantDecl) {
          values.push({
            comment: commentToJSDcoString(child.getParsedComment()),
            name: child.getSpelling(),
            value: Number(
              isUnsignedInt
                ? child.getEnumConstantDeclarationUnsignedValue()
                : child.getEnumConstantDeclarationValue(),
            ),
          });
        }
        return CXChildVisitResult.CXChildVisit_Continue;
      });
      typeMemory.set(name, result);
      return result;
    } else if (typeDeclaration.kind === CXCursorKind.CXCursor_StructDecl) {
      const structDeclaration = type.getTypeDeclaration();
      const name = type.getSpelling().substring("struct ".length);
      const fields: StructField[] = [];
      const size = type.getSizeOf();
      if (size === CXTypeLayoutError.CXTypeLayoutError_Invalid) {
        throw new Error("Invalid type: " + name);
      } else if (size === CXTypeLayoutError.CXTypeLayoutError_Incomplete) {
        const voidType: PlainType = {
          comment: "/** opaque */",
          kind: "plain",
          name,
          type: "void",
        };
        return voidType;
      }
      const structType: StructType = {
        fields,
        kind: "struct",
        name,
        size,
        reprName: `${name}T`,
        comment: commentToJSDcoString(structDeclaration.getParsedComment()),
      };
      type.visitFields((fieldCursor) => {
        if (fieldCursor.kind !== CXCursorKind.CXCursor_FieldDecl) {
          throw new Error(
            "Unexpected field type: " + fieldCursor.getKindSpelling(),
          );
        }
        const fieldType = fieldCursor.getType();
        if (fieldType.kind === CXTypeKind.CXType_ConstantArray) {
          const length = fieldType.getArraySize();
          const elementType = fieldType.getArrayElementType();
          const baseName = fieldCursor.getDisplayName();
          const baseOffset = fieldCursor.getOffsetOfField() / 8;
          const elementSize = elementType.getSizeOf();
          const comment = commentToJSDcoString(fieldCursor.getParsedComment());
          for (let i = 0; i < length; i++) {
            fields.push({
              name: `${baseName}[${i}]`,
              type: toAnyType(typeMemory, elementType),
              offset: baseOffset + i * elementSize,
              size: elementSize,
              comment: i === 0 ? comment : null,
            });
          }
          return CXVisitorResult.CXVisit_Continue;
        }
        const field: StructField = {
          name: fieldCursor.getDisplayName(),
          type: toAnyType(typeMemory, fieldType),
          offset: fieldCursor.getOffsetOfField() / 8,
          size: fieldType.getSizeOf(),
          comment: commentToJSDcoString(fieldCursor.getParsedComment()),
        };
        fields.push(field);
        return CXVisitorResult.CXVisit_Continue;
      });

      typeMemory.set(name, structType);
      return structType;
    } else {
      throw new Error("Unknown elaborated type");
    }
  } else if (typekind === CXTypeKind.CXType_FunctionProto) {
    const result: FunctionType = {
      comment: commentToJSDcoString(
        type.getTypeDeclaration().getParsedComment(),
      ),
      kind: "function",
      name: type.getSpelling(),
      parameters: [],
      reprName: `${type.getSpelling()}T`,
      result: toAnyType(typeMemory, type.getResultType()),
    };
    const length = type.getNumberOfArgumentTypes();
    for (let i = 0; i < length; i++) {
      const argument = type.getArgumentType(i);
      result.parameters.push({
        comment: null,
        name: argument.getSpelling(),
        type: toAnyType(typeMemory, argument),
      });
    }
    return result;
  } else if (typekind === CXTypeKind.CXType_Pointer) {
    const pointee = type.getPointeeType();

    if (
      pointee.kind === CXTypeKind.CXType_Char_S
    ) {
      // `const char *` or `char *`
      const cstringResult: TypeReference = {
        comment: null,
        kind: "ref",
        name: "cstring",
        reprName: "cstringT",
      };
      return cstringResult;
    } else if (
      pointee.kind === CXTypeKind.CXType_Pointer &&
      pointee.getPointeeType().kind === CXTypeKind.CXType_Char_S
    ) {
      // `const char **` or `char **`
      const cstringArrayResult: TypeReference = {
        comment: null,
        kind: "ref",
        name: "cstringArray",
        reprName: "cstringArrayT",
      };
      return cstringArrayResult;
    }

    const pointeeAnyType = toAnyType(typeMemory, pointee);

    const result: PointerType = {
      kind: "pointer",
      name: type.getSpelling(),
      pointee: pointeeAnyType,
      comment: null,
      useBuffer: pointeeAnyType.kind === "struct" ||
        pointeeAnyType.kind === "plain" && pointeeAnyType.type !== "void" ||
        pointeeAnyType.kind === "ref" || pointeeAnyType.kind === "pointer" ||
        pointeeAnyType.kind === "enum",
    };
    return result;
  } else if (typekind === CXTypeKind.CXType_Typedef) {
    const name = type.getTypedefName();
    const result: TypeReference = {
      kind: "ref",
      name,
      reprName: `${name}T`,
      comment: null,
    };
    if (!typeMemory.has(name)) {
      // Check for potentially needed system header definitions.
      const typedecl = type.getTypeDeclaration();
      const location = typedecl.getLocation();
      if (location.isInSystemHeader()) {
        const sourceType = typedecl.getTypedefDeclarationOfUnderlyingType();
        const sourceAnyType = toAnyType(typeMemory, sourceType);
        typeMemory.set(name, sourceAnyType);
      }
    }
    return result;
  } else if (
    typekind === CXTypeKind.CXType_Enum
  ) {
    const typeDeclaration = type.getTypeDeclaration();
    const values: EnumValue[] = [];
    let name = type.getSpelling();
    if (name.startsWith("enum ")) {
      name = name.substring("enum ".length);
    }
    if (typeMemory.has(name)) {
      return typeMemory.get(name)!;
    }
    const enumType = typeDeclaration.getEnumDeclarationIntegerType();
    const isUnsignedInt = type.kind === CXTypeKind.CXType_Bool ||
      type.kind === CXTypeKind.CXType_Char_U ||
      type.kind === CXTypeKind.CXType_UChar ||
      type.kind === CXTypeKind.CXType_UShort ||
      type.kind === CXTypeKind.CXType_UInt ||
      type.kind === CXTypeKind.CXType_ULong ||
      type.kind === CXTypeKind.CXType_ULongLong;
    const result: EnumType = {
      kind: "enum",
      name,
      reprName: `${name}T`,
      type: toAnyType(typeMemory, enumType),
      values,
      comment: commentToJSDcoString(typeDeclaration.getParsedComment()),
    };
    typeDeclaration.visitChildren((child) => {
      if (child.kind === CXCursorKind.CXCursor_EnumConstantDecl) {
        values.push({
          comment: commentToJSDcoString(child.getParsedComment()),
          name: child.getSpelling(),
          value: Number(
            isUnsignedInt
              ? child.getEnumConstantDeclarationUnsignedValue()
              : child.getEnumConstantDeclarationValue(),
          ),
        });
      }
      return CXChildVisitResult.CXChildVisit_Continue;
    });
    typeMemory.set(name, result);
    return result;
  } else if (
    typekind !== CXTypeKind.CXType_Void &&
    typekind !== CXTypeKind.CXType_Bool &&
    typekind !== CXTypeKind.CXType_Char_U &&
    typekind !== CXTypeKind.CXType_UChar &&
    typekind !== CXTypeKind.CXType_UShort &&
    typekind !== CXTypeKind.CXType_UInt &&
    typekind !== CXTypeKind.CXType_ULong &&
    typekind !== CXTypeKind.CXType_ULongLong &&
    typekind !== CXTypeKind.CXType_Char_S &&
    typekind !== CXTypeKind.CXType_SChar &&
    typekind !== CXTypeKind.CXType_Short &&
    typekind !== CXTypeKind.CXType_Int &&
    typekind !== CXTypeKind.CXType_Long &&
    typekind !== CXTypeKind.CXType_LongLong &&
    typekind !== CXTypeKind.CXType_Float &&
    typekind !== CXTypeKind.CXType_Double &&
    typekind !== CXTypeKind.CXType_NullPtr
  ) {
    throw new Error(
      `Unsupported type kind: ${typekind}, spelling '${type.getSpelling()}', '${type.getKindSpelling()}'`,
    );
  } else {
    const name = toPlainTypeName(type.getSpelling());
    const existing = typeMemory.get(name);
    if (existing) {
      return existing;
    }
    const result: PlainType = {
      kind: "plain",
      name,
      type: getPlainTypeInfo(typekind, type),
      comment: null,
    };
    typeMemory.set(name, result);
    return result;
  }
};

const toPlainTypeName = (spelling: string): string => {
  if (!spelling.includes(" ")) {
    return spelling;
  }
  if (spelling.startsWith("const ")) {
    spelling = spelling.substring("const ".length);
  }
  return spelling.replaceAll(
    /\s+(\w)/g,
    (_m, nextChar: string) => nextChar.toUpperCase(),
  );
};

const getPlainTypeInfo = (
  typekind: CXTypeKind,
  type: CXType,
): PlainType["type"] => {
  if (typekind === CXTypeKind.CXType_Void) {
    return "void";
  } else if (typekind === CXTypeKind.CXType_Bool) {
    return "bool";
  } else if (typekind === CXTypeKind.CXType_Float) {
    if (type.getSizeOf() !== 4) {
      throw new Error(
        `Unexpected Float size: Expected 32, got ${type.getSizeOf() * 8}`,
      );
    }
    return "f32";
  } else if (typekind === CXTypeKind.CXType_Double) {
    if (type.getSizeOf() !== 8) {
      throw new Error(
        `Unexpected Double size: Expected 64, got ${type.getSizeOf() * 8}`,
      );
    }
    return "f64";
  } else if (typekind === CXTypeKind.CXType_NullPtr) {
    return "pointer";
  } else if (
    typekind === CXTypeKind.CXType_Char_U ||
    typekind === CXTypeKind.CXType_UChar ||
    typekind === CXTypeKind.CXType_UShort ||
    typekind === CXTypeKind.CXType_UInt ||
    typekind === CXTypeKind.CXType_ULong ||
    typekind === CXTypeKind.CXType_ULongLong
  ) {
    // Unsigned number, get size.
    const size = type.getSizeOf();
    if (size === 1) {
      return "u8";
    } else if (size === 2) {
      return "u16";
    } else if (size === 4) {
      return "u32";
    } else if (size === 8) {
      return "u64";
    } else {
      throw new Error(`Unexpected ${type.getKindSpelling()} size: Got ${size}`);
    }
  } else if (
    typekind === CXTypeKind.CXType_Char_S ||
    typekind === CXTypeKind.CXType_SChar ||
    typekind === CXTypeKind.CXType_Short ||
    typekind === CXTypeKind.CXType_Int ||
    typekind === CXTypeKind.CXType_Long ||
    typekind === CXTypeKind.CXType_LongLong
  ) {
    // Signed number, get size.
    const size = type.getSizeOf();
    if (size === 1) {
      return "i8";
    } else if (size === 2) {
      return "i16";
    } else if (size === 4) {
      return "i32";
    } else if (size === 8) {
      return "i64";
    } else {
      throw new Error(`Unexpected ${type.getKindSpelling()} size: Got ${size}`);
    }
  } else {
    throw new Error(`Unexpected type kind: ${type.getKindSpelling()}`);
  }
};

const paragraphToJSDoc = (paragraph: CXComment): string => {
  const parts: string[] = [];
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

  const plainText = parts.join("");
  if (plainText.length <= 78) {
    return ` *${plainText}`;
  }
  const lines: string[] = [];
  let previousLinebreakIndex = 0;
  let linebreakIndex = plainText.lastIndexOf(" ", 79);
  do {
    lines.push(
      ` *${plainText.substring(previousLinebreakIndex, linebreakIndex)}`,
    );
    const lastPossibleNextLinebreakIndex = linebreakIndex + 78;
    if (plainText.length < lastPossibleNextLinebreakIndex) {
      lines.push(` *${plainText.substring(linebreakIndex)}`);
      break;
    }
    previousLinebreakIndex = linebreakIndex;
    linebreakIndex = plainText.lastIndexOf(" ", lastPossibleNextLinebreakIndex);
  } while (linebreakIndex !== -1);
  return lines.join("\n");
};

const verbatimBlockCommandToJSDoc = (blockCommand: CXComment): string => {
  // Default to C++ as the comment language: It could be anything really but C++ works for both C and C++ that we're mostly interested in.
  const lines: string[] = [];
  const command = blockCommand.getCommandName();
  if (command === "code") {
    lines.push(" * ```cpp");
  } else if (command === "verbatim") {
    lines.push(" * ```");
  } else {
    throw new Error("Unknown verbatim block command: " + command);
  }
  blockCommand.visitChildren((comment) => {
    if (comment.kind !== CXCommentKind.CXComment_VerbatimBlockLine) {
      throw new Error(
        "Unexpected line in VerbatimBlockCommand: " + comment.getKindSpelling(),
      );
    }
    const commentText = comment.getText();
    if (
      command === "code" && commentText.length > 100 &&
      commentText.includes("\\endcode")
    ) {
      // Over-reaching verbatim block. Skip.
      return CXChildVisitResult.CXChildVisit_Continue;
    }
    lines.push(` *${commentText}`);
    return CXChildVisitResult.CXChildVisit_Continue;
  });
  lines.push(" * ```");
  return lines.join("\n");
};

const blockCommandToJSDoc = (blockCommand: CXComment): string => {
  let command = blockCommand.getCommandName();
  if (command === "return") {
    // Fix failures
    command = "returns";
  }
  const lines: string[] = [` * @${command}`];
  blockCommand.visitChildren((comment) => {
    if (comment.kind === CXCommentKind.CXComment_Paragraph) {
      const previous = lines.pop();
      lines.push(`${previous}${paragraphToJSDoc(comment).substring(2)}`);
    } else {
      throw new Error(
        "Unexpected line in BlockCommand: " + comment.getKindSpelling(),
      );
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  });
  return lines.join("\n");
};

const paramCommandToJSDoc = (paramCommand: CXComment): string => {
  const lines: string[] = [];
  const command = paramCommand.getCommandName();
  const params: string[] = [`@${command}`];
  const paramsCount = paramCommand.getNumberOfArguments();
  for (let i = 0; i < paramsCount; i++) {
    params.push(paramCommand.getArgumentText(i));
  }
  lines.push(` * ${params.join(" ")}`);
  paramCommand.visitChildren((comment) => {
    if (comment.kind === CXCommentKind.CXComment_Paragraph) {
      const previous = lines.pop();
      lines.push(`${previous}${paragraphToJSDoc(comment).substring(2)}`);
    } else {
      throw new Error(
        "Unexpected line in ParamCommand: " + comment.getKindSpelling(),
      );
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  });
  return lines.join("\n");
};

export const commentToJSDcoString = (comment: CXComment): null | string => {
  if (comment.kind === CXCommentKind.CXComment_Null) {
    return null;
  }
  const lines: string[] = ["/**"];
  comment.visitChildren((child) => {
    if (child.kind === CXCommentKind.CXComment_Text) {
      lines.push(` * ${child.getText()}`);
    } else if (child.kind === CXCommentKind.CXComment_Paragraph) {
      const paragraphContent = paragraphToJSDoc(child);
      if (paragraphContent === " *" || paragraphContent === " * ") {
        return CXChildVisitResult.CXChildVisit_Continue;
      }
      lines.push(paragraphContent);
      lines.push(" *");
    } else if (child.kind === CXCommentKind.CXComment_InlineCommand) {
      throw new Error("Did not expect main level inline command");
    } else if (child.kind === CXCommentKind.CXComment_VerbatimLine) {
      const commandName = child.getCommandName();
      if (commandName === "defgroup") {
        return CXChildVisitResult.CXChildVisit_Continue;
      } else {
        // Probably mistaken inline verbatim line.
        const previous = lines.pop();
        lines.push(`${previous}\\\\${commandName} ${child.getText()}`);
      }
    } else if (child.kind === CXCommentKind.CXComment_VerbatimBlockCommand) {
      lines.push(verbatimBlockCommandToJSDoc(child));
    } else if (child.kind === CXCommentKind.CXComment_BlockCommand) {
      lines.push(blockCommandToJSDoc(child));
    } else if (child.kind === CXCommentKind.CXComment_ParamCommand) {
      lines.push(paramCommandToJSDoc(child));
    } else {
      console.log(
        child.getKindSpelling(),
        child.getNumberOfArguments(),
        child.getNumberOfChildren(),
      );
    }
    return CXChildVisitResult.CXChildVisit_Continue;
  });
  if (lines.at(-1) === " *" || lines.at(-1) === " * ") {
    lines.pop();
  }
  lines.push(" */");
  return lines.join("\n");
};
