const {instantiate, upgrade} = require('./chaincodeHelper');
const helper = require('./helper');
const {nextVersion} = require('khala-nodeutils/version');
const {findLatest} = require('../common/nodejs/chaincodeVersion');
const channelName = 'allchannel';
exports.instantiate = async (clientPeerOrg, peers, chaincodeId, fcn, args = []) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	return instantiate(channel, peers, {fcn, chaincodeId, chaincodeVersion: nextVersion(), args});
};
exports.upgrade = async (clientPeerOrg, peers, chaincodeId, chaincodeVersion, fcn, args = []) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const channel = helper.prepareChannel(channelName, client, true);
	return upgrade(channel, peers, {fcn, chaincodeId, chaincodeVersion, args});
};

const Query = require('../common/nodejs/query');
exports.upgradeToLatest = async (clientPeerOrg, peer, chaincodeId, fcn, args = []) => {
	const client = await helper.getOrgAdmin(clientPeerOrg);
	const {chaincodes} = await Query.chaincodesInstalled(peer, client);
	const {version} = findLatest(chaincodes, chaincodeId);
	await exports.upgrade(clientPeerOrg, [peer], chaincodeId, version, fcn, args);
};