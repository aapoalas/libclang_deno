import {
  buf,
  cstringT,
  CXAPISetT,
  CXCommentInlineCommandRenderKindT,
  CXCommentKindT,
  CXCommentParamPassDirectionT,
  CXCommentT,
  CXCursorT,
  CXErrorCodeT,
  CXStringT,
  CXTranslationUnitT,
  unsignedInt,
} from "./typeDefinitions.ts";

/**
 * Given a cursor that represents a documentable entity (e.g.,
 * declaration), return the associated parsed comment as a
 * `CXComment_FullComment` AST node.
 */
export const clang_Cursor_getParsedComment = {
  parameters: [
    CXCursorT, // C
  ],
  result: CXCommentT,
} as const;

/**
 * @param Comment AST node of any kind.
 * @returns the type of the AST node.
 */
export const clang_Comment_getKind = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXCommentKindT,
} as const;

/**
 * @param Comment AST node of any kind.
 * @returns number of children of the AST node.
 */
export const clang_Comment_getNumChildren = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment AST node of any kind.
 * @param ChildIdx child index (zero-based).
 * @returns the specified child of the AST node.
 */
export const clang_Comment_getChild = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // ChildIdx
  ],
  result: CXCommentT,
} as const;

/**
 * A `CXComment_Paragraph` node is considered whitespace if it contains
 * only `CXComment_Text` nodes that are empty or whitespace.
 *
 * Other AST nodes (except `CXComment_Paragraph` and `CXComment_Text`) are
 * never considered whitespace.
 *
 * @returns non-zero if `Comment` is whitespace.
 */
export const clang_Comment_isWhitespace = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @returns non-zero if `Comment` is inline content and has a newline
 * immediately following it in the comment text.  Newlines between paragraphs
 * do not count.
 */
export const clang_InlineContentComment_hasTrailingNewline = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_Text` AST node.
 * @returns text contained in the AST node.
 */
export const clang_TextComment_getText = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_InlineCommand` AST node.
 * @returns name of the inline command.
 */
export const clang_InlineCommandComment_getCommandName = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_InlineCommand` AST node.
 * @returns the most appropriate rendering mode, chosen on command
 * semantics in Doxygen.
 */
export const clang_InlineCommandComment_getRenderKind = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXCommentInlineCommandRenderKindT,
} as const;

/**
 * @param Comment a `CXComment_InlineCommand` AST node.
 * @returns number of command arguments.
 */
export const clang_InlineCommandComment_getNumArgs = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_InlineCommand` AST node.
 * @param ArgIdx argument index (zero-based).
 * @returns text of the specified argument.
 */
export const clang_InlineCommandComment_getArgText = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // ArgIdx
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_HTMLStartTag` or `CXComment_HTMLEndTag` AST
 * node.
 * @returns HTML tag name.
 */
export const clang_HTMLTagComment_getTagName = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_HTMLStartTag` AST node.
 * @returns non-zero if tag is self-closing (for example, \<br /\>).
 */
export const clang_HTMLStartTagComment_isSelfClosing = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_HTMLStartTag` AST node.
 * @returns number of attributes (name-value pairs) attached to the start tag.
 */
export const clang_HTMLStartTag_getNumAttrs = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_HTMLStartTag` AST node.
 * @param AttrIdx attribute index (zero-based).
 * @returns name of the specified attribute.
 */
export const clang_HTMLStartTag_getAttrName = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // AttrIdx
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_HTMLStartTag` AST node.
 * @param AttrIdx attribute index (zero-based).
 * @returns value of the specified attribute.
 */
export const clang_HTMLStartTag_getAttrValue = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // AttrIdx
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_BlockCommand` AST node.
 * @returns name of the block command.
 */
export const clang_BlockCommandComment_getCommandName = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_BlockCommand` AST node.
 * @returns number of word-like arguments.
 */
export const clang_BlockCommandComment_getNumArgs = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_BlockCommand` AST node.
 * @param ArgIdx argument index (zero-based).
 * @returns text of the specified word-like argument.
 */
