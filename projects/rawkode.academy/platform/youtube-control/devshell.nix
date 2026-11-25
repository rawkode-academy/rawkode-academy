{ pkgs, base }:
# cuenv's Nix runtime enters this shell for every task: Node for the Worker and
# its tests, Python with google-auth-oauthlib for `cuenv task consent`, and gh
# to start the deploy afterwards.
pkgs.mkShell {
  inputsFrom = [ base ];
  packages = with pkgs; [
    (python3.withPackages (p: [ p.google-auth-oauthlib ]))
    gh
    curl
    jq
  ];
}
