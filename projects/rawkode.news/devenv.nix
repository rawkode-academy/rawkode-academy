{ pkgs, ... }:
{
  name = "rawkode-news";

  dotenv.disableHint = true;

  cachix.enable = false;

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
  };
  languages.typescript.enable = true;

  packages = [ pkgs.bun ];

  enterShell = ''
    bun install
  ''
  + pkgs.lib.optionalString pkgs.stdenv.isLinux ''
    export LD_LIBRARY_PATH=${pkgs.libgccjit}/lib:$LD_LIBRARY_PATH

    __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
    if [[ -f "$__patchTarget" ]]; then
      ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
    fi
  '';
}
