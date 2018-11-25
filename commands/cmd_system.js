const data = require('../modules/data');
const tools = require('../modules/tools');

function getSystemSummary(enteredSystemName, systemData) {
	// var response = {};
	var systemName = systemData['name'];

	if (systemName === undefined) {
		return {
			content: "Sorry, I don't know about the *" + enteredSystemName + "* system 😕",
			embed: embed
		};
	}

	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(parseInt(systemData['lastUpdate'], 10));
	// var niceDate = tools.getEliteDate(date); //date.toISOString();
	var factionsText = "";
	var content = `Here's data on the **${systemName}** system`; //, obtained from EDDN at ${niceDate}`;
	
	// https://leovoel.github.io/embed-visualizer/
	// var description = "";
	var factionsData = tools.sortByInfluence(systemData['factions']);
	// const indent = '` ` ` ` ` ` ` `'; //'`.' + (" ".repeat(7)) + '.` ';
	const indent = String.fromCodePoint(0x3000).repeat(7);
	// const indent = "`." + "\u2063".repeat(5) + " :`";

	for (var factionIndex in factionsData) {
		var factionData = factionsData[factionIndex];
		var factionName = factionData['name'];
		var percent = (factionData['influence'] * 100).toFixed(1) + "%";
		var displayName = factionName; //.toUpperCase();
		if (factionData['isPlayer']) {
			displayName += "†";
		}

		// description += (factionName == controllingFactionName) ? "\uFF0A " : "\uFF0D "
		factionsText += '`';
		factionsText += "∙ "; //(factionName == controllingFactionName) ? "⦿ " : "∙ "

		// description += tools.getMonospacedPercentage(factionData['influence'] * 100, 1, 6) + ": ";

		factionsText += "\u3000".repeat(6 - percent.length) + percent + " :` ";
		// description += (displayName + ": ").padEnd(40 - percent.length);
		// description += percent;
		
		factionsText += "**" + displayName + "** "

		if (factionName == controllingFactionName) {
			factionsText += "👑";
		}

		factionsText += "\n";
		
		var states = [];
		states = tools.parseStates(factionData['activeStates']);
		if (states.length > 0) {
			factionsText += indent + "Active: " + states.join(' ');
			factionsText += "\n";
		}

		var recoveringStates = tools.parseStates(factionData['recoveringStates']);
		if (recoveringStates.length > 0) {
			factionsText += indent + "Recovering: " + recoveringStates.join(' ');
			factionsText += "\n";
		}

		var pendingStates = tools.parseStates(factionData['pendingStates']);
		if (pendingStates.length > 0) {
			factionsText += indent + "Pending: " + pendingStates.join(' ');
			factionsText += "\n";
		}
	}

	var governanceList = [];
	if ('allegiance' in systemData) {
		governanceList.push(systemData['allegiance'])
	}

	if ('government' in systemData) {
		governanceList.push(systemData['government'])
	}

	var embed = {
		"fields": [],
		timestamp: date.toISOString(),
		footer: {
			"icon_url": "https://cdn.discordapp.com/avatars/" + tools.getMyUserId() + "/" + tools.getMyAvatar() + ".png",
			text: "Data obtained by edbot from EDDN"
		},
		"color": 16747520,
	};

	if ('economies' in systemData) {
		embed.fields.push({
			name: "Economy",
			value: systemData['economies'].join(', ')
		});
	}

	if (governanceList.length > 0) {
		embed.fields.push({
			name: "Governance",
			value: governanceList.join(' ')
		});
	}

	if ('population' in systemData) {
		embed.fields.splice(1, 0, {
			name: "Population",
			value: tools.niceNumber(systemData['population'])
		});
	}

	if (factionsText != '') {
		embed.fields.push({
			name: "Minor Factions",
			value: factionsText
		});
	}

	if ('security' in systemData) {
		embed.fields.push({
			name: "Security",
			value: systemData['security']
		});
	}

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