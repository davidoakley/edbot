const data = require('../data');

module.exports = {
	name: 'edloadfromfile',
	description: 'Bootstrap system information from a file',
	execute(message) {
	const systemCount = data.loadFromFile();
	message.channel.send("Loaded data for " + systemCount + " systems");
	},
};