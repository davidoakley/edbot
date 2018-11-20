// https://discordapp.com/oauth2/authorize?&client_id=512352639107858432&scope=bot&permissions=8
var Discord = require('discord.io');
var logger = require('winston');
// var auth = require('./auth.json');
var config = require('config');
var data = require('./data');

function parseStates(inList) {
	var outList = [];
	
	for (var index in inList) {
		var inObj = inList[index];
		var elt = inObj["state"];
		if (inObj['trend'] > 0) {
			elt += "˄";
		} else if (inObj['trend'] < 0) {
			elt += "˅";
		}
		outList.push(elt);
	}
	
	return outList;
}

function getSystemSummary(systemName, systemData) {
	var response = "";
	var sn = systemData['name'];

	if (sn === undefined) {
		return "Sorry, EDSM doesn't know about the system *" + systemName + "* 😕";
	}

	var controllingFactionName = systemData['controllingFaction']['name']
	var date = new Date(systemData['lastUpdate']*1000);
	var niceDate = date.toISOString();
	response += "Data obtained from EDSM at " + niceDate + "\n";
	response += "**System " + sn + "**:\n";
	
	response += '```';
	var factionsData = systemData['factions'];
	for (var factionIndex in factionsData) {
		var factionData = factionsData[factionIndex];
		var factionName = factionData['name'];
		var percent = (factionData['influence'] * 100).toFixed(1) + "%";
		response += (factionName == controllingFactionName) ? "⦿ " : "◦ "
		var displayName = factionName.toUpperCase();
		if (factionData['isPlayer']) {
			displayName += "†";
		}		
		response += (displayName + ": ").padEnd(40 - percent.length);
		response += percent;
		
		response += "\n";
		
		var states = [];
		states = parseStates(factionData['activeStates']);
		if (states.length == 0) {
			states.push(factionData['state']);
		}
 		if (states.length > 0) {
			response += "\xa0\xa0∙ Active:     " + states.join(' ');
			response += "\n";
 		}
 		
 		var recoveringStates = parseStates(factionData['recoveringStates']);
 		if (recoveringStates.length > 0) {
			response += "\xa0\xa0∙ Recovering: " + recoveringStates.join(' ');
			response += "\n";
 		}
 		
 		var pendingStates = parseStates(factionData['pendingStates']);
 		if (pendingStates.length > 0) {
			response += "\xa0\xa0∙ Pending:    " + pendingStates.join(' ');
			response += "\n";
 		}
	}
	response += '```';
	
	return response;
}

function showSystemInfo(bot, channelID, args) {
	var systemName = args.join(' ');

	data.getSystem(systemName).then(function(systemObject) {
		var response = getSystemSummary(systemName, systemObject);

		bot.sendMessage({
			to: channelID,
			message: response
		});
	}, function(err) {
        console.log(err);
	});
}

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client({
   token: config.get('botToken'),
   autorun: true
});
bot.on('ready', function (evt) {
//     logger.info('Connected');
	logger.info('Logged in as: ' + bot.username + ' - (' + bot.id + ')');
	
	// bot.sendMessage({
	// 	to: '78955103381360640',
	// 	message: 'Started up'
	// });
	
	//users.get("Nightstorm#9647").send("Started up!");
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        
        switch(cmd) {
		case 'edload':
			console.log('Load request from user ID ' + userID);
			data.loadRedis();
			break;
		case 'edsystem':
			console.log('Message from user ID ' + userID);
           	showSystemInfo(bot, channelID, args);
           	break;
            // Just add any case commands if you want to..
         }
     }
});
