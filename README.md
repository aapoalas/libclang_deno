## Deno libclang C API bindings

Deno bindings to the C lang library C API. The project aims to provide complete
C API bindings for `libclang.so.14.0.6`. The bindings are meant to be close to
the original API, while adding garbage collection, adding some JavaScript
convenience APIs, prettifying some API names (f.ex. expanding `Attr` to
`Attribute`, `Param` to `Parameter` etc.) and of course, wrapping the raw Deno
FFI API with a more idiomatic and fully typed TypeScript API.

The Deno FFI binding declarations are generated automatically by `libclang-deno`
build script which uses the library's APIs to implement a basic C header walker,
complete with comment JSDoc'ifying. Check out
[https://github.com/aapoalas/libclang-deno/blob/main/build/build.ts](build.ts)
for the ugly details.

## Starting up

To find `libclang`, the library uses the `LIBCLANG_PATH` environment variable.
This variable can either contain the direct path to a libclang shared library or
a path to the directory containing the shared library. To read the environment
variable the library naturally needs the `--allow-env=LIBCLANG_PATH` Deno
permissions flag.

Additionally, as with all FFI libraries at this moment, the library of course
needs the `--unstable` and `--allow-ffi` flags. Unfortunately, at present it is
not enough to give a limited FFI permission flag to just the libclang shared
library, eg. `--allow-ffi=/lib64/libclang.so.14.0.6` as the library needs to use
some Deno FFI APIs beyond `dlopen`, and those currently require unrestricted FFI
permissions.

An example startup:

```sh
LIBCLANG_PATH=/lib64 deno run --unstable --allow-env=LIBCLANG_PATH --allow-ffi lib/mod.ts
```

### Entry points and memory management

The main entry point into the libclang API is the `CXIndex` and its
`parseTranslationUnit` API which matches the `clang_parseTranslationUnit2` C
API. Once a `CXTranslationUnit` is created using that API, then its APIs are
used to f.ex. get `CXFile` instances or a `CXCursor` to traverse the AST.

All classes in `libclang-deno` are garbage collected, releasing the underlying C
memory when the JavaScript object gets garbage collected. If you want to speed
up memory releasing, some of the classes have an explicit `dispose()` method
that can be called to synchronously release their memory. Note that unlike the C
API, the classes may perform disposing recursively, releasing memory and
disabling usage of dependent instances. As an example, calling the `dispose()`
method of `CXIndex` will also dispose of all `CXTranslationUnit`s owned by the
index, which will in turn dipose of all `CXFile`s created from those.
