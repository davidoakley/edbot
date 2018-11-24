const data = require('../modules/data');
const tools = require('../modules/tools');

/*
function getOldSystemSummary(systemName, systemData) {
	var response = "";
	var sn = systemData['name'];

	if (sn === undefined) {
		return "Sorry, I don't know about the *" + systemName + "* system 😕";
	}

	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(parseInt(systemData['lastUpdate'], 10));
	var niceDate = tools.getEliteDate(date); //date.toISOString();
	response += `Here's data on the **${systemName}** system, obtained from EDDN at ${niceDate}\n`;
	
	response += '```';
	var factionsData = tools.sortByInfluence(systemData['factions']);
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
		states = tools.parseStates(factionData['activeStates']);
		if (states.length > 0) {
			response += "\xa0\xa0∙ Active:     " + states.join(' ');
			response += "\n";
		}

		var recoveringStates = tools.parseStates(factionData['recoveringStates']);
		if (recoveringStates.length > 0) {
			response += "\xa0\xa0∙ Recovering: " + recoveringStates.join(' ');
			response += "\n";
		}

		var pendingStates = tools.parseStates(factionData['pendingStates']);
		if (pendingStates.length > 0) {
			response += "\xa0\xa0∙ Pending:    " + pendingStates.join(' ');
			response += "\n";
		}
	}
	response += '```';
	
	return response;
}
*/

function getSystemSummary(enteredSystemName, systemData) {
	// var response = {};
	var systemName = systemData['name'];

	if (systemName === undefined) {
		return "Sorry, I don't know about the *" + enteredSystemName + "* system 😕";
	}

	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(parseInt(systemData['lastUpdate'], 10));
	// var niceDate = tools.getEliteDate(date); //date.toISOString();
	var description = "";
	var content = `Here's data on the **${systemName}** system`; //, obtained from EDDN at ${niceDate}`;
	
	// https://leovoel.github.io/embed-visualizer/
	//response += '```';
	var embed = {};
	// var description = "";
	var factionsData = tools.sortByInfluence(systemData['factions']);
	// const indent = '` ` ` ` ` ` ` `'; //'`.' + (" ".repeat(7)) + '.` ';
	const indent = String.fromCodePoint(0x3000).repeat(7);
	// const indent = "`." + "\u2063".repeat(5) + " :`";

	for (var factionIndex in factionsData) {
		var factionData = factionsData[factionIndex];
		var factionName = factionData['name'];
		var percent = (factionData['influence'] * 100).toFixed(1) + "%";
		var displayName = factionName.toUpperCase();
		if (factionData['isPlayer']) {
			displayName += "†";
		}

		// description += (factionName == controllingFactionName) ? "\uFF0A " : "\uFF0D "
		description += '`';
		description += "∙ "; //(factionName == controllingFactionName) ? "⦿ " : "∙ "

		// description += tools.getMonospacedPercentage(factionData['influence'] * 100, 1, 6) + ": ";

		description += "\u3000".repeat(6 - percent.length) + percent + " :` ";
		// description += (displayName + ": ").padEnd(40 - percent.length);
		// description += percent;
		
		description += "**" + displayName + "** "

		if (factionName == controllingFactionName) {
			description += "👑";
		}

		description += "\n";
		
		var states = [];
		states = tools.parseStates(factionData['activeStates']);
		if (states.length > 0) {
			description += indent + "Active: " + states.join(' ');
			description += "\n";
		}

		var recoveringStates = tools.parseStates(factionData['recoveringStates']);
		if (recoveringStates.length > 0) {
			description += indent + "Recovering: " + recoveringStates.join(' ');
			description += "\n";
		}

		var pendingStates = tools.parseStates(factionData['pendingStates']);
		if (pendingStates.length > 0) {
			description += indent + "Pending: " + pendingStates.join(' ');
			description += "\n";
		}
	}

	embed.description = description;
	embed.timestamp = date.toISOString();
	embed.footer = {
			"icon_url": "https://cdn.discordapp.com/avatars/" + tools.getMyUserId() + "/" + tools.getMyAvatar() + ".png",
			"text": "Data obtained by edbot from EDDN"
	};
	
	return {
		content: content,
		embed: embed
	};
}

module.exports = {
	name: 'system',
	aliases: [ 'sys' ],
	description: 'Get faction influences within a system',
	execute(message, command, args) {
		if (args.length < 1) {
			message.channel.send("The "+command+" command needs to be followed by a system name, such as `edsystem shinrarta dezhra`");
			return;
		}

		var systemName = args.join(' ');

		data.getSystem(systemName).then(function(systemObject) {
			var response = getSystemSummary(systemName, systemObject);
	
			message.channel.send(response.content, { embed: response.embed });
		}, function(err) {
			console.log(err);
		});
	}
};