{ pkgs, lib, config, inputs, ... }:

{
  packages = with pkgs; [ ffmpeg ];

  languages.python = {
    enable = true;
    venv.enable = true;
    uv = {
      enable = true;
      sync.enable = true;
    };
  };

  env.LD_LIBRARY_PATH = lib.makeLibraryPath (with pkgs; [ 
    libz 
    stdenv.cc.cc.lib
  ]);
}

