import { libclang } from "./ffi.ts";
import { throwIfError } from "./include/ErrorCode.h.ts";
import { charBufferToString, cstr } from "./utils.ts";

const VIRTUAL_FILE_OVERLAY_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_VirtualFileOverlay_dispose(pointer));

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

  toString(): string {
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
    const result = charBufferToString(charBuffer);
    libclang.symbols.clang_free(pointer);
    return result;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_VirtualFileOverlay_dispose(this.#pointer);
    VIRTUAL_FILE_OVERLAY_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
