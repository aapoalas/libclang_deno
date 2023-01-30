import {
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "https://deno.land/std@0.163.0/testing/asserts.ts";
import {
  CXChildVisitResult,
  CXCursorKind,
} from "../lib/include/typeDefinitions.ts";
import { CXDiagnosticSet, CXIndex } from "../lib/mod.ts";

Deno.test("class CXIndex", async (t) => {
  await t.step("new CXIndex()", () => {
    const index = new CXIndex();
    index.dispose();
  });

  await t.step("new CXIndex(true)", () => {
    const index = new CXIndex(true);
    index.dispose();
  });

  await t.step("new CXIndex(false, true)", () => {
    const index = new CXIndex(false, true);
    index.dispose();
  });

  await t.step("new CXIndex(true, true)", () => {
    const index = new CXIndex(true, true);
    index.dispose();
  });

  await t.step("get options", () => {
    const index = new CXIndex();
    assertEquals(index.options, {
      threadBackgroundPriorityForIndexing: false,
      threadBackgroundPriorityForEditing: false,
    });
    index.dispose();
  });

  await t.step("set options", () => {
    const index = new CXIndex();
    index.options = {
      threadBackgroundPriorityForEditing: true,
      threadBackgroundPriorityForIndexing: false,
    };
    assertEquals(index.options, {
      threadBackgroundPriorityForEditing: true,
      threadBackgroundPriorityForIndexing: false,
    });
    index.options = {
      threadBackgroundPriorityForEditing: false,
      threadBackgroundPriorityForIndexing: true,
    };
    assertEquals(index.options, {
      threadBackgroundPriorityForEditing: false,
      threadBackgroundPriorityForIndexing: true,
    });
    index.options = {
      threadBackgroundPriorityForEditing: true,
      threadBackgroundPriorityForIndexing: true,
    };
    assertEquals(index.options, {
      threadBackgroundPriorityForEditing: true,
      threadBackgroundPriorityForIndexing: true,
    });
    index.dispose();
  });

  await t.step("setInvocationEmissionPathOption", () => {
    const index = new CXIndex();
    index.setInvocationEmissionPathOption("./logs");
    index.dispose();
  });

  await t.step("setInvocationEmissionPathOption('')", () => {
    const index = new CXIndex();
    index.setInvocationEmissionPathOption("");
    index.dispose();
  });

  await t.step("setInvocationEmissionPathOption(null)", () => {
    const index = new CXIndex();
    index.setInvocationEmissionPathOption(null);
    index.dispose();
  });
});

Deno.test("class CXTranslationUnit", async (t) => {
  await t.step("Empty parseTranslationUnit", () => {
    const index = new CXIndex();
    assertThrows(() => index.parseTranslationUnit(""));
    index.dispose();
  });

  await t.step("Invalid parseTranslationUnit", () => {
    const index = new CXIndex();
    assertThrows(() => index.parseTranslationUnit("does_not_exist.h"));
    index.dispose();
  });

  await t.step("Valid parseTranslationUnit", () => {
    const index = new CXIndex();
    index.parseTranslationUnit("./test/assets/test.h");
    index.dispose();
  });

  await t.step("getTargetInfo", () => {
    const index = new CXIndex();
    const tu = index.parseTranslationUnit("./test/assets/test.h");
    const targetInfo1 = tu.getTargetInfo();
    const targetInfo2 = tu.getTargetInfo();
    assertEquals(targetInfo1.pointerWidth, targetInfo2.pointerWidth);
    assertEquals(targetInfo1.triple, targetInfo2.triple);
    tu.dispose();
    assertThrows(() => tu.getTargetInfo());
  });

  await t.step("file stuff", () => {
    const index = new CXIndex();
    const tu = index.parseTranslationUnit("./test/assets/test.h");
    const tu2 = index.parseTranslationUnit("./test/assets/test.hpp");
    //console.log("Diag count:", tu2.getNumberOfDiagnostics());
    const file = tu.getFile("./test/assets/test.h");
    assertNotEquals(file, null);
    // Remove \r for windows hosts
    const contents = file!.getContents().replaceAll('\r\n', '\n');
    assertEquals(contents.startsWith("// my_class.h"), true);
    assertEquals(contents.length, 171);
    const cursor = tu.getCursor();
    assertEquals(cursor.getBriefCommentText(), "");
    //console.log(cursor.kind);

    cursor.visitChildren((cursor) => {
      //console.log(cursor.kind);
      return CXChildVisitResult.CXChildVisit_Recurse;
    });

    tu2.getCursor().visitChildren((cursor) => {
      switch (cursor.kind) {
        case CXCursorKind.CXCursor_Namespace:
        case CXCursorKind.CXCursor_ClassDecl:
          return CXChildVisitResult.CXChildVisit_Recurse;
        case CXCursorKind.CXCursor_CXXMethod:
          console.log(cursor.getPlatformAvailability());
          console.log(cursor.getCXXManglings());
      }
      console.log(cursor.getKindSpelling());
      return CXChildVisitResult.CXChildVisit_Continue;
    });

    assertThrows(() => CXDiagnosticSet.loadDiagnostics("test-diag.foo"));

    //console.log(tu.getAllSkippedRanges());
    const resourceUsage = tu.getResourceUsage();
    const length = resourceUsage.length;
    //console.log("ResourceUsage length:", length);
    for (let i = 0; i < length; i++) {
      //console.log(resourceUsage.at(i));
    }
    resourceUsage.dispose();
    tu.dispose();
    tu2.dispose();
  });
});
