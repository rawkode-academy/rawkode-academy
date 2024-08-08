#!/bin/bash -e
NODE_VERSION="16.15.0"
ARCH="x64"
uname -a

echo "downloading node"
curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.gz"
echo "creating temp folder"
mkdir -p /tmp/node
echo "extracting files"
tar -xzf "node-v$NODE_VERSION-linux-$ARCH.tar.gz" -C /tmp/node --strip-components=1 --no-same-owner
echo "updating PATH"
export PATH="$PATH:/tmp/node/bin"
echo "checking node version"
node --version
echo "checking npm version"
npm --version

echo "installing everything"
npm i
echo "synthesise"
npm run synth
echo "cleanup"
rm -rf node_modules
echo "moving files to top level"
mv cdktf.out/stacks/dns/* .
terraform init
