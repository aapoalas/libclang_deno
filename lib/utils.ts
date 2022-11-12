const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export const cstr = (string: string): Uint8Array => ENCODER.encode(`${string}\0`);
export const charBuffer = (string: string): Uint8Array => ENCODER.encode(string);