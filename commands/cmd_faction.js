const data = require('../modules/data');
const tools = require('../modules/tools');

function getFactionSummary(givenFactionName, factionObject) {
	var response = "";
	var factionName = factionObject['name'];

	if (factionName === undefined) {
		return "Sorry, I don't know about the *" + givenFactionName + "* faction 😕";
	}

	var date = new Date(parseInt(factionObject['lastUpdate'], 10));
	var niceDate = tools.getEliteDate(date);

    response += "Data obtained from EDSM at " + niceDate + "\n";
    response += "**Faction " + factionName + "**:\n";

    response += '```';
    /*
	var controllingFactionName = systemData['controllingFaction']
	
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
    */
    response += '```';
	
	return response;
}

module.exports = {
	name: 'faction',
	description: 'Get minor faction information',
	execute(message, command, args) {
		if (args.length < 1) {
			message.channel.send("The !system command needs to be followed by a system name, such as `edsystem shinrarta dezhra`");
			return;
		}

		var factionName = args.join(' ');

		data.getFaction(factionName).then(function(factionObject) {
			var response = getFactionSummary(factionName, factionObject);
	
			message.channel.send(response);
		}, function(err) {
			console.log(err);
		});
	}
};