/**
 * Build system utilities
 */

import { CXErrorCodeT } from "./ErrorCode.h.ts";
import {
  constCharPtr,
  CXModuleMapDescriptor,
  CXVirtualFileOverlayT,
  int,
  out,
  unsigned,
  unsignedLongLong,
} from "./typeDefinitions.ts";

/**
 * Return the timestamp for use with Clang's
 * `-fbuild-session-timestamp=` option.
 */
export const clang_getBuildSessionTimestamp = {
  parameters: [],
  result: unsignedLongLong,
} as const;

/**
 * Create a {@link CXVirtualFileOverlayT} object.
 * Must be disposed with {@link clang_VirtualFileOverlay_dispose}().
 *
 * @param options is reserved, always pass 0.
 */
export const clang_VirtualFileOverlay_create = {
  parameters: [unsigned],
  result: CXVirtualFileOverlayT,
} as const;

/**
 * Map an absolute virtual file path to an absolute real one.
 * The virtual path must be canonicalized (not contain "."/"..").
 * @param fileOverlay
 * @param virtualPath
 * @param realPath
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_addFileMapping = {
  parameters: [CXVirtualFileOverlayT, constCharPtr, constCharPtr],
  result: CXErrorCodeT,
} as const;

/**
 * Set the case sensitivity for the {@link CXVirtualFileOverlayT} object.
 * The {@link CXVirtualFileOverlayT} object is case-sensitive by default, this
 * option can be used to override the default.
 * @param fileOverlay
 * @param caseSensitive
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_setCaseSensitivity = {
  parameters: [CXVirtualFileOverlayT, int],
  result: CXErrorCodeT,
} as const;

/**
 * Write out the {@link CXVirtualFileOverlayT} object to a char buffer.
 *
 * @param fileOverlay
 * @param options is reserved, always pass 0.
 * @param out_buffer_ptr pointer to receive the buffer pointer, which should be
 * disposed using {@link clang_free}().
 * @param out_buffer_size pointer to receive the buffer size.
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_writeToBuffer = {
  parameters: [
    CXVirtualFileOverlayT,
    unsigned,
    out(CXVirtualFileOverlayT),
    out(unsigned),
  ],
  result: CXErrorCodeT,
} as const;

/**
 * free memory allocated by libclang, such as the buffer returned by
 * {@link CXVirtualFileOverlayT}() or {@link clang_ModuleMapDescriptor_writeToBuffer}().
 *
 * @param buffer memory pointer to free.
 */
export const clang_free = {
  parameters: [CXVirtualFileOverlayT],
  result: "void",
} as const;

/**
 * Dispose a {@link CXVirtualFileOverlayT} object.
 */
export const clang_VirtualFileOverlay_dispose = {
  parameters: [CXVirtualFileOverlayT],
  result: "void",
} as const;

/**
 * Create a {@link CXModuleMapDescriptor} object.
 * Must be disposed with {@link clang_ModuleMapDescriptor_dispose}().
 *
 * @param options is reserved, always pass 0.
 */
export const clang_ModuleMapDescriptor_create = {
  parameters: [unsigned],
  result: CXModuleMapDescriptor,
} as const;

/**
 * Sets the framework module name that the module.map describes.
 * @param fileOverlay
 * @param name
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_setFrameworkModuleName = {
  parameters: [CXModuleMapDescriptor, constCharPtr],
  result: CXErrorCodeT,
} as const;

/**
 * Sets the umbrella header name that the module.map describes.
 * @param fileOverlay
 * @param name
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_setUmbrellaHeader = {
  parameters: [CXModuleMapDescriptor, constCharPtr],
  result: CXErrorCodeT,
} as const;

/**
 * Write out the {@link CXModuleMapDescriptor} object to a char buffer.
 *
 * @param options is reserved, always pass 0.
 * @param out_buffer_ptr pointer to receive the buffer pointer, which should be
 * disposed using {@link clang_free}().
 * @param out_buffer_size pointer to receive the buffer size.
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_writeToBuffer = {
  parameters: [
    CXModuleMapDescriptor,
    unsigned,
    out(CXModuleMapDescriptor),
    out(unsigned),
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Dispose a {@link CXModuleMapDescriptor} object.
 */
export const clang_ModuleMapDescriptor_dispose = {
  parameters: [CXModuleMapDescriptor],
  result: "void",
} as const;
