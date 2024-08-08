{ pkgs, ... }:
{
  languages.javascript = {
		enable = true;
		npm.enable = true;
		bun.enable = true;
	};

	languages.terraform.enable	= true;

	packages = with pkgs; [
		just
	];
}
