import { libclang } from "./ffi.ts";
import { NULL } from "./include/typeDefinitions.ts";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export class CStringArray extends Uint8Array {
  #cstrs: Uint8Array[] = [];
  constructor(strings?: string[]) {
    if (!strings) {
      super();
      return;
    }
    super(8 * strings.length);
    if (strings.length === 0) {
      return;
    }
    const pointerBuffer = new BigUint64Array(this.buffer);
    const buffers = this.#cstrs;
    let index = 0;
    for (const string of strings) {
      const cstrBuffer = cstr(string);
      buffers.push(cstrBuffer);
      pointerBuffer[index++] = BigInt(Deno.UnsafePointer.of(cstrBuffer));
    }
  }

  get arrayLength(): number {
    return this.#cstrs.length;
  }
}

export const cstr = (string: string): Uint8Array =>
  ENCODER.encode(`${string}\0`);
export const charBuffer = (string: string): Uint8Array =>
  ENCODER.encode(string);
export const cstrArray = (strings: string[]) => {
  if (strings.length === 0) {
    return new Uint8Array();
  }
};

export const cxstringToString = (cxstring: Uint8Array): string => {
  const cstring = libclang.symbols.clang_getCString(cxstring);
  if (cstring === NULL) {
    libclang.symbols.clang_disposeString(cxstring);
    return "";
  }
  const string = Deno.UnsafePointerView.getCString(cstring);
  libclang.symbols.clang_disposeString(cxstring);
  return string;
};
export const cstrToString = (cstr: Uint8Array): string =>
  DECODER.decode(cstr.subarray(0, cstr.byteLength - 1));
export const charBufferToString = (cstr: Uint8Array): string =>
  DECODER.decode(cstr);

export const wrapPointerInBuffer = (pointer: Deno.PointerValue): Uint8Array => {
  const buf = new Uint8Array(8);
  const u64Buf = new BigUint64Array(buf.buffer);
  u64Buf[0] = BigInt(pointer);
  return buf;
};
