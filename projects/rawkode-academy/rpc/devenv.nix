{ pkgs, ... }:
{
  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
		# Trigger.dev CLI needs npm
		npm.enable = true;
  };

  languages.typescript.enable = true;

  packages = with pkgs; [
    biome
    hurl
    just
  ];

  # See: https://github.com/cloudflare/workerd/issues/1482
  enterShell = ''
    bun install
    __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
    if [[ -f "$__patchTarget" ]]; then
    	${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
    fi
  '';
}
