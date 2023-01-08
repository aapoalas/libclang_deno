import {
  buf,
  cstringArrayT,
  cstringT,
  CXErrorCodeT,
  CXModuleMapDescriptorT,
  CXVirtualFileOverlayT,
  int,
  ptr,
  unsignedInt,
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
 * Create a `CXVirtualFileOverlay` object.
 * Must be disposed with `clang_VirtualFileOverlay_dispose().`
 *
 * @param options is reserved, always pass 0.
 */
export const clang_VirtualFileOverlay_create = {
  parameters: [
    unsignedInt, // options
  ],
  result: CXVirtualFileOverlayT,
} as const;

/**
 * Map an absolute virtual file path to an absolute real one.
 * The virtual path must be canonicalized (not contain "."/"..").
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_addFileMapping = {
  parameters: [
    CXVirtualFileOverlayT,
    cstringT, // virtualPath
    cstringT, // realPath
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Set the case sensitivity for the `CXVirtualFileOverlay` object.
 * The `CXVirtualFileOverlay` object is case-sensitive by default, this
 * option can be used to override the default.
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_setCaseSensitivity = {
  parameters: [
    CXVirtualFileOverlayT,
    int, // caseSensitive
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Write out the `CXVirtualFileOverlay` object to a char buffer.
 *
 * @param options is reserved, always pass 0.
 *
 * @param out_buffer_ptr pointer to receive the buffer pointer, which should be
 * disposed using `clang_free().`
 * @param out_buffer_size pointer to receive the buffer size.
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_VirtualFileOverlay_writeToBuffer = {
  parameters: [
    CXVirtualFileOverlayT,
    unsignedInt, // options
    cstringArrayT, // out_buffer_ptr
    buf(unsignedInt), // out_buffer_size
  ],
  result: CXErrorCodeT,
} as const;

/**
 * free memory allocated by libclang, such as the buffer returned by
 * `CXVirtualFileOverlay(`) or `clang_ModuleMapDescriptor_writeToBuffer().`
 *
 * @param buffer memory pointer to free.
 */
export const clang_free = {
  parameters: [
    ptr("void"), // buffer
  ],
  result: "void",
} as const;

/**
 * Dispose a `CXVirtualFileOverlay` object.
 */
export const clang_VirtualFileOverlay_dispose = {
  parameters: [
    CXVirtualFileOverlayT,
  ],
  result: "void",
} as const;

/**
 * Create a `CXModuleMapDescriptor` object.
 * Must be disposed with `clang_ModuleMapDescriptor_dispose().`
 *
 * @param options is reserved, always pass 0.
 */
export const clang_ModuleMapDescriptor_create = {
  parameters: [
    unsignedInt, // options
  ],
  result: CXModuleMapDescriptorT,
} as const;

/**
 * Sets the framework module name that the module.map describes.
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_setFrameworkModuleName = {
  parameters: [
    CXModuleMapDescriptorT,
    cstringT, // name
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Sets the umbrella header name that the module.map describes.
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_setUmbrellaHeader = {
  parameters: [
    CXModuleMapDescriptorT,
    cstringT, // name
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Write out the `CXModuleMapDescriptor` object to a char buffer.
 *
 * @param options is reserved, always pass 0.
 *
 * @param out_buffer_ptr pointer to receive the buffer pointer, which should be
 * disposed using `clang_free().`
 * @param out_buffer_size pointer to receive the buffer size.
 *
 * @returns 0 for success, non-zero to indicate an error.
 */
export const clang_ModuleMapDescriptor_writeToBuffer = {
  parameters: [
    CXModuleMapDescriptorT,
    unsignedInt, // options
    cstringArrayT, // out_buffer_ptr
    buf(unsignedInt), // out_buffer_size
  ],
  result: CXErrorCodeT,
} as const;

/**
 * Dispose a `CXModuleMapDescriptor` object.
 */
export const clang_ModuleMapDescriptor_dispose = {
  parameters: [
    CXModuleMapDescriptorT,
  ],
  result: "void",
} as const;
