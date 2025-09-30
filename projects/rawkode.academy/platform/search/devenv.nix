{ pkgs, ... }:
{
  languages.rust.enable = true;
  packages = with pkgs; [
    cargo-shuttle
    pkg-config
    openssl
  ];
}
