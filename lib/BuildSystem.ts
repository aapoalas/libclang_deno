import { libclang } from "./ffi.ts";
import { cstr, throwIfError } from "./utils.ts";

const VIRTUAL_FILE_OVERLAY_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_VirtualFileOverlay_dispose(pointer));

const CHAR_BUFFER_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_free(pointer));

/**
 * Class encapsulating information about overlaying virtual
 * file/directories over the real file system.
 */
export class CXVirtualFileOverlay {
  #pointer: Deno.PointerValue;
  #disposed = false;

  constructor() {
    this.#pointer = libclang.symbols.clang_VirtualFileOverlay_create(0);
    VIRTUAL_FILE_OVERLAY_FINALIZATION_REGISTRY.register(
      this,
      this.#pointer,
      this,
    );
  }

  /**
   * Set the case sensitivity for this {@link CXVirtualFileOverlay} object.
   * The {@link CXVirtualFileOverlay} object is case-sensitive by default, this
   * option can be used to override the default.
   *
   * An error is thrown on error.
   */
  setCaseSensitivity(value: boolean): void {
    if (this.#disposed) {
      throw new Error(
        "Cannot set case sensitivity of disposed VirtualFileOverlay",
      );
    }
    throwIfError(
      libclang.symbols.clang_VirtualFileOverlay_setCaseSensitivity(
        this.#pointer,
        Number(value),
      ),
      "Setting VirtualFileOverlay case sensitivity failed",
    );
  }

  /**
   * Map an absolute virtual file path to an absolute real one.
   * The virtual path must be canonicalized (not contain "."/"..").
   *
   * An error is thrown on error.
   */
  addFileMapping(virtualPath: string, realPath: string): void {
    if (this.#disposed) {
      throw new Error("Cannot add file mapping to disposed VirtualFileOverlay");
    }
    throwIfError(
      libclang.symbols.clang_VirtualFileOverlay_addFileMapping(
        this.#pointer,
        cstr(virtualPath),
        cstr(realPath),
      ),
      "Adding file mapping to VirtualFileOverlay failed",
    );
  }

  /**
   * Write out this {@link CXVirtualFileOverlay} object to a char buffer.
   *
   * An error is thrown on error.
   */
  writeToBuffer(): Uint8Array {
    if (this.#disposed) {
      throw new Error("Cannot stringify disposed VirtualFileOverlay");
    }
    const OUT = new Uint8Array(16);
    throwIfError(
      libclang.symbols.clang_VirtualFileOverlay_writeToBuffer(
        this.#pointer,
        0,
        OUT,
        OUT.subarray(8, 12),
      ),
      "Writing VirtualFileOverlay to buffer failed",
    );
    const pointer = Number(new BigUint64Array(OUT.buffer)[0]);
    const length = new Uint32Array(OUT.buffer, 8, 1)[0];
    const charBuffer = new Uint8Array(
      Deno.UnsafePointerView.getArrayBuffer(pointer, length),
    );
    CHAR_BUFFER_FINALIZATION_REGISTRY.register(charBuffer, pointer);
    return charBuffer;
  }

  /**
   * Dispose of this {@link CXVirtualFileOverlay} object.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_VirtualFileOverlay_dispose(this.#pointer);
    VIRTUAL_FILE_OVERLAY_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}

const MODULE_MAP_DESCRIPTOR_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_ModuleMapDescriptor_dispose(pointer));

/**
 * Class encapsulating information about a `module.map` file.
 */
export class CXModuleMapDescriptor {
  #pointer: Deno.PointerValue;
  #disposed = false;
  constructor() {
    this.#pointer = libclang.symbols.clang_ModuleMapDescriptor_create(0);
    MODULE_MAP_DESCRIPTOR_FINALIZATION_REGISTRY.register(
      this,
      this.#pointer,
      this,
    );
  }

  /**
   * Sets the framework module name that the `module.map` describes.
   *
   * An error is thrown on error.
   */
  setFrameworkModuleName(name: string): void {
    if (this.#disposed) {
      throw new Error(
        "Cannot set framework module name of disposed ModuleMapDescriptor",
      );
    }

    throwIfError(
      libclang.symbols.clang_ModuleMapDescriptor_setFrameworkModuleName(
        this.#pointer,
        cstr(name),
      ),
      "Setting framework module name of ModuleMapDescriptor failed",
    );
  }

  /**
   * Sets the umbrella header name that the `module.map` describes.
   *
   * An error is thrown on error.
   */
  setUmbrellaHeader(name: string): void {
    if (this.#disposed) {
      throw new Error(
        "Cannot set umbrella header name of disposed ModuleMapDescriptor",
      );
    }

    throwIfError(
      libclang.symbols.clang_ModuleMapDescriptor_setUmbrellaHeader(
        this.#pointer,
        cstr(name),
      ),
      "Setting umbrella header name of ModuleMapDescriptor failed",
    );
  }

  /**
   * Write out this {@link CXModuleMapDescriptor} object to a char buffer.
   *
   * Use {@link TextDecoder.decode} to get a string out of the buffer.
   *
   * An error is thrown on error.
   */
  writeToBuffer(): Uint8Array {
    if (this.#disposed) {
      throw new Error("Cannot stringify disposed ModuleMapDescriptor");
    }
    const OUT = new Uint8Array(16);
    throwIfError(
      libclang.symbols.clang_ModuleMapDescriptor_writeToBuffer(
        this.#pointer,
        0,
        OUT,
        OUT.subarray(8, 12),
      ),
      "Writing ModuleMapDescriptor to buffer failed",
    );
    const pointer = Number(new BigUint64Array(OUT.buffer)[0]);
    const length = new Uint32Array(OUT.buffer, 8, 1)[0];
    const charBuffer = new Uint8Array(
      Deno.UnsafePointerView.getArrayBuffer(pointer, length),
    );
    CHAR_BUFFER_FINALIZATION_REGISTRY.register(charBuffer, pointer);
    return charBuffer;
  }

  /**
   * Dispose of this {@link CXModuleMapDescriptor} object.
   *
   * It is not strictly necessary to call this method, the memory
   * will be released as part of JavaScript garbage collection.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_ModuleMapDescriptor_dispose(this.#pointer);
    MODULE_MAP_DESCRIPTOR_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
