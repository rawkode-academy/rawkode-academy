{
  description = "Rawkode Academy website development environment";

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
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              biome
              bun
              d2
              nixfmt-rfc-style
              nodejs_24
            ];

            shellHook = ''
              bun install
            '' + pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              export LD_LIBRARY_PATH=${pkgs.libgccjit}/lib:$LD_LIBRARY_PATH

              # workerd ships an ELF interpreter path that is absent on NixOS.
              __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
              if [ -f "$__patchTarget" ]; then
                ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
              fi
            '';
          };
        });
    };
}
