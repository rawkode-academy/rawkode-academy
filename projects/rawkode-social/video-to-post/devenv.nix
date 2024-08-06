{ pkgs, ... }:

{
  # We use this for Marimo's AI Assistant
  languages.javascript.enable = true;

  languages.python = {
    enable = true;
    uv.enable = true;
    venv = {
      enable = true;
      requirements = ./requirements.txt;
    };
  };

  packages = with pkgs; [
    ffmpeg
    just
    ruff
  ];
}
