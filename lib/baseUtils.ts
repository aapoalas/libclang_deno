import { join } from "jsr:@std/path";

export const tryLoadLibclang = <
  const Imports extends Deno.ForeignLibraryInterface,
>(
  libclangPath: string,
  imports: Imports,
): ReturnType<
  typeof Deno.dlopen<Imports>
> => {
  if (Deno.build.os === "windows") {
    if (libclangPath.includes(".dll")) {
      return Deno.dlopen(libclangPath, imports);
    } else {
      return Deno.dlopen(
        join(libclangPath, "libclang.dll"),
        imports,
      );
    }
  } else if (Deno.build.os === "darwin") {
    if (libclangPath.includes(".dylib")) {
      return Deno.dlopen(libclangPath, imports);
    } else {
      return Deno.dlopen(
        join(libclangPath, "libclang.dylib"),
        imports,
      );
    }
  } else {
    const isFullPath = libclangPath.includes(".so");
    if (isFullPath) {
      // if LIBCLANG_PATH point to a so file, we try to load it directly
      return Deno.dlopen(libclangPath, imports);
    } else {
      // Try various known libclang shared object names.
      const errors: Error[] = [];
      for (
        const file of [
          "libclang.so",
          "libclang.so.20",
          "libclang.so.20.1",
          "libclang.so.20.1.7",
          "libclang.so.19",
          "libclang.so.19.1",
          "libclang.so.19.1.7",
          "libclang.so.18",
          "libclang.so.18.1",
          "libclang.so.18.1.8",
          "libclang.so.17",
          "libclang.so.17.0",
          "libclang.so.17.0.6",
          "libclang.so.16",
          "libclang.so.16.0",
          "libclang.so.16.0.6",
          "libclang-14.so.1",
          "libclang.so.14.0.6",
          "libclang.so.14",
          "libclang.so.13",
        ]
      ) {
        const fullpath = join(libclangPath, file);
        try {
          return Deno.dlopen(fullpath, imports);
        } catch (e) {
          errors.push(e instanceof Error ? e : new Error(JSON.stringify(e)));
        }
      }
      throw new AggregateError(
        errors,
        "Failed to load libclang by various known shared object names",
      );
    }
  }
};
