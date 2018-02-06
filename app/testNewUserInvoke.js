// Also related to identities, you should make a decision on whether Fabric-CA should be part of your solution. This is a server with REST APIs that supports dynamic identity management with registration, enrollment (getting certificates), revocation and re-enrollment. So it is very useful in providing user identities on the fly. But note that user identities provisioned this way are only of the MEMBER role in the fabric, which means it won't be able to perform certain operations reserved for the ADMIN role:
//
// create/update channel
// install/instantiate chaincode
// query installed/instantiated chaincodes
//
// For these privileged operations, the client must use an ADMIN user to submit the request

const helper = require('./helper')
const logger = require('./util/logger').new('caUser-invoke')
const fs = require('fs')
const fsExtra = require('fs-extra')
const caUtil = require('./util/ca')
const caHelper = require('./caHelper')
const globalConfig = require('../config/orgs.json')
const ClientUtil = require('./util/client')

const companyConfig = globalConfig
const CRYPTO_CONFIG_DIR = companyConfig.docker.volumes.MSPROOT.dir
const COMPANY_DOMAIN = companyConfig.domain
const orgsConfig = companyConfig.orgs

const path = require('path')

/**
 *
 * @param username
 * @param orgName
 * @param client
 * @param {boolean} TLS
 */
const setCAUser = (client, { username, orgName, TLS }) => {
	const caConfig = orgsConfig[orgName].ca
	const caService = caHelper.getCaService({ orgName, TLS })
	//this admin is not generated by cryptogen
	const MSPID = orgsConfig[orgName].MSP.id

	const org_domain = `${orgName}.${COMPANY_DOMAIN}`
	const orgPath = path.join(CRYPTO_CONFIG_DIR, 'peerOrganizations', org_domain)
	const targetDir = TLS ? 'tls' : 'msp'

	const userRoot = path.join(orgPath, 'users', helper.formatUsername(username, orgName))
	const userTarget = path.join(userRoot, targetDir)

	return caHelper.setCAAdmin(client, { orgName, TLS }).then((adminUser) => {

		fsExtra.ensureDirSync(userTarget)
		const passwordFile = `${userTarget}/pwdFile` // fixme: file with password content security issue
		const affiliation = orgName.toLowerCase()

		const enrollAnyWay = (password) => {
			return caUtil.user.enroll(caService, { username: helper.formatPeerName(username, orgName), password }).
					then((result) => {

						//fixme bug design in CryptoSuite_ECDSA_AES.importKey

						const client = ClientUtil.new();
						return caUtil.user.build(helper.formatUsername(username, orgName), result, MSPID).then((user) => {

							return client.setUserContext(user, true)
						})
					})
		}
		return caUtil.user.register(caService, { username: helper.formatPeerName(username, orgName), affiliation },
				adminUser).
				then((password) => {
					fs.writeFileSync(passwordFile, password)
					return enrollAnyWay(password)
				}).catch(err => {
					if (err.toString().includes('"code":0')) {
						logger.warn(err)
						const password = fs.readFileSync(passwordFile).toString()

						//[[{"code":0,"message":"Identity 'peerF' is already registered"}]]
						return enrollAnyWay(password)
					} else {
						return Promise.reject(err)
					}
				})

	})
}

let retry = 0
const { invoke } = require('./invoke-chaincode')
const testInvoke = () => {
	const client = ClientUtil.new()
	const orgName = 'BU'
	return setCAUser(client, { username: 'userB', orgName, TLS: companyConfig.TLS }).then(() => {
		const channelName = 'delphiChannel'
		const channel = helper.prepareChannel(channelName, client, true)

		const peers = helper.newPeers([0], orgName)
		const chaincodeId = 'adminChaincode'
		const fcn = ''
		const args = []
		return invoke(channel, peers, { chaincodeId, fcn, args }).
				then(require('./util/chaincode').reducer).
				then((result) => {logger.info(result)})
	}).catch(err => {
		if (err.toString().includes('Failed to deserialize creator identity')) {
			retry++// retry case: <180s
			logger.warn({ retry })
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					resolve(testInvoke())
				}, 1000)

			})

		} else {
			logger.error(err)
			return Promise.reject(err)
		}
	})
}
testInvoke()

