const {create: createChannel} = require('./channelHelper');
const {join: joinChannel, updateAnchorPeers} = require('../common/nodejs/channel');

const helper = require('./helper');
const {projectResolve} = helper;
const logger = require('../common/nodejs/logger').new('testChannel');

const EventHubUtil = require('../common/nodejs/eventHub');
const {exec, sleep,fsExtra} = require('khala-nodeutils/helper');
const path = require('path');
const channelName = 'allchannel';

const globalConfig = require('../config/orgs.json');
const {TLS} = globalConfig;
const channelConfig = globalConfig.channels[channelName];
const Query = require('../common/nodejs/query');
const channelConfigFile = projectResolve(globalConfig.docker.volumes.CONFIGTX.dir, channelConfig.file);
const joinAllfcn = async (channelName) => {


	for (const orgName in channelConfig.orgs) {
		const {peerIndexes} = channelConfig.orgs[orgName];
		const peers = helper.newPeers(peerIndexes, orgName);

		const client = await helper.getOrgAdmin(orgName);

		const channel = helper.prepareChannel(channelName, client);
		for (const peer of peers) {

			const loopJoinChannel = async () => {
				try {
					return await joinChannel(channel, peer);
				} catch (err) {
					if (err.toString().includes('Invalid results returned ::NOT_FOUND')
						|| err.toString().includes('UNAVAILABLE')) {
						logger.warn('loopJoinChannel...');
						await new Promise(resolve => {
							setTimeout(() => {
								resolve(loopJoinChannel());
							}, 1000);
						});
					}
					else throw err;
				}
			};
			await loopJoinChannel();
		}
	}

};
const task = async () => {
	const ordererOrg = helper.randomOrg('orderer');
	const {portHost: ordererHostPort} = helper.findOrgConfig(ordererOrg);
	const ordererClient = await helper.getOrgAdmin(ordererOrg, 'orderer');
	const ordererUrl = `${TLS ? 'grpcs' : 'grpc'}://localhost:${ordererHostPort}`;
	const peerOrg = helper.randomOrg('peer');
	logger.info({ordererUrl, peerOrg});
	try {
		await createChannel(ordererClient, channelName, channelConfigFile, [peerOrg], ordererUrl);

		await joinAllfcn(channelName);

		await sleep(1000);
		for (const org in channelConfig.orgs) {
			await anchorPeersUpdate(path.resolve(__dirname, '../config/configtx.yaml'), channelName, org);
			await sleep(1000);//TODO wait block to broadcast
		}
	} catch (err) {
		if (err.toString().includes('Error: BAD_REQUEST') ||
			(err.status && err.status.includes('BAD_REQUEST'))) {
			//existing swallow
			await joinAllfcn(channelName);
		} else throw err;
	}

};
const anchorPeersUpdate = async (configtxYaml, channelName, orgName) => {
	const anchorTx = path.resolve(`${orgName}Anchors.tx`);
	const config_dir = path.dirname(configtxYaml);
	const runConfigtxGenShell = path.resolve(__dirname, '../common/bin-manage/runConfigtxgen.sh');
	const PROFILE = 'anchorPeers';
	await exec(`export FABRIC_CFG_PATH=${config_dir} && ${runConfigtxGenShell} genAnchorPeers ${anchorTx} ${PROFILE} ${channelName} ${orgName}`);

	const client = await helper.getOrgAdmin(orgName);

	const channel = helper.prepareChannel(channelName, client);
	const orderer = channel.getOrderers()[0];

	const peer = helper.newPeer(0, orgName);
	const {pretty: {height}} = await Query.chain(peer, channel);
	logger.info(peer.toString(), `current block height ${height}`);

	await updateAnchorPeers(channel, anchorTx, orderer);
	const eventHub = EventHubUtil.newEventHub(channel, peer, true);
	const block = await EventHubUtil.blockWaiter(eventHub, height);

};

task();





