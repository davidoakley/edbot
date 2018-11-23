const data = require('../modules/data');

module.exports = {
	name: 'edloadfromfile',
	description: 'Bootstrap system information from a file',
	execute(message, command, args) {
	const systemCount = data.loadFromFile();
	message.channel.send("Loaded data for " + systemCount + " systems");
	},
};