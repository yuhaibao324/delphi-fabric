const helper = require('../app/helper');
const configtxlator = require('../common/nodejs/configtxlator');
const channelName = 'allchannel';
const {fsExtra} = require('khala-nodeutils/helper');
const logger = require('../common/nodejs/logger').new('test:configtxlator');
const appChannel = async () => {
	try {
		const peerClient = await helper.getOrgAdmin(undefined, 'peer'); //only peer user can read channel
		const channel = helper.prepareChannel(channelName, peerClient);
		const peer = channel.getPeers()[0];
		const {original_config} = await configtxlator.getChannelConfigReadable(channel, peer);

		fsExtra.outputFileSync(`${channelName}.json`, original_config);
	} catch (e) {
		logger.error(e);
	}
};
const systemChannel = async () => {
	try {
		const ordererOrg = helper.randomOrg('orderer');
		const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
		const channel = helper.prepareChannel(undefined, ordererClient);
		const {original_config} = await configtxlator.getChannelConfigReadable(channel);

		fsExtra.outputFileSync('testchainid.json', original_config);
	} catch (e) {
		logger.error(e);
	}
};
const flow = async () => {
	await appChannel();
	await systemChannel();
};
flow();



