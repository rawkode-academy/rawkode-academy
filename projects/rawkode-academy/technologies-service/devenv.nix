{ inputs, pkgs, ... }:
{
  languages.nix.enable = true;

  languages.javascript = {
    enable = true;
    bun.enable = true;
  };

  languages.typescript.enable = true;

  packages = with pkgs; [
    biome
    hurl
    just
    runme
    sqld
    turso-cli
  ];

  env = {
    TURSO_URL = "http://127.0.0.1:5000";
    TURSO_TOKEN = "";
  };

  processes = {
    turso = {
      exec = "sqld --http-listen-addr 127.0.0.1:5000 --enable-http-console";
      process-compose = {
        readiness_probe = {
          initial_delay_seconds = 2;
          http_get = {
            path = "/health";
            port = 5000;
          };
        };
      };
    };

    grafbase = {
      exec = "just dev";
      process-compose = {
        availability = {
          exit_on_end = false;
        };
        depends_on = {
          turso = {
            condition = "process_healthy";
          };
        };
      };
    };
  };

  # See: https://github.com/cloudflare/workerd/issues/1482
  enterShell = ''
        bun install

    		turso config set autoupdate off

        __patchTarget="./node_modules/@cloudflare/workerd-linux-64/bin/workerd"
        if [[ -f "$__patchTarget" ]]; then
            ${pkgs.patchelf}/bin/patchelf --set-interpreter ${pkgs.glibc}/lib/ld-linux-x86-64.so.2 "$__patchTarget"
        fi
  '';
}
