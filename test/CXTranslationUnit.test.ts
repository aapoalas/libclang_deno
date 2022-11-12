import {
assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.163.0/testing/asserts.ts";
import { libclang } from "../lib/ffi.ts";
import { CXErrorCode } from "../lib/include/ErrorCode.h.ts";
import { NULL } from "../lib/include/typeDefinitions.ts";
import { cstr } from "../lib/utils.ts";

Deno.test("clang_createIndex", async (t) => {
  await t.step("clang_createIndex(0, 0)", () => {
    const index = libclang.symbols.clang_createIndex(0, 0);
    assertNotEquals(index, 0, "Index must be non-zero");
    libclang.symbols.clang_disposeIndex(index);
  });

  await t.step("clang_createIndex(1, 0)", () => {
    const index = libclang.symbols.clang_createIndex(1, 0);
    assertNotEquals(index, 0, "Index must be non-zero");
    libclang.symbols.clang_disposeIndex(index);
  });

  await t.step("clang_createIndex(0, 1)", () => {
    const index = libclang.symbols.clang_createIndex(0, 1);
    assertNotEquals(index, 0, "Index must be non-zero");
    libclang.symbols.clang_disposeIndex(index);
  });

  await t.step("clang_createIndex(1, 1)", () => {
    const index = libclang.symbols.clang_createIndex(1, 1);
    assertNotEquals(index, 0, "Index must be non-zero");
    libclang.symbols.clang_disposeIndex(index);
  });
});

Deno.test("clang_createTranslationUnit", async (t) => {
  const index = libclang.symbols.clang_createIndex(0, 0);

  await t.step("Invalid createTranslationUnit call", () => {
    const tu = libclang.symbols.clang_createTranslationUnit(
      index,
      new Uint8Array(1),
    );
    assertEquals(
      tu,
      NULL,
      "Invalid createTranslationUnit call must return NULL",
    );
  });

  await t.step("Invalid createTranslationUnit2 call", () => {
    const tuOut = new Uint8Array(8);
    const errorCode = libclang.symbols.clang_createTranslationUnit2(
      index,
      new Uint8Array(1),
      tuOut,
    );
    assertEquals(
      errorCode,
      CXErrorCode.CXError_Failure,
      "Invalid createTranslationUnit2 call must return CXError_Failure",
    );
  });
});

Deno.test("clang_parseTranslationUnit", async (t) => {
    const index = libclang.symbols.clang_createIndex(0, 0);
    await t.step("Empty parseTranslationUnit call", () => {
        const tu = libclang.symbols.clang_parseTranslationUnit(index, new Uint8Array(1), NULL, 0, NULL, 0, 0);
        assertEquals(tu, NULL);
    });

    await t.step("Invalid parseTranslationUnit call", () => {
        const tu = libclang.symbols.clang_parseTranslationUnit(index, cstr("does_not_exist.h"), NULL, 0, NULL, 0, 0);
        assertEquals(tu, NULL);
    });

    await t.step("Parsing", () => {
        const tu = libclang.symbols.clang_parseTranslationUnit(index, cstr("./test/assets/test.h"), NULL, 0, NULL, 0, 0);
        assertNotEquals(tu, NULL);
    });
});
