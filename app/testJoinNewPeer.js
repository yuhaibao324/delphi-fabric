// prepare MSP for this node
const helper = require('./helper')
const logger = helper.getLogger('join-new-peer')
const caAgent = require('./ca-client')
const joinChannel = require('./join-channel').joinChannel

exports.caGen = (peerName, orgName) => {
	let promise = caAgent.genPeerMSP({ peerName, orgName })
	const tls = helper.helperConfig.delphi.TLS
	logger.debug({ tls })
	if (tls) {
		promise = promise.then(() => caAgent.genPeerTLS({ peerName, orgName }))
	}
	return promise.then((data) => {
		logger.info('ok')
		return data
	}).catch(err => {
		logger.error(err)
		return err
	})
}
const channelName = 'delphiChannel'
exports.joinChannel = (peerPort, eventHubPort, tls_caCRT, peer_hostName_full, orgName) => {
	const peer = helper.newPeer({ peerPort, tls_cacerts: tls_caCRT, peer_hostName_full })
	peer.peerConfig = { eventHubPort }
	const peers = [peer]

	const channel = helper.getChannel(channelName)
	return joinChannel(channel, peers, orgName).catch(err => {
		logger.error(err)
		return err
	})
}


