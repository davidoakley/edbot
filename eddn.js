"use strict";

const io = require('@pm2/io')

io.init({
	metrics: {
		network: {
			ports: true
		}
	}
});

const zlib = require('zlib');
const zmq = require('zeromq');

const tools = require('./modules/tools');
const changeTracking = require('./modules/changeTracking');

const discord = require('discord.js');
const config = require('config');

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const data = require("./modules/data");
const commandRunner = require('./modules/discordCommandRunner');
const eddnParser = require('./modules/eddnParser')
const System = require('./modules/system');

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const winston = require('winston');
const systemLogger = winston.createLogger({
	format: winston.format.printf(info => `${info.message}`),
	transports: [ new winston.transports.File({ filename: 'systems.log' }) ]
  });

const redisClient = redis.createClient();
data.setRedisClient(redisClient);

global.logStream = null;

const discordClient = new discord.Client();
commandRunner.init(discordClient, './eddnCommands', "*");

discordClient.once('ready', () => {
	console.log('Logged in as: ' + discordClient.user.username + ' - (' + discordClient.user.id + ')');
	tools.setDiscordClient(discordClient);
});
discordClient.login(config.get('botToken'));

discordClient.on('message', message => {
	commandRunner.processMessage(message);
});

// const publishClient = redisClient.duplicate();

const eventsProcessedCounter = io.counter({
	name: 'Events processed',
	type: 'counter',
});

const sock = zmq.socket('sub');

sock.connect('tcp://eddn.edcd.io:9500');
console.log('Connected to EDDN port 9500');

sock.subscribe('');

sock.on('message', topic => {
	try {
		const inString = zlib.inflateSync(topic).toString();
		const inData = JSON.parse(inString);

		if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/journal/1") {
			parseJournal(inData, inString);
		}

		if (global.logStream != null) {
			global.logStream.write(inString + "\n");
		}
	}
	catch (error) {
		console.error(error);
		// message.reply('there was an error trying to execute that command!');
	}       
});

function parseJournal(inData, inString) {
	const msgData = inData["message"];
	const event = msgData['event'];
	if ("Factions" in msgData && (event == "FSDJump" || event == "Location")) {
		parseFSDJump(inData);

		const systemName = msgData['StarSystem'];
		if (systemName in config.get("logSystems")) {
			systemLogger.info(inString);
		}
	}
}

async function parseFSDJump(inData) {
	const headerData = inData["header"];
	const software = headerData["softwareName"] + "/" + headerData["softwareVersion"];
	const msgData = inData["message"];

	const systemName = msgData['StarSystem'];

	const oldSystemObj = await data.getSystem(systemName);

	const multi = data.getRedisClient().multi();

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

	var systemObj = new System(systemName, software); //{
	// 	'name': systemName,
	// 	'lastUpdate': now,
	// 	'updatedBy': software
	// };

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
	const lastUpdate = oldSystemObj ? oldSystemObj.lastUpdate : undefined;

	const thisUpdate = Date.parse(msgData['timestamp']);

	if (thisUpdate <= lastUpdate) {
		console.warn(`${systemName}: ignoring - new data timestamp(${new Date(thisUpdate).toISOString()}) older than previous timestamp(${new Date(lastUpdate).toISOString()})`);
		return;
	}

	for (const factionName of factionList) {
		const factionKeyName = tools.getKeyName(factionName);	

		const inFaction = inFactionsData.find(f => (f.Name == factionName)); //inFactionsData[factionIndex];
		const oldFactionObj = oldFactionObjArray.find(f => (f.name == factionName)); //[factionIndex];

		// const factionName = inFaction['Name'];
		var oldSystemFactionObj = (oldSystemObj != null) && ('factions' in oldSystemObj) && (factionKeyName in oldSystemObj['factions']) ? oldSystemObj['factions'][factionKeyName] : undefined;

		const systemFactionObj = parseSystemFaction(multi, systemName, factionName, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate);
		
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

	eddnParser.addSystemProperties(systemObj, msgData, oldSystemObj);

	const changeList = data.storeSystem(multi, systemName, systemObj, oldSystemObj);
	changeTracking.sendSystemChangeNotifications(systemObj, changeList, discordClient, software);

	data.incrementVisitCounts(multi, systemName);

	await executeRedisMulti(multi, systemName, software);
}

function parseSystemFaction(multi, systemName, factionName, inFaction, oldFactionObj, oldSystemFactionObj, lastUpdate) {

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

	if ('systemNames' in oldFactionObj) {
		factionObj['systemNames'] = [ ...oldFactionObj['systemNames'] ];
	} else if ('systems' in oldFactionObj) {
		// Need to 'upgrade' this faction to just list system names
		factionObj['systemNames'] = data.getOldFactionSystemNames(oldFactionObj);
		console.log(`> Converted faction ${factionName}`);
	} else {
		factionObj['systemNames'] = [];
	}
	
	if (!factionObj['systemNames'].includes(systemName)) {
		factionObj['systemNames'].push(systemName);
		factionObj['systemNames'].sort();
		console.log(`> Faction ${factionName} -> ${systemName} system`);
	}

	delete factionObj['influence'];
	delete factionObj['influenceHistory'];
	
	if (changeTracking.hasFactionChanged(oldFactionObj, factionObj)) {
		data.storeFaction(multi, factionName, factionObj);
	// } else {
		// console.log(`${systemName}: ${factionName}: no changes`);
	}

	return systemFactionObj;
}

async function executeRedisMulti(multi, systemName, software) {
	try {
		const replies = await multi.execAsync();
		var updates = 0;
		//var inserts = 0;
		var errors = 0;
		for (var replyIndex in replies) {
			if (replies[replyIndex] instanceof redis.ReplyError) {
				errors++;
				//} else if (replies[replyIndex] == 1) {
				//	inserts++;
			}
			else {
				updates++;
			}
		}
		console.log(systemName + ": " + updates + " changes, " + errors + " errors (" + software + ")");
		eventsProcessedCounter.inc(1);
	}
	catch (err) {
		console.error(systemName + ": MULTI error: " + err);
	}
}