export const clang_BlockCommandComment_getArgText = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // ArgIdx
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_BlockCommand` or
 * `CXComment_VerbatimBlockCommand` AST node.
 * @returns paragraph argument of the block command.
 */
export const clang_BlockCommandComment_getParagraph = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXCommentT,
} as const;

/**
 * @param Comment a `CXComment_ParamCommand` AST node.
 * @returns parameter name.
 */
export const clang_ParamCommandComment_getParamName = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_ParamCommand` AST node.
 * @returns non-zero if the parameter that this AST node represents was found
 * in the function prototype and `clang_ParamCommandComment_getParamIndex` function will return a meaningful value.
 */
export const clang_ParamCommandComment_isParamIndexValid = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_ParamCommand` AST node.
 * @returns zero-based parameter index in function prototype.
 */
export const clang_ParamCommandComment_getParamIndex = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_ParamCommand` AST node.
 * @returns non-zero if parameter passing direction was specified explicitly in
 * the comment.
 */
export const clang_ParamCommandComment_isDirectionExplicit = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_ParamCommand` AST node.
 * @returns parameter passing direction.
 */
export const clang_ParamCommandComment_getDirection = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXCommentParamPassDirectionT,
} as const;

/**
 * @param Comment a `CXComment_TParamCommand` AST node.
 * @returns template parameter name.
 */
export const clang_TParamCommandComment_getParamName = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_TParamCommand` AST node.
 * @returns non-zero if the parameter that this AST node represents was found
 * in the template parameter list and
 * `clang_TParamCommandComment_getDepth` and
 * `clang_TParamCommandComment_getIndex` functions will return a meaningful
 * value.
 */
export const clang_TParamCommandComment_isParamPositionValid = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_TParamCommand` AST node.
 * @returns zero-based nesting depth of this parameter in the template parameter
 * list.
 *
 * For example,
 *
 * ```
 *     template<typename C, template<typename T> class TT>
 *     void test(TT<int> aaa);
 * ```
 * for C and TT nesting depth is 0,
 * for T nesting depth is 1.
 */
export const clang_TParamCommandComment_getDepth = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_TParamCommand` AST node.
 * @returns zero-based parameter index in the template parameter list at a
 * given nesting depth.
 *
 * For example,
 *
 * ```
 *     template<typename C, template<typename T> class TT>
 *     void test(TT<int> aaa);
 * ```
 * for C and TT nesting depth is 0, so we can ask for index at depth 0:
 * at depth 0 C's index is 0, TT's index is 1.
 *
 * For T nesting depth is 1, so we can ask for index at depth 0 and 1:
 * at depth 0 T's index is 1 (same as TT's),
 * at depth 1 T's index is 0.
 */
export const clang_TParamCommandComment_getIndex = {
  parameters: [
    CXCommentT, // Comment
    unsignedInt, // Depth
  ],
  result: unsignedInt,
} as const;

/**
 * @param Comment a `CXComment_VerbatimBlockLine` AST node.
 * @returns text contained in the AST node.
 */
export const clang_VerbatimBlockLineComment_getText = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * @param Comment a `CXComment_VerbatimLine` AST node.
 * @returns text contained in the AST node.
 */
export const clang_VerbatimLineComment_getText = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * Convert an HTML tag AST node to string.
 *
 * @param Comment a `CXComment_HTMLStartTag` or `CXComment_HTMLEndTag` AST
 * node.
 * @returns string containing an HTML tag.
 */
