import { argument, dag, type Directory, func, object } from "@dagger.io/dagger";

@object()
export class Studio {
  /**
   * Build the studio and get the output directory.
   */
  @func()
  async build(
    @argument({ defaultPath: ".", ignore: ["node_modules"] }) source: Directory,
  ): Promise<Directory> {
    return dag.bun()
      .withCache()
      .install(source)
      .withExec([
        "bun",
        "run",
        "build",
      ]).directory("dist");
  }
}
