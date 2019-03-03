"use strict";

const typeMap = require('./eddnTypeMap');

function convertStates(eddnStates) {
	var outStates = [];

	for (var stateIndex in eddnStates) {
		var stateObj = {};
		if ('State' in eddnStates[stateIndex]) {
			stateObj['state'] = eddnStates[stateIndex]['State'];
		}
		if ('Trend' in eddnStates[stateIndex]) {
			stateObj['trend'] = eddnStates[stateIndex]['Trend'];
		}

		outStates.push(stateObj);
	}

	return outStates;
}

function addFactionStatesAndInfluence(destObj, inFaction) {
	if ('Influence' in inFaction) {
		destObj['influence'] = inFaction['Influence'];
	}

	if ('PendingStates' in inFaction && Array.isArray(inFaction['PendingStates']) && inFaction['PendingStates'].length > 0) {
		destObj['pendingStates'] = convertStates(inFaction['PendingStates']);
	}

	if ('RecoveringStates' in inFaction && Array.isArray(inFaction['RecoveringStates']) && inFaction['RecoveringStates'].length > 0) {
		destObj['recoveringStates'] = convertStates(inFaction['RecoveringStates']);
	}

	if ('ActiveStates' in inFaction && Array.isArray(inFaction['ActiveStates']) && inFaction['ActiveStates'].length > 0) {
		destObj['activeStates'] = convertStates(inFaction['ActiveStates']);
	}
	else if ('State' in inFaction && inFaction['State'] != 'None') {
		destObj['activeStates'] = [ { 'state': inFaction['State']} ];
	}
}

function addSystemProperties(systemObj, msgData, oldSystemObj) {
	if ('SystemFaction' in msgData) {
		systemObj['controllingFaction'] = msgData['SystemFaction'];
	} else if ('controllingFaction' in oldSystemObj) {
        systemObj['controllingFaction'] = oldSystemObj['controllingFaction'];
    }

    if ('controllingFaction' in systemObj) {
		if (typeof systemObj['controllingFaction'] === "object" && 'Name' in systemObj['controllingFaction']) {
			systemObj['controllingFaction'] = systemObj['controllingFaction']['Name']
		}

		if (typeof systemObj['controllingFaction'] !== "string") {
			console.error('controllingFaction not string: ' + JSON.stringify(systemObj['controllingFaction']) + ": " + (typeof systemObj['controllingFaction']))
		}

        const inFactionsData = msgData["Factions"];
        
        for (const factionIndex in inFactionsData) {
            const inFaction = inFactionsData[factionIndex];
            if (inFaction['Name'] == systemObj['controllingFaction']) {
                systemObj['allegiance'] = inFaction['Allegiance'];
				systemObj['government'] = inFaction['Government'];
				if (systemObj['allegiance'] == undefined || systemObj['allegiance'] == undefined) {
					console.error(`Null allegiance or government for system '${systemObj['name']}'`);
				}
            }
        }
    }

	if ('Population' in msgData) {
		systemObj['population'] = parseInt(msgData['Population'], 10);
	} else if ('population' in oldSystemObj) {
        systemObj['population'] = oldSystemObj['population'];
    }

	// if (('allegiance' in systemObj === false) && 'SystemAllegiance' in msgData) {
	// 	systemObj['allegiance'] = msgData['SystemAllegiance'];
	// }

	// if (('government' in systemObj === false) && 'SystemGovernment' in msgData) {
	// 	if (msgData['SystemGovernment'] in typeMap) {
	// 		systemObj['government'] = typeMap[msgData['SystemGovernment']];
	// 	} else {
	// 		console.error("Unknown government value '" + msgData['SystemGovernment'] + "'");
	// 	}
	// }

	addSystemEconomies(msgData, systemObj);
	addSystemSecurity(msgData, systemObj);
}

function addSystemSecurity(msgData, systemObj) {
	if ('SystemSecurity' in msgData) {
		if (msgData['SystemSecurity'] in typeMap) {
			systemObj['security'] = typeMap[msgData['SystemSecurity']];
		}
		else {
			console.error("Unknown security value '" + msgData['SystemSecurity'] + "'");
		}
	}
}

function addSystemEconomies(msgData, systemObj) {
	if ('SystemEconomy' in msgData && msgData['SystemEconomy'] != "$economy_Undefined") {
		systemObj['economies'] = [];
		if (msgData['SystemEconomy'] in typeMap) {
			systemObj['economies'].push(typeMap[msgData['SystemEconomy']]);
		}
		else {
			console.error("Unknown economy value '" + msgData['SystemEconomy'] + "'");
		}
		if ('SystemSecondEconomy' in msgData && msgData['SystemSecondEconomy'] != "$economy_None;" && msgData['SystemSecondEconomy'] != "$economy_Undefined;") {
			if (msgData['SystemSecondEconomy'] in typeMap) {
				systemObj['economies'].push(typeMap[msgData['SystemSecondEconomy']]);
			}
			else {
				console.error("Unknown economy value '" + msgData['SystemSecondEconomy'] + "'");
			}
		}
	}
}

module.exports = {
    addFactionStatesAndInfluence,
    addSystemProperties
}
