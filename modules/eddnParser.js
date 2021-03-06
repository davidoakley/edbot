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

function getUpdatedInfluenceHistory(newInfluence, oldFactionObj, lastUpdate) {
	var history = (oldFactionObj != undefined && ('influenceHistory' in oldFactionObj)) ? oldFactionObj['influenceHistory'] : [];

	// Ditch history before fix date (1551628820473)
	//history = history.filter(entry => entry['update'] > 1551628820473);

	if (oldFactionObj != undefined && oldFactionObj['influence'] != newInfluence) {
		history.unshift({
			'influence': oldFactionObj['influence'],
			'update': lastUpdate
		});
	}

	return history;
}

function addFactionStatesAndInfluence(destObj, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate) {
	// const lastUpdate = oldSystemObj ? oldSystemObj.lastUpdate : undefined;
	// const oldSystemFactionObj = (oldSystemObj != null) && ('systems' in oldSystemObj) && ()

	if (inFaction == undefined) { // Faction has retreated from this system
		destObj['influence'] = 0.0;
		destObj['influenceHistory'] = getUpdatedInfluenceHistory(destObj['influence'], oldSystemFactionObj, lastUpdate);
		return;
	}

	if ('Influence' in inFaction) {
		destObj['influence'] = inFaction['Influence'];
		destObj['influenceHistory'] = getUpdatedInfluenceHistory(destObj['influence'], oldSystemFactionObj, lastUpdate);
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
	
	if ('StarPos' in msgData) {
		systemObj['starPos'] = msgData['StarPos'];
	}

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

function getStationEconomies(msgData) {
	const economies = [];
	if ('StationEconomies' in msgData && msgData['StationEconomies'].length > 0) {

		for (const e of msgData['StationEconomies']) {
			const name = e['Name'];
			const prop = e['Proportion'];

			if (name in typeMap) {
				economies.push({
					name: typeMap[name],
					proportion: prop
				});
			} else {
				console.error("Unknown economy value '" + name + "'");
			}
		}
		/*
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
		*/
	}

	return economies;
}

module.exports = {
    addFactionStatesAndInfluence,
	addSystemProperties,
	getStationEconomies
}
