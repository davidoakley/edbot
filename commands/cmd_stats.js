const data = require('../modules/data');
// const tools = require('../modules/tools');

// function getStats() {
// 	var response = "";

//     // var systemCount = 0;
//     // var cursor = 0;

//     data.getSystemCount().then(function (count) {
//     })

// 	return response;
// }

module.exports = {
	name: 'stats',
	description: 'Get statistics about edbot',
    execute: function(message) {
        if (message.author.id != '78955103381360640') {
            message.channel.send("Sorry, only Nightstorm can ask me about statistics. 🤭");
        }

        // message.channel.startTyping();

        // var response = getStats();
        data.getSystemCount().then(function (count) {
            message.channel.send("I know about " + count + " star systems");
        });
        data.getFactionCount().then(function (count) {
            message.channel.send("I know about " + count + " minor factions");
        });
	}
};