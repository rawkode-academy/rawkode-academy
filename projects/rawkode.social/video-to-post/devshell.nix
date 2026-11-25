{ pkgs, base }:
# Enter with `nix develop .#video-to-post` from the repository root. Create the
# venv with `uv venv` then `uv pip install -r requirements.txt`.
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = with pkgs; [
    ffmpeg
    just
    python3
    ruff
    uv
  ];

  UV_PYTHON_DOWNLOADS = "never";
  UV_PYTHON = "${pkgs.python3}/bin/python";
}
