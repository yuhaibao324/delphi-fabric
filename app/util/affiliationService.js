const logger = require('./logger').new('affiliationService')
exports.creatIfNotExist = (affiliationService, {name, force = false}, adminUser) => {
	return affiliationService.getOne(name, adminUser).catch(err => {
		if (err.toString().includes('Failed to get Affiliation')){
			return affiliationService.create({name, force}, adminUser);
		} else {
			return Promise.reject(err);
		}
	});
};