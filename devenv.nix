{
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };
  languages.typescript.enable = true;

  scripts.dmno.exec = ''
    bunx dmno "$@";
  '';
}
