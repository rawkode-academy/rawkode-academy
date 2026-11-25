# Base dev shell for the whole monorepo. Every project's shell extends it with
# `inputsFrom = [ base ]`, so anything here is available everywhere.
{ pkgs }:
let
  # Bun's workerd package ships an ELF interpreter path that is absent on
  # NixOS. Patch only that host case, once dependencies exist. Idempotent, and
  # exposed as `prepare-workerd` so wrappers can run it right after `bun install`.
  interpreter =
    {
      x86_64-linux = {
        loader = "/lib64/ld-linux-x86-64.so.2";
        dir = "workerd-linux-64";
        glibcLoader = "${pkgs.glibc}/lib/ld-linux-x86-64.so.2";
      };
      aarch64-linux = {
        loader = "/lib/ld-linux-aarch64.so.1";
        dir = "workerd-linux-arm64";
        glibcLoader = "${pkgs.glibc}/lib/ld-linux-aarch64.so.1";
      };
    }
    .${pkgs.stdenv.hostPlatform.system} or null;

  prepareWorkerd = pkgs.writeShellScriptBin "prepare-workerd" (
    ''
      set -e
    ''
    + pkgs.lib.optionalString (interpreter != null) ''
      if [ ! -e ${interpreter.loader} ]; then
        root="$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)"
        for target in \
          ./node_modules/@cloudflare/${interpreter.dir}/bin/workerd \
          "$root/node_modules/@cloudflare/${interpreter.dir}/bin/workerd"; do
          if [ -f "$target" ]; then
            ${pkgs.patchelf}/bin/patchelf --set-interpreter ${interpreter.glibcLoader} "$target"
          fi
        done
      fi
    ''
  );
in
pkgs.mkShell {
  packages = [
    pkgs.bun
    pkgs.nodejs_24
    pkgs.nixd
    pkgs.nixfmt
    prepareWorkerd
  ];

  # Native dependencies need the C++ runtime on Linux. Appended, not assigned,
  # so shells layered on top keep adding to it.
  shellHook = ''
    ${pkgs.lib.optionalString pkgs.stdenv.isLinux ''
      export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    ''}
    prepare-workerd
  '';
}
