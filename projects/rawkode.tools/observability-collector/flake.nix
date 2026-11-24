{
  description = "Rawkode Academy observability collector development environment";

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
          # basin/relabel-history.py. Partitioned writes need pyiceberg-core.
          python = pkgs.python3.withPackages (p: [
            p.pyarrow
            p.pyiceberg
            p.pyiceberg-core
          ]);
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              curl
              nixfmt-rfc-style
              nodejs_24
              python
            ];
          };
        });
    };
}
