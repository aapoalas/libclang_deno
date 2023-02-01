/**
 * Tests that libclang can be loaded in the given environment.
 */

import { assert } from "https://deno.land/std@0.163.0/testing/asserts.ts";

Deno.test("Startup", async (t) => {
  await t.step({
    name: "with LIBCLANG_PATH pointing to a file",
    ignore: !Deno.env.get("TEST_PATH"),
    fn: () => {
      const output = new Deno.Command("deno", {
        args: [
          "run",
          "--unstable",
          "--allow-ffi",
          "--allow-env=LIBCLANG_PATH",
          "./lib/mod.ts",
        ],
        env: {
          LIBCLANG_PATH: Deno.env.get("TEST_PATH")!,
        },
      }).outputSync();

      assert(output.success);
    },
  });

  await t.step({
    name: "with LIBCLANG_PATH pointing to a directory",
    ignore: !Deno.env.get("TEST_DIR"),
    fn: () => {
      const output = new Deno.Command("deno", {
        args: [
          "run",
          "--unstable",
          "--allow-ffi",
          "--allow-env=LIBCLANG_PATH",
          "./lib/mod.ts",
        ],
        env: {
          LIBCLANG_PATH: Deno.env.get("TEST_DIR")!,
        },
      }).outputSync();

      assert(output.success);
    },
  });
});
