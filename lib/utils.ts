import { libclang } from "./ffi.ts";
import { NULL } from "./include/typeDefinitions.ts";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export class CStringArray extends Uint8Array {
  constructor(strings?: string[]) {
    if (!strings || strings.length === 0) {
      super();
      return;
    }
    let stringsLength = 0;
    for (const string of strings) {
      // Byte length of a UTF-8 string is never bigger than 3 times its length.
      // 2 times the length would be a fairly safe guess. For command line arguments,
      // we expect that all characters should be single-byte UTF-8 characters.
      stringsLength = string.length;
    }
    super(9 * strings.length + stringsLength);
    const pointerBuffer = new BigUint64Array(this.buffer, 0, strings.length);
    const stringsBuffer = this.subarray(strings.length * 8);
    const basePointer = BigInt(Deno.UnsafePointer.of(stringsBuffer));
    let index = 0;
    let offset = 0;
    for (const string of strings) {
      const start = offset;
      const end = start + string.length;
      offset = end + 1; // Leave null byte
      const result = ENCODER.encodeInto(string, stringsBuffer.subarray(start, end));
      if (result.read !== result.written) {
        throw new Error("Not a single byte UTF-8 string");
      }
      pointerBuffer[index++] = basePointer + BigInt(start);
    }
  }
}

export const cstr = (string: string): Uint8Array =>
  ENCODER.encode(`${string}\0`);
export const cstrInto = (string: string, buffer: Uint8Array): TextEncoderEncodeIntoResult => ENCODER.encodeInto(`${string}\0`, buffer);
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

export const cxstringSetToStringArray = (
  cxstringSetPointer: Deno.PointerValue,
): string[] => {
  if (cxstringSetPointer === NULL) {
    return [];
  }

  const view = new Deno.UnsafePointerView(cxstringSetPointer);
  const count = view.getUint32(8);
  if (count === 0) {
    libclang.symbols.clang_disposeStringSet(cxstringSetPointer);
    return [];
  }
  const stringsPointer = Number(view.getBigUint64(0));
  const strings = [];
  for (let i = 0; i < count; i++) {
    const cxstring = new Uint8Array(
      Deno.UnsafePointerView.getArrayBuffer(stringsPointer, 16, i * 16),
    );
    strings.push(cxstringToString(cxstring));
  }
  libclang.symbols.clang_disposeStringSet(cxstringSetPointer);
  return strings;
};

export const wrapPointerInBuffer = (pointer: Deno.PointerValue): Uint8Array => {
  const buf = new Uint8Array(8);
  const u64Buf = new BigUint64Array(buf.buffer);
  u64Buf[0] = BigInt(pointer);
  return buf;
};
