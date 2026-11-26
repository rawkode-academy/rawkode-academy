{
  description = "Rawkode Academy workerd (Cloudflare Workers runtime) development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      # The workerd binary that npm installs names an ELF interpreter that is
      # absent on NixOS. prepare-workerd points every copy between the current
      # directory and the filesystem root at this shell's glibc. It leaves a
      # binary alone when its interpreter exists, so it does nothing on other
      # Linux distributions, and it is empty on macOS.
      prepareWorkerd =
        pkgs:
        pkgs.writeShellScriptBin "prepare-workerd" (
          ''
            set -e
          ''
          + pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
            dir="$PWD"
            while :; do
              for target in "$dir"/node_modules/@cloudflare/workerd-linux-*/bin/workerd; do
                [ -f "$target" ] || continue
                interpreter="$(${pkgs.patchelf}/bin/patchelf --print-interpreter "$target" 2>/dev/null || true)"
                if [ -z "$interpreter" ] || [ ! -e "$interpreter" ]; then
                  ${pkgs.patchelf}/bin/patchelf --set-interpreter \
                    ${pkgs.stdenv.cc.bintools.dynamicLinker} "$target"
                fi
              done
              [ "$dir" = / ] && break
              dir="$(dirname "$dir")"
            done
          ''
        );
    in
    {
      packages = forAllSystems (system: {
        default = prepareWorkerd nixpkgs.legacyPackages.${system};
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          prepare = prepareWorkerd pkgs;
        in
        {
          default = pkgs.mkShell {
            packages = [ prepare ];

            # Native dependencies need the C++ runtime on Linux.
            shellHook =
              pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
                export LD_LIBRARY_PATH="${
                  pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]
                }''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
              ''
              + ''
                ${prepare}/bin/prepare-workerd
              '';
          };
        }
      );
    };
}
