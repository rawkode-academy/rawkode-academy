{ pkgs, lib, config, inputs, ... }:
{
  languages.javascript.enable = true;
	languages.typescript.enable = true;

  packages = with pkgs; [ biome ];
}
