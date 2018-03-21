#!/usr/bin/env bash
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)

FILTER="dev"
commonDir="$(dirname $CURRENT)/common"
$commonDir/rmChaincodeContainer.sh container $FILTER
$commonDir/rmChaincodeContainer.sh image $FILTER
docker system prune --force
