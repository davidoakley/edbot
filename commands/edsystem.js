const data = require('../data');

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

	var controllingFactionName = systemData['controllingFaction']
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
		response += (factionName == controllingFactionName) ? "★ " : "◦ "
		var displayName = factionName.toUpperCase();
		if (factionData['isPlayer']) {
			displayName += "†";
		}		
		response += (displayName + ": ").padEnd(40 - percent.length);
		response += percent;
		
		response += "\n";
		
		var states = [];
		states = parseStates(factionData['activeStates']);
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

module.exports = {
	name: 'edsystem',
	description: 'Get faction influences within a system',
	execute(message) {
        var args = message.content.substring(1).split(' ');
        args = args.splice(1);

        var systemName = args.join(' ');

        data.getSystem(systemName).then(function(systemObject) {
            var response = getSystemSummary(systemName, systemObject);
    
            message.channel.send(response);
        }, function(err) {
            console.log(err);
        });
    
	},
};