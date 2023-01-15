## libclang

Deno bindings for [Clang](https://clang.llvm.org/)'s C API `libclang`. Full
project details are found on the
[libclang-deno GitHub page](https://github.com/aapoalas/libclang-deno).

### Startup

To use `libclang` in your Deno program, import the `mod.ts` file into your
program:

```ts
import * as libclang from "https://deno.land/x/libclang@1.0.0-beta.3/mod.ts";
```

You must run your program with the `LIBCLANG_PATH` environment variable set to
either the direct path to your `libclang.so` / `libclang.dll` / `libclang.dylib`
shared library or to the folder in which the shared library resides. If the
environment variable is not set, the import will fail.

### Basic usage

The following code will walk through all the cursors in a given header and log
their kind and spelling:

```ts
import * as libclang from "https://deno.land/x/libclang@1.0.0-beta.3/mod.ts";

const index = new libclang.CXIndex();

const tu = index.parseTranslationUnit("/path/to/header.h", [
  "-I/path/to/include",
]);

tu.getCursor().visitChildren((cursor) => {
  console.log(`${cursor.getKindSpelling()}: ${cursor.getSpelling()}`);
  return libclang.CXChildVisitResult.CXChildVisit_Recurse;
});
```
