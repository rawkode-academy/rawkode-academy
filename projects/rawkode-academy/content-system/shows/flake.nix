{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    devenv.url = "github:cachix/devenv";
  };

  nixConfig = {
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs = { self, nixpkgs, devenv, systems, ... } @ inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      packages = forEachSystem (system: {
        devenv-up = self.devShells.${system}.default.config.procfileScript;
      });

      devShells = forEachSystem
        (system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
          in
          {
            default = devenv.lib.mkShell {
              inherit inputs pkgs;
              modules = [
                {
                  languages.nix.enable = true;

                  packages = with pkgs;  [
                    bun
                    nixpkgs-fmt

                    # Grafbase currently uses node under the hood and only 18
                    # works. We can remove this when Bun support is added.
                    nodejs_18
                    turso-cli
                  ];

                  processes = {
                    turso.exec = "turso dev --port 4021";
                    grafbase.exec = "just dev";
                  };

                  enterShell = ''
                    turso config set autoupdate off
                  '';
                }
              ];
            };
          });
    };
}
