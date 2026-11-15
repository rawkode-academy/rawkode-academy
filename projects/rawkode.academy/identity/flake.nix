{
  description = "Rawkode Academy identity development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # Bun's workerd package ships an ELF interpreter path that is absent
          # on NixOS. Patch only that host case, after dependencies exist.
          prepareWorkerd = pkgs.writeShellScript "identity-prepare-workerd" (
            ''
              set -e
            '' + pkgs.lib.optionalString (system == "x86_64-linux") ''
              if [ ! -e /lib64/ld-linux-x86-64.so.2 ]; then
                for target in \
                  ./node_modules/@cloudflare/workerd-linux-64/bin/workerd \
                  ../../../node_modules/@cloudflare/workerd-linux-64/bin/workerd; do
                  if [ -f "$target" ]; then
                    ${pkgs.patchelf}/bin/patchelf --set-interpreter \
                      ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$target"
                  fi
                done
              fi
            '' + pkgs.lib.optionalString (system == "aarch64-linux") ''
              if [ ! -e /lib/ld-linux-aarch64.so.1 ]; then
                for target in \
                  ./node_modules/@cloudflare/workerd-linux-arm64/bin/workerd \
                  ../../../node_modules/@cloudflare/workerd-linux-arm64/bin/workerd; do
                  if [ -f "$target" ]; then
                    ${pkgs.patchelf}/bin/patchelf --set-interpreter \
                      ${pkgs.glibc}/lib/ld-linux-aarch64.so.1 "$target"
                  fi
                done
              fi
            ''
          );
          identityBun = pkgs.writeShellScriptBin "identity-bun" ''
            set -e
            ${prepareWorkerd}
            exec ${pkgs.bun}/bin/bun "$@"
          '';
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              biome
              bun
              identityBun
              nixfmt-rfc-style
              nodejs_24
            ];

            # Native dependencies need the C++ runtime on Linux.
            LD_LIBRARY_PATH = pkgs.lib.optionalString pkgs.stdenv.isLinux
              (pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib ]);
            shellHook = ''
              ${prepareWorkerd}
            '';
          };
        });
    };
}
