import { libclang } from "../ffi.ts";

export class CXDiagnosticSet {
    #pointer: Deno.PointerValue;

    constructor(pointer: Deno.PointerValue) {
        this.#pointer = pointer;
    }

    dispose() {
        libclang.symbols.clang_disposeDiagnosticSet(this.#pointer);
    }
}

export class CXDiagnostic {
    #pointer: Deno.PointerValue;

    constructor(pointer: Deno.PointerValue) {
        this.#pointer = pointer;
    }

    dispose() {
        libclang.symbols.clang_disposeDiagnostic(this.#pointer);
    }
}