const data = require('../modules/data');
const tools = require('../modules/tools');

function getSystemSummary(systemName, systemData) {
	var response = "";
	var sn = systemData['name'];

	if (sn === undefined) {
		return "Sorry, EDSM doesn't know about the system *" + systemName + "* 😕";
	}

	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(systemData['lastUpdate']*1000);
	var niceDate = date.toISOString();
	response += "Data obtained from EDSM at " + niceDate + "\n";
	response += "**System " + sn + "**:\n";
	
	response += '```';
	var factionsData = tools.sortByInfluence(systemData['factions']);
	for (var factionIndex in factionsData) {
		var factionData = factionsData[factionIndex];
		var factionName = factionData['name'];
		var percent = (factionData['influence'] * 100).toFixed(1) + "%";
		response += (factionName == controllingFactionName) ? "★ " : "◦ "
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
	name: 'edsystem',
	description: 'Get faction influences within a system',
	execute(message, args) {
		var systemName = args.join(' ');

		data.getSystem(systemName).then(function(systemObject) {
			var response = getSystemSummary(systemName, systemObject);
	
			message.channel.send(response);
		}, function(err) {
			console.log(err);
		});
	}
};