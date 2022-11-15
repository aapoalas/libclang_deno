/**
 * Comment introspection
 *
 * The routines in this group provide access to information in documentation
 * comments. These facilities are distinct from the core and may be subject to
 * their own schedule of stability and deprecation.
 */

import {
  CXComment,
  CXCommentInlineCommandRenderKindT,
  CXCommentKindT,
  CXCommentParamPassDirectionT,
  CXCursorT,
  CXString,
  unsigned,
} from "./typeDefinitions.ts";

/**
 * Given a cursor that represents a documentable entity (e.g.,
 * declaration), return the associated parsed comment as a
 * {@link CXComment_FullComment} AST node.
 */
export const clang_Cursor_getParsedComment = {
  parameters: [CXCursorT],
  result: CXComment,
} as const;

/**
 * @param Comment AST node of any kind.
 *
 * @returns the type of the AST node.
 */
export const clang_Comment_getKind = {
  parameters: [CXComment],
  result: CXCommentKindT,
} as const;

/**
 * @param Comment AST node of any kind.
 *
 * @returns number of children of the AST node.
 */
export const clang_Comment_getNumChildren = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment AST node of any kind.
 *
 * @param ChildIdx child index (zero-based).
 *
 * @returns the specified child of the AST node.
 */
export const clang_Comment_getChild = {
  parameters: [CXComment, unsigned],
  result: CXComment,
} as const;

/**
 * A {@link CXComment_Paragraph} node is considered whitespace if it contains
 * only {@link CXComment_Text} nodes that are empty or whitespace.
 *
 * Other AST nodes (except {@link CXComment_Paragraph} and {@link CXComment_Text}) are
 * never considered whitespace.
 *
 * @returns non-zero if `$1` is whitespace.
 */
export const clang_Comment_isWhitespace = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @returns non-zero if `$1` is inline content and has a newline
 * immediately following it in the comment text.  Newlines between paragraphs
 * do not count.
 */
export const clang_InlineContentComment_hasTrailingNewline = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_Text} AST node.
 *
 * @returns text contained in the AST node.
 */
export const clang_TextComment_getText = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_InlineCommand} AST node.
 *
 * @returns name of the inline command.
 */
export const clang_InlineCommandComment_getCommandName = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_InlineCommand} AST node.
 *
 * @returns the most appropriate rendering mode, chosen on command
 * semantics in Doxygen.
 */
export const clang_InlineCommandComment_getRenderKind = {
  parameters: [CXComment],
  result: CXCommentInlineCommandRenderKindT,
} as const;

/**
 * @param Comment a {@link CXComment_InlineCommand} AST node.
 *
 * @returns number of command arguments.
 */
export const clang_InlineCommandComment_getNumArgs = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_InlineCommand} AST node.
 *
 * @param ArgIdx argument index (zero-based).
 *
 * @returns text of the specified argument.
 */
export const clang_InlineCommandComment_getArgText = {
  parameters: [CXComment, unsigned],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_HTMLStartTag} or {@link CXComment_HTMLEndTag} AST
 * node.
 *
 * @returns HTML tag name.
 */
export const clang_HTMLTagComment_getTagName = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_HTMLStartTag} AST node.
 *
 * @returns non-zero if tag is self-closing (for example, &lt;br /&gt;).
 */
export const clang_HTMLStartTagComment_isSelfClosing = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_HTMLStartTag} AST node.
 *
 * @returns number of attributes (name-value pairs) attached to the start tag.
 */
export const clang_HTMLStartTag_getNumAttrs = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_HTMLStartTag} AST node.
 *
 * @param AttrIdx attribute index (zero-based).
 *
 * @returns name of the specified attribute.
 */
export const clang_HTMLStartTag_getAttrName = {
  parameters: [CXComment, unsigned],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_HTMLStartTag} AST node.
 *
 * @param AttrIdx attribute index (zero-based).
 *
 * @returns value of the specified attribute.
 */
export const clang_HTMLStartTag_getAttrValue = {
  parameters: [CXComment, unsigned],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_BlockCommand} AST node.
 *
 * @returns name of the block command.
 */
export const clang_BlockCommandComment_getCommandName = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_BlockCommand} AST node.
 *
 * @returns number of word-like arguments.
 */
export const clang_BlockCommandComment_getNumArgs = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_BlockCommand} AST node.
 *
 * @param ArgIdx argument index (zero-based).
 *
 * @returns text of the specified word-like argument.
 */
export const clang_BlockCommandComment_getArgText = {
  parameters: [CXComment, unsigned],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_BlockCommand} or
 * {@link CXComment_VerbatimBlockCommand} AST node.
 *
 * @returns paragraph argument of the block command.
 */
export const clang_BlockCommandComment_getParagraph = {
  parameters: [CXComment],
  result: CXComment,
} as const;

/**
 * @param Comment a {@link CXComment_ParamCommand} AST node.
 *
 * @returns parameter name.
 */
