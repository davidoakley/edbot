const data = require('../modules/data');
const tools = require('../modules/tools');

function orderSystems(a, b) {
	if (b.controllingFaction && !a.controllingFaction) {
		return 1;
	} else if (a.controllingFaction && !b.controllingFaction) {
		return -1;
	}

	return Math.sign(b.influence - a.influence); //(a.influence > b.influence) ? 1 : ((b.influence > a.influence) ? -1 : 0);
}

function getSystemsText(systemsData) {
	for (var key in systemsData) {
		if (!('name' in systemsData[key])) {
			systemsData[key]['name'] = key.replace(/_/g, ' ').
				split(' ').
				map(s => s.charAt(0).toUpperCase() + s.substring(1)).
				join(' ');
		}
	}

	var systemList = Array.isArray(systemsData) ? systemsData : Object.values(systemsData);

	systemList.sort(orderSystems);

	const indent = String.fromCodePoint(0x3000).repeat(7);
	var systemsText = "";

	for (var systemIndex in systemList) {
		var systemData = systemList[systemIndex];
		var systemName = ('name' in systemData) ? systemData['name'] : systemIndex;
		var percent = (systemData['influence'] * 100).toFixed(1) + "%";
		var displayName = systemName; //.toUpperCase();

		// description += (factionName == controllingFactionName) ? "\uFF0A " : "\uFF0D "
		systemsText += '`';
		systemsText += "∙"; //(factionName == controllingFactionName) ? "⦿ " : "∙ "

		// description += tools.getMonospacedPercentage(factionData['influence'] * 100, 1, 6) + ": ";

		systemsText += "\u3000".repeat(6 - percent.length) + percent + " :` ";
		// description += (displayName + ": ").padEnd(40 - percent.length);
		// description += percent;
		
		systemsText += "**" + displayName + "** "

		if (systemData.controllingFaction) {
			systemsText += "👑";
		}

		systemsText += "\n";
		
		var states = [];
		states = tools.parseStates(systemData['activeStates']);
		if (states.length > 0) {
			systemsText += indent + "Active: " + states.join(' ');
			systemsText += "\n";
		}

		var recoveringStates = tools.parseStates(systemData['recoveringStates']);
		if (recoveringStates.length > 0) {
			systemsText += indent + "Recovering: " + recoveringStates.join(' ');
			systemsText += "\n";
		}

		var pendingStates = tools.parseStates(systemData['pendingStates']);
		if (pendingStates.length > 0) {
			systemsText += indent + "Pending: " + pendingStates.join(' ');
			systemsText += "\n";
		}
	}

	return systemsText;
}

function getFactionSummary(givenFactionName, factionObject) {
	var factionName = factionObject['name'];

	if (factionName === undefined) {
		return "Sorry, I don't know about the *" + givenFactionName + "* faction 😕";
	}

	var date = new Date(parseInt(factionObject['lastUpdate'], 10));
	// var niceDate = tools.getEliteDate(date);

	// var controllingFactionName = systemData['controllingFaction']
	var content = `Here's data on the **${factionName}** minor faction`;
	
	// https://leovoel.github.io/embed-visualizer/
	//response += '```';
	// var description = "";
	var systemsData = factionObject['systems']; //tools.sortByInfluence(systemData['factions']);
	var systemsText = getSystemsText(systemsData);

	var governanceList = [];
	if ('allegiance' in factionObject) {
		governanceList.push(factionObject['allegiance'])
	}

	if ('government' in factionObject) {
		governanceList.push(factionObject['government'])
	}

	var embed = {
		"fields": [
			{
				name: "Governance",
				value: governanceList.join(' ')
			},
			{
				name: "Systems",
				value: systemsText
			}
		],
		timestamp: date.toISOString(),
		footer: {
			"icon_url": "https://cdn.discordapp.com/avatars/" + tools.getMyUserId() + "/" + tools.getMyAvatar() + ".png",
			text: "Data obtained by edbot from EDDN"
		}
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