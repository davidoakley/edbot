const data = require('../modules/data');
const tools = require('../modules/tools');

function getSystemSummary(systemName, systemData) {
	var response = "";
	var sn = systemData['name'];

	if (sn === undefined) {
		return "Sorry, I don't know about the *" + systemName + "* system 😕";
	}

	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(parseInt(systemData['lastUpdate'], 10));
	var niceDate = tools.getEliteDate(date); //date.toISOString();
	response += "Data obtained from EDDN at " + niceDate + "\n";
	response += "**System " + sn + "**:\n";
	
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
	
			message.channel.send(response);
		}, function(err) {
			console.log(err);
		});
	}
};