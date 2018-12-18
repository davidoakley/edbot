const data = require('../modules/data');
const fs = require('fs');

module.exports = {
	name: 'log',
	description: 'Log incoming eddn data for 1 minute',
    execute: function(message) {
        if (message.author.id != '78955103381360640') {
            message.channel.send("Sorry, only Nightstorm can ask me to log things. 🤭");
            return;
        }

        message.channel.send("Starting to log EDDN data...");
        message.channel.startTyping();

        try {
            fs.unlinkSync('data/eddn_data_log.txt');
        } catch (e) {
            console.log("No existing log file to delete");
        }

        global.logStream = fs.createWriteStream('data/eddn_data_log.txt');

        setTimeout(function() {
            global.logStream.end();
            global.logStream = null;
            message.channel.send("Finished logging EDDN data.", { file: "https://crimsonstate.group/edbot_data/eddn_data_log.txt" });
            message.channel.stopTyping();
        }, 60*1000);
	}
};