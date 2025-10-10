{ pkgs, ... }:
{
  name = "web.rawkode.academy";

  dotenv.disableHint = true;

  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
  };
  languages.typescript.enable = true;

  packages = with pkgs; [
    biome
    bun
    d2
    influxdb2
    nixfmt-rfc-style
  ];

  enterShell = ''
    export LD_LIBRARY_PATH=${pkgs.libgccjit}/lib:$LD_LIBRARY_PATH

    bun install

    __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
    if [[ -f "$__patchTarget" ]]; then
      ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
    fi
  '';
}

