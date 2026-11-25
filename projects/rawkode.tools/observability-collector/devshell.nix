{ pkgs, base }:
let
  # Local one-off table rewrites (PyIceberg). Partitioned writes need pyiceberg-core.
  python = pkgs.python3.withPackages (p: [
    p.pyarrow
    p.pyiceberg
    p.pyiceberg-core
  ]);
in
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = [
    pkgs.curl
    python
  ];
}
