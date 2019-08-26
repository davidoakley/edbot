"use strict";

const winston = require('winston');
const config = require('config');

const tools = require('./tools');
const data = require("./data");
const System = require('./system');
const changeTracking = require('./changeTracking');
const eddnParser = require('./eddnParser');

const systemLogger = winston.createLogger({
	format: winston.format.printf(info => `${info.message}`),
	transports: [ new winston.transports.File({ filename: 'systems.log' }) ]
  });

async function parseJournal(inData, inString) {
	const msgData = inData["message"];
	const event = msgData['event'];
	if ("Factions" in msgData && (event == "FSDJump" || event == "Location")) {
		try {
			await parseFSDJump(inData);

			const systemName = msgData['StarSystem'];
			if (systemName in config.get("logSystems")) {
				systemLogger.info(inString);
			}
		} catch (error) {
			console.error(error);
		}
	} else if (event == "Docked") {
		try {
			await parseDocked(inData);
		} catch (error) {
			console.error(error);
		}
	}
	
	if (event != 'Scan' && 'StarSystem' in inData.message && 'timestamp' in inData.message) {
		const thisUpdate = Date.parse(msgData['timestamp']);
		data.logVisitCount(inData.header.uploaderID, inData.message.StarSystem, event, thisUpdate);
	} else {
		//console.log(`Ignoring event ${event}`);
	}
}

async function parseFSDJump(inData) {
	const headerData = inData["header"];
	const software = headerData["softwareName"] + "/" + headerData["softwareVersion"];
	const msgData = inData["message"];

	const systemName = msgData['StarSystem'];

	const oldSystemObj = await data.getSystem(systemName) || {};

	const lastUpdate = oldSystemObj ? oldSystemObj.lastUpdate : new Date(0);
	const thisUpdate = Date.parse(msgData['timestamp']);

	if (thisUpdate <= lastUpdate) {
		console.log(`${systemName}: ignoring - new data timestamp ${new Date(thisUpdate).toISOString()} is older than previous timestamp ${new Date(lastUpdate).toISOString()} (${software})`);
		return;
	}

	// const multi = data.getRedisClient().multi();

	const inFactionsData = msgData["Factions"];
	// var now = Date.now();

	var factionSet = new Set();
	for (const factionIndex in inFactionsData) {
		const inFaction = inFactionsData[factionIndex];
		factionSet.add(inFaction['Name']);
	}

	for (const factionKey in oldSystemObj['factions']) {
		const oldFaction = oldSystemObj['factions'][factionKey];
		factionSet.add(oldFaction['name']);
	}

    const factionList = [ ...factionSet ];

	var systemObj = new System(systemName, thisUpdate, software);

	if ("subscriptions" in oldSystemObj) {
		systemObj["subscriptions"] = oldSystemObj["subscriptions"];
	}

	systemObj['factions'] = {};
	var promiseArray = [];
	for (const factionName of factionList) {
		// const inFaction = inFactionsData[factionIndex];
		// const factionName = inFaction['Name'];
		promiseArray.push(data.getFaction(factionName));
	}

	const oldFactionObjArray = await Promise.all(promiseArray);

	promiseArray = [];
	for (const factionName of factionList) {
		const factionKeyName = tools.getKeyName(factionName);	

		const inFaction = inFactionsData.find(f => (f.Name == factionName)); //inFactionsData[factionIndex];
		const oldFactionObj = oldFactionObjArray.find(f => (f != null && f.name == factionName)); //[factionIndex];

		// const factionName = inFaction['Name'];
		var oldSystemFactionObj = (oldSystemObj != null) && ('factions' in oldSystemObj) && (factionKeyName in oldSystemObj['factions']) ? oldSystemObj['factions'][factionKeyName] : undefined;

		const [
			factionObj,
			systemFactionObj
			] = parseSystemFaction(/*multi,*/ systemName, factionName, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate);
		
		if (changeTracking.hasFactionChanged(oldFactionObj, factionObj)) {
			//await data.storeFaction(factionName, factionObj);
			promiseArray.push(data.storeFaction(factionName, factionObj));
		}
	
		if (systemFactionObj != undefined) {
			systemObj['factions'][factionKeyName] = systemFactionObj;
		}

		if (factionName == systemObj['controllingFaction']) {
			// factionSystemObj['controllingFaction'] = true;
			if ('Allegiance' in inFaction) {
				systemObj['allegiance'] = inFaction['Allegiance'];
			}
			if ('Government' in inFaction) {
				systemObj['government'] = inFaction['Government'];
			}
		}
	}
	await Promise.all(promiseArray);

	eddnParser.addSystemProperties(systemObj, msgData, oldSystemObj);

	const changeList = data.storeSystem(/*multi,*/ systemName, systemObj, oldSystemObj);
	changeTracking.sendSystemChangeNotifications(systemObj, changeList, global.discordClient, software);
}

