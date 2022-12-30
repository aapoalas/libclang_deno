import { libclang } from "./ffi.ts";
import { throwIfError } from "./include/ErrorCode.h.ts";
import { charBufferToString, cstr } from "./utils.ts";

const MODULE_MAP_DESCRIPTOR_FINALIZATION_REGISTRY = new FinalizationRegistry<
  Deno.PointerValue
>((pointer) => libclang.symbols.clang_ModuleMapDescriptor_dispose(pointer));

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

  toString(): string {
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
    const result = charBufferToString(charBuffer);
    libclang.symbols.clang_free(pointer);
    return result;
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    libclang.symbols.clang_ModuleMapDescriptor_dispose(this.#pointer);
    MODULE_MAP_DESCRIPTOR_FINALIZATION_REGISTRY.unregister(this);
    this.#disposed = true;
  }
}
