## Deno libclang C API bindings

Deno bindings to the C lang library C API. The project aims to provide complete
C API bindings for `libclang.so.14.0.6`. The bindings are meant to be close to
the original API, while adding garbage collection, adding some JavaScript
convenience APIs, prettifying some API names (f.ex. expanding `Attr` to
`Attribute`, `Param` to `Parameter` etc.) and of course, wrapping the raw Deno
FFI API with a more idiomatic and fully typed TypeScript API.

The Deno FFI binding declarations are generated automatically by `libclang-deno`
build script which uses the library's APIs to implement a basic C header walker,
complete with comment JSDoc'ifying.

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
