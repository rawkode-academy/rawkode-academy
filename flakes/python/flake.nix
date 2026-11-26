{
  description = "Rawkode Academy Python development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { nixpkgs, ... }:
    {
      devShells =
        nixpkgs.lib.genAttrs
          [
            "x86_64-linux"
            "aarch64-linux"
            "aarch64-darwin"
          ]
          (
            system:
            let
              pkgs = nixpkgs.legacyPackages.${system};
            in
            {
              default = pkgs.mkShell {
                packages = with pkgs; [
                  python3
                  uv
                ];

                # uv uses the Python from this shell: the interpreters it downloads
                # do not run on NixOS. Wheels with native code need zlib and the
                # C++ runtime on Linux.
                shellHook = ''
                  export UV_PYTHON="${pkgs.python3}/bin/python3"
                  export UV_PYTHON_DOWNLOADS=never
                ''
                + pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
                  export LD_LIBRARY_PATH="${
                    pkgs.lib.makeLibraryPath [
                      pkgs.zlib
                      pkgs.stdenv.cc.cc.lib
                    ]
                  }''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
                '';
              };
            }
          );
    };
}