export const clang_HTMLTagComment_getAsString = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * Convert a given full parsed comment to an HTML fragment.
 *
 * Specific details of HTML layout are subject to change. Don't try to parse
 * this HTML back into an AST, use other APIs instead.
 *
 * Currently the following CSS classes are used:
 *
 * @li "para-brief" for
 * \\paragraph  and equivalent commands;
 * @li "para-returns" for \\returns paragraph and equivalent commands;
 *
 * @li "word-returns" for the "Returns" word in \\returns paragraph.
 *
 * Function argument documentation is rendered as a list with arguments
 * sorted in function prototype order. CSS classes used:
 *
 * @li "param-name-index-NUMBER" for parameter name ();
 *
 * @li "param-descr-index-NUMBER" for parameter description ();
 *
 * @li "param-name-index-invalid" and "param-descr-index-invalid" are used if
 * parameter index is invalid.
 *
 * Template parameter documentation is rendered as a list with
 * parameters sorted in template parameter list order. CSS classes used:
 *
 * @li "tparam-name-index-NUMBER" for parameter name ();
 *
 * @li "tparam-descr-index-NUMBER" for parameter description ();
 *
 * @li "tparam-name-index-other" and "tparam-descr-index-other" are used for
 * names inside template template parameters;
 *
 * @li "tparam-name-index-invalid" and "tparam-descr-index-invalid" are used if
 * parameter position is invalid.
 *
 * @param Comment a `CXComment_FullComment` AST node.
 * @returns string containing an HTML fragment.
 */
export const clang_FullComment_getAsHTML = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * Convert a given full parsed comment to an XML document.
 *
 * A Relax NG schema for the XML can be found in comment-xml-schema.rng file
 * inside clang source tree.
 *
 * @param Comment a `CXComment_FullComment` AST node.
 * @returns string containing an XML document.
 */
export const clang_FullComment_getAsXML = {
  parameters: [
    CXCommentT, // Comment
  ],
  result: CXStringT,
} as const;

/**
 * Traverses the translation unit to create a `CXAPISet.`
 *
 * @param tu is the `CXTranslationUnit` to build the `CXAPISet` for.
 * @param out_api is a pointer to the output of this function. It is needs to be
 * disposed of by calling clang_disposeAPISet.
 * @returns Error code indicating success or failure of the APISet creation.
 */
// deno-lint-ignore no-unused-vars
const clang_createAPISet = {
  parameters: [
    CXTranslationUnitT, // tu
    buf(CXAPISetT), // out_api
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Dispose of an APISet.
 *
 * The provided `CXAPISet` can not be used after this function is called.
 */
// deno-lint-ignore no-unused-vars
const clang_disposeAPISet = {
  parameters: [
    CXAPISetT, // api
  ],
  result: "void",
} as const;

/**
 * Generate a single symbol symbol graph for the given USR. Returns a null
 * string if the associated symbol can not be found in the provided `CXAPISet.`
 *
 * The output contains the symbol graph as well as some additional information
 * about related symbols.
 *
 * @param usr is a string containing the USR of the symbol to generate the
 * symbol graph for.
 * @param api the `CXAPISet` to look for the symbol in.
 * @returns a string containing the serialized symbol graph representation for
 * the symbol being queried or a null string if it can not be found in the
 * APISet.
 */
// deno-lint-ignore no-unused-vars
const clang_getSymbolGraphForUSR = {
  parameters: [
    cstringT, // usr
    CXAPISetT, // api
  ],
  result: CXStringT,
} as const;

/**
 * Generate a single symbol symbol graph for the declaration at the given
 * cursor. Returns a null string if the AST node for the cursor isn't a
 * declaration.
 *
 * The output contains the symbol graph as well as some additional information
 * about related symbols.
 *
 * @param cursor the declaration for which to generate the single symbol symbol
 * graph.
 * @returns a string containing the serialized symbol graph representation for
 * the symbol being queried or a null string if it can not be found in the
 * APISet.
 */
// deno-lint-ignore no-unused-vars
const clang_getSymbolGraphForCursor = {
  parameters: [
    CXCursorT, // cursor
  ],
  result: CXStringT,
} as const;
