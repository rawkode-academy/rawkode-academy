{ pkgs, ... }:
{
	name = "rawkode-studio";

	dotenv.disableHint = true;

	cachix.enable = false;

	languages.javascript = {
		enable = true;
		package = pkgs.nodejs_24;
	};
	languages.typescript.enable = true;

	packages = [
		pkgs.bun
	];
}
