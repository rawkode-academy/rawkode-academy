{ pkgs, base }:
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = with pkgs; [
    ffmpeg
    python3
    uv
  ];

  # uv manages the project's venv from pyproject.toml and uv.lock (`uv sync`),
  # but must use this Nix Python, never a downloaded one.
  UV_PYTHON_DOWNLOADS = "never";
  UV_PYTHON = "${pkgs.python3}/bin/python";

  shellHook = ''
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.zlib pkgs.stdenv.cc.cc.lib ]}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  '';
}
