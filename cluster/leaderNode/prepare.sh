#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)
root="$(dirname $(dirname $CURRENT))"
CONFIG_DIR="$root/config/"

SWARM_CONFIG="$CONFIG_DIR/swarm.json"

advertiseAddr="192.168.0.167"
if ! ip addr show | grep "inet ${advertiseAddr}";then
    echo advertiseAddr:$advertiseAddr is not one of IPs assinged to this machine
    ip addr show | grep "inet "
    exit 1
fi
### setup swarm
utilsDir=$root/common/docker/utils

$utilsDir/swarm.sh create $advertiseAddr
#This node is already part of a swarm. Use "docker swarm leave" to leave this swarm and join another one.
# use this to check string contains
#if [[ $string == *"My long"* ]]; then
#  echo "It's there!"
#fi
$utilsDir/swarm.sh view


thisHostName=$($root/common/ubuntu/hostname.sh get)

jq ".leaderNode.hostname=\"${thisHostName}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG
joinToken=$($root/common/docker/utils/swarm.sh managerToken)
jq ".leaderNode.managerToken=\"${joinToken}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG
jq ".leaderNode.ip=\"${advertiseAddr}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG


$root/cluster/prepare.sh

