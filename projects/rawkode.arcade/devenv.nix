{ pkgs, ... }:
{
  name = "rawkode.arcade";

  dotenv.disableHint = true;
  cachix.enable = false;

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
  };
  languages.typescript.enable = true;

  packages = with pkgs; [
    bun
  ];
}