function parseSystemFaction(/*multi,*/ systemName, factionName, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate) {

	if (factionName == 'Pilots Federation Local Branch' && (!('Influence' in inFaction) || inFaction['Influence'] == 0)) {
		return undefined;
	}

	var factionObj = {
		'name': factionName
	};

	if (oldFactionObj != undefined) {
		if ('allegiance' in oldFactionObj) {
			factionObj['allegiance'] = oldFactionObj['allegiance'];
		}

		if ('government' in oldFactionObj) {
			factionObj['government'] = oldFactionObj['government'];
		}

		if ('isPlayer' in oldFactionObj) {
			factionObj['isPlayer'] = oldFactionObj['isPlayer'];
		}
	}

	if (inFaction != undefined) {
		if ('Allegiance' in inFaction) {
			factionObj['allegiance'] = inFaction['Allegiance'];
		}
		if ('Government' in inFaction) {
			factionObj['government'] = inFaction['Government'];
		}
	} else {
		console.log(`${systemName}: ${factionName} now missing from this system`);
	}

	var systemFactionObj = { ...factionObj };
	eddnParser.addFactionStatesAndInfluence(systemFactionObj, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate);
	// eddnParser.addFactionStatesAndInfluence(factionSystemObj, inFaction);

	factionObj['systemNames'] = [];

	if (oldFactionObj != undefined) {
		if ('systemNames' in oldFactionObj) {
			factionObj['systemNames'] = [ ...oldFactionObj['systemNames'] ];
		} else if ('systems' in oldFactionObj) {
			// Need to 'upgrade' this faction to just list system names
			factionObj['systemNames'] = data.getOldFactionSystemNames(oldFactionObj);
			console.log(`> Converted faction ${factionName}`);
		}
	}
	
	if (!factionObj['systemNames'].includes(systemName)) {
		factionObj['systemNames'].push(systemName);
		factionObj['systemNames'].sort();
		console.log(`> Faction ${factionName} -> ${systemName} system`);
	}

	delete factionObj['influence'];
	delete factionObj['influenceHistory'];
	
	return [
		factionObj,
		systemFactionObj
	];
}

async function parseDocked(inData) {
	// const headerData = inData["header"];
	// const software = headerData["softwareName"] + "/" + headerData["softwareVersion"];
	const msgData = inData["message"];

	const systemName = msgData['StarSystem'];

	const stationName = msgData['StationName'];
	const stationKeyName = tools.getKeyName(stationName);	

	const systemObj = await data.getSystem(systemName);

	if (systemObj == null)
	{
		// Not a known system - don't create a new one
		return;
	}

	if (!("stations" in systemObj)) {
		systemObj["stations"] = {};
	}

	// if (stationKeyName in systemObj["stations"]) {
	// 	// Station already listed, exit now
	// 	return;
	// }

	const stationObj = {
		'name': stationName,
		'type': msgData['StationType'],
		'distance': msgData['DistFromStarLS'],
		'services': msgData['StationServices'],
		'economies': eddnParser.getStationEconomies(msgData)
	};

	if ("StationFaction" in msgData) {
		stationObj['faction'] = msgData['StationFaction']['Name'];
	}

	systemObj['stations'][stationKeyName] = stationObj;

	// await collection.updateOne({lcName: systemName.toLowerCase()}, {$set: newSystemObj});
	await data.storeSystemStation(systemName, systemObj);

	console.log(`${systemName}: STATION ${stationName}`);
}

module.exports = {
    parseJournal
}