export const clang_ParamCommandComment_getParamName = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_ParamCommand} AST node.
 *
 * @returns non-zero if the parameter that this AST node represents was found
 * in the function prototype and `$1`
 * function will return a meaningful value.
 */
export const clang_ParamCommandComment_isParamIndexValid = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_ParamCommand} AST node.
 *
 * @returns zero-based parameter index in function prototype.
 */
export const clang_ParamCommandComment_getParamIndex = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_ParamCommand} AST node.
 *
 * @returns non-zero if parameter passing direction was specified explicitly in
 * the comment.
 */
export const clang_ParamCommandComment_isDirectionExplicit = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_ParamCommand} AST node.
 *
 * @returns parameter passing direction.
 */
export const clang_ParamCommandComment_getDirection = {
  parameters: [CXComment],
  result: CXCommentParamPassDirectionT,
} as const;

/**
 * @param Comment a {@link CXComment_TParamCommand} AST node.
 *
 * @returns template parameter name.
 */
export const clang_TParamCommandComment_getParamName = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_TParamCommand} AST node.
 *
 * @returns non-zero if the parameter that this AST node represents was found
 * in the template parameter list and
 * `$1` and
 * `$1` functions will return a meaningful
 * value.
 */
export const clang_TParamCommandComment_isParamPositionValid = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_TParamCommand} AST node.
 *
 * @returns zero-based nesting depth of this parameter in the template parameter list.
 *
 * For example,
 * \verbatim
 *     template<typename C, template<typename T> class TT>
 *     void test(TT<int> aaa);
 * \endverbatim
 * for C and TT nesting depth is 0,
 * for T nesting depth is 1.
 */
export const clang_TParamCommandComment_getDepth = {
  parameters: [CXComment],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_TParamCommand} AST node.
 *
 * @returns zero-based parameter index in the template parameter list at a
 * given nesting depth.
 *
 * For example,
 * \verbatim
 *     template<typename C, template<typename T> class TT>
 *     void test(TT<int> aaa);
 * \endverbatim
 * for C and TT nesting depth is 0, so we can ask for index at depth 0:
 * at depth 0 C's index is 0, TT's index is 1.
 *
 * For T nesting depth is 1, so we can ask for index at depth 0 and 1:
 * at depth 0 T's index is 1 (same as TT's),
 * at depth 1 T's index is 0.
 */
export const clang_TParamCommandComment_getIndex = {
  parameters: [CXComment, unsigned],
  result: unsigned,
} as const;

/**
 * @param Comment a {@link CXComment_VerbatimBlockLine} AST node.
 *
 * @returns text contained in the AST node.
 */
export const clang_VerbatimBlockLineComment_getText = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * @param Comment a {@link CXComment_VerbatimLine} AST node.
 *
 * @returns text contained in the AST node.
 */
export const clang_VerbatimLineComment_getText = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * Convert an HTML tag AST node to string.
 *
 * @param Comment a {@link CXComment_HTMLStartTag} or {@link CXComment_HTMLEndTag} AST
 * node.
 *
 * @returns string containing an HTML tag.
 */
export const clang_HTMLTagComment_getAsString = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * Convert a given full parsed comment to an HTML fragment.
 *
 * Specific details of HTML layout are subject to change.  Don't try to parse
 * this HTML back into an AST, use other APIs instead.
 *
 * Currently the following CSS classes are used:
 * - "para-brief" for \paragraph and equivalent commands;
 * - "para-returns" for \\returns paragraph and equivalent commands;
 * - "word-returns" for the "Returns" word in \\returns paragraph.
 *
 * Function argument documentation is rendered as a <dl> list with arguments
 * sorted in function prototype order.  CSS classes used:
 * - "param-name-index-NUMBER" for parameter name (<dt>);
 * - "param-descr-index-NUMBER" for parameter description (<dd>);
 * - "param-name-index-invalid" and "param-descr-index-invalid" are used if
 * parameter index is invalid.
 *
 * Template parameter documentation is rendered as a <dl> list with
 * parameters sorted in template parameter list order.  CSS classes used:
 * - "tparam-name-index-NUMBER" for parameter name (<dt>);
 * - "tparam-descr-index-NUMBER" for parameter description (<dd>);
 * - "tparam-name-index-other" and "tparam-descr-index-other" are used for
 * names inside template template parameters;
 * - "tparam-name-index-invalid" and "tparam-descr-index-invalid" are used if
 * parameter position is invalid.
 *
 * @param Comment a {@link CXComment_FullComment} AST node.
 *
 * @returns string containing an HTML fragment.
 */
export const clang_FullComment_getAsHTML = {
  parameters: [CXComment],
  result: CXString,
} as const;

/**
 * Convert a given full parsed comment to an XML document.
 *
 * A Relax NG schema for the XML can be found in comment-xml-schema.rng file
 * inside clang source tree.
 *
 * @param Comment a {@link CXComment_FullComment} AST node.
 *
 * @returns string containing an XML document.
 */
export const clang_FullComment_getAsXML = {
  parameters: [CXComment],
  result: CXString,
} as const;
