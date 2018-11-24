const data = require('../modules/data');
const tools = require('../modules/tools');

function getFactionSummary(givenFactionName, factionObject) {
	var factionName = factionObject['name'];

	if (factionName === undefined) {
		return "Sorry, I don't know about the *" + givenFactionName + "* faction 😕";
	}

	var date = new Date(parseInt(factionObject['lastUpdate'], 10));
	// var niceDate = tools.getEliteDate(date);

	// var controllingFactionName = systemData['controllingFaction']
	var description = "";
	var content = `Here's data on the **${factionName}** minor faction`;
	
	// https://leovoel.github.io/embed-visualizer/
	//response += '```';
	var embed = {};
	// var description = "";
	var systemsData = factionObject['systems']; //tools.sortByInfluence(systemData['factions']);
	// const indent = '` ` ` ` ` ` ` `'; //'`.' + (" ".repeat(7)) + '.` ';
	const indent = String.fromCodePoint(0x3000).repeat(7);
	// const indent = "`." + "\u2063".repeat(5) + " :`";

	for (var systemIndex in systemsData) {
		var systemData = systemsData[systemIndex];
		var systemName = ('name' in systemData) ? systemData['name'] : systemIndex;
		var percent = (systemData['influence'] * 100).toFixed(1) + "%";
		var displayName = systemName.toUpperCase();

		// description += (factionName == controllingFactionName) ? "\uFF0A " : "\uFF0D "
		description += '`';
		description += "∙ "; //(factionName == controllingFactionName) ? "⦿ " : "∙ "

		// description += tools.getMonospacedPercentage(factionData['influence'] * 100, 1, 6) + ": ";

		description += "\u3000".repeat(6 - percent.length) + percent + " :` ";
		// description += (displayName + ": ").padEnd(40 - percent.length);
		// description += percent;
		
		description += "**" + displayName + "** "

		if (systemData.controllingFaction) {
			description += "👑";
		}

		description += "\n";
		
		var states = [];
		states = tools.parseStates(systemData['activeStates']);
		if (states.length > 0) {
			description += indent + "Active: " + states.join(' ');
			description += "\n";
		}

		var recoveringStates = tools.parseStates(systemData['recoveringStates']);
		if (recoveringStates.length > 0) {
			description += indent + "Recovering: " + recoveringStates.join(' ');
			description += "\n";
		}

		var pendingStates = tools.parseStates(systemData['pendingStates']);
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
	name: 'faction',
	aliases: [ 'fac' ],
	description: 'Get minor faction information',
	execute(message, command, args) {
		if (args.length < 1) {
			message.channel.send("The !system command needs to be followed by a system name, such as `edsystem shinrarta dezhra`");
			return;
		}

		var factionName = args.join(' ');

		data.getFaction(factionName).then(function(factionObject) {
			var response = getFactionSummary(factionName, factionObject);
	
			message.channel.send(response.content, { embed: response.embed });
		}, function(err) {
			console.log(err);
		});
	}
};