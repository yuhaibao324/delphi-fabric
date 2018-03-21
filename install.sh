#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)
fcn=$1

function cn() {
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh cn
	sudo apt -qq install -y moreutils
	npm install
}
function gitSync() {
	git pull
	git submodule update --init --recursive
}

if [ -n "$fcn" ]; then
	$fcn
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh
	# write to config: jq do not support in-place editing, use moreutils:sponge
	sudo apt -qq install -y moreutils
	npm install
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
fi
