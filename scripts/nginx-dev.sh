#!/usr/bin/env sh
# start a dev nginx server

cd $(git rev-parse --show-toplevel)

nix-shell -p fish --run "fish ./scripts/generate-indexes.fish"

wget https://raw.githubusercontent.com/nginx/nginx/refs/heads/master/conf/mime.types
nix-shell -p nginx --run "sudo nginx -c $(pwd)/nginx.conf"
rm mime.types
