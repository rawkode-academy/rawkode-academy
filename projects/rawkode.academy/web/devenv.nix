{ pkgs, ... }:

{
  name = "web.rawkode.academy";

  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
  };
  languages.typescript.enable = true;

  packages = with pkgs; [
    bun
    nixfmt-rfc-style
  ];

  enterShell = ''
    deno install
    __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
    if [[ -f "$__patchTarget" ]]; then
    ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
    fi
  '';
}
