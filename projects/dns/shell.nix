let
  unstable = import (fetchTarball https://nixos.org/channels/nixos-unstable/nixexprs.tar.xz) { };
in
{ nixpkgs ? import <nixpkgs> {} }:
with nixpkgs;
mkShell {
  buildInputs = [
    pulumi-bin
    dagger
  ];
}
