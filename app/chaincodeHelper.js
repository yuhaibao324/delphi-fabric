const {randomKeyOf} = require('khala-nodeutils/random');
const {install,} = require('../common/nodejs/chaincode');
const {instantiateOrUpgrade, invoke} = require('../common/nodejs/chaincodeHelper');
const Logger = require('../common/nodejs/logger');
const ClientUtil = require('../common/nodejs/client');
const ChannelUtil = require('../common/nodejs/channel');
const EventHubUtil = require('../common/nodejs/eventHub');
const golangUtil = require('../common/nodejs/golang');
const {RoleIdentity, simplePolicyBuilder} = require('../common/nodejs/policy');
const {collectionPolicyBuilder, collectionConfig} = require('../common/nodejs/privateData');
const path = require('path');

const chaincodeConfig = require('../config/chaincode.json');

exports.prepareInstall = async ({chaincodeId}) => {
	const chaincodeRelPath = chaincodeConfig[chaincodeId].path;
	let metadataPath;
	let chaincodePath;
	const chaincodeType = chaincodeConfig[chaincodeId].type;
	const gopath = await golangUtil.getGOPATH();
	if (chaincodeType === 'node') {
		chaincodePath = path.resolve(gopath, 'src', chaincodeRelPath);
		metadataPath = path.resolve(chaincodePath, 'META-INF');//the name is arbitrary
	}
	if (!chaincodeType || chaincodeType === 'golang') {
		await golangUtil.setGOPATH();
		chaincodePath = chaincodeRelPath;
		metadataPath = path.resolve(gopath, 'src', chaincodeRelPath, 'META-INF');//the name is arbitrary
	}
	if (!chaincodeConfig[chaincodeId].couchDBIndex) {
		metadataPath = undefined;
	}

	return {chaincodeId, chaincodePath, chaincodeType, metadataPath};
};
exports.install = async (peers, {chaincodeId, chaincodeVersion}, client) => {
	const opt = await exports.prepareInstall({chaincodeId});
	opt.chaincodeVersion = chaincodeVersion;
	return install(peers, opt, client);
};

const buildEndorsePolicy = (config) => {
	const {n} = config;
	const identities = [];
	for (const [mspid, type] of Object.entries(config.mspId)) {
		identities.push(RoleIdentity(mspid, type));
	}
	return simplePolicyBuilder(identities, n);
};
/**
 * this should apply to both instantiate and upgrade
 */
const configParser = (config) => {
	const {endorsingConfigs, collectionConfigs} = config;
	const result = {};
	if (endorsingConfigs) {
		result.endorsementPolicy = buildEndorsePolicy(endorsingConfigs);
	}
	if (collectionConfigs) {
		const collectionSet = [];
		for (const [name, config] of Object.entries(collectionConfigs)) {
			const policy = collectionPolicyBuilder(config.mspIds);
			config.name = name;
			config.policy = policy;
			collectionSet.push(collectionConfig(config));
		}
		result.collectionConfig = collectionSet;
	}
	return result;

};
const defaultProposalTime = 45000;
exports.instantiate = async (channel, richPeers, opts) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig[chaincodeId]);

	const {eventWaitTime} = channel;

	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}

	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('deploy', channel, richPeers, eventHubs, allConfig, proposalTimeout, eventWaitTime,);
};

exports.upgrade = async (channel, richPeers, opts) => {
	const {chaincodeId} = opts;
	const policyConfig = configParser(chaincodeConfig[chaincodeId]);

	const {eventWaitTime} = channel;
	const eventHubs = [];

	for (const peer of richPeers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	const allConfig = Object.assign(policyConfig, opts);
	const proposalTimeout = richPeers.length * defaultProposalTime;
	return instantiateOrUpgrade('upgrade', channel, richPeers, eventHubs, allConfig, proposalTimeout, eventWaitTime,);
};
exports.invoke = async (channel, peers, {chaincodeId, fcn, args, transientMap}, nonAdminUser) => {
	const eventHubs = [];
	for (const peer of peers) {
		const eventHub = EventHubUtil.newEventHub(channel, peer, true);
		eventHubs.push(eventHub);
	}
	const orderers = channel.getOrderers();
	const orderer = orderers[randomKeyOf(orderers)];
	if (nonAdminUser) {
		const client = ClientUtil.new();
		await client.setUserContext(nonAdminUser, true);
		ChannelUtil.setClientContext(channel, client);
	}

	const proposalTimeout = peers.length * defaultProposalTime;

	try {
		return await invoke(channel, peers, eventHubs, {
			chaincodeId,
			args,
			fcn,
			transientMap,
		}, orderer, proposalTimeout);
	} catch (e) {
		for (const eventHub of eventHubs) {
			EventHubUtil.disconnect(eventHub);
		}
		throw e;
	}

};