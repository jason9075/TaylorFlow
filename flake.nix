{
  description = "gfx-lab — TaylorFlow: Taylor Series visualiser";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodePackages.live-server
            just
          ];
          shellHook = ''
            echo "gfx-lab / TaylorFlow ready. Run: just dev"
          '';
        };
      });
}
