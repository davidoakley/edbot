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
const typeMap = require('./modules/eddnTypeMap');
const commandRunner = require('./modules/discordCommandRunner');

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();
data.setRedisClient(redisClient);

global.logStream = null;

const discordClient = new discord.Client();
commandRunner.init(discordClient, './eddnCommands', "*");
var eventsChannel = undefined;

discordClient.once('ready', () => {
	console.log('Logged in as: ' + discordClient.user.username + ' - (' + discordClient.user.id + ')');
	tools.setDiscordClient(discordClient);
	eventsChannel = discordClient.channels.get(config.get('eventChannel'));
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
		const inString = zlib.inflateSync(topic);
		const inData = JSON.parse(inString);

		if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/journal/1") {
			parseJournal(inData);
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

function parseJournal(inData) {
	const headerData = inData["header"];
	const software = headerData["softwareName"] + "/" + headerData["softwareVersion"];
	const msgData = inData["message"];
	const event = msgData['event'];
	if ("Factions" in msgData && (event == "FSDJump" || event == "Location")) {
		parseFSDJump(msgData, software);
	}
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

function addSystemProperties(systemObj, msgData) {
	if ('SystemFaction' in msgData) {
		systemObj['controllingFaction'] = msgData['SystemFaction'];
	}

	if ('Population' in msgData) {
		systemObj['population'] = parseInt(msgData['Population'], 10);
	}

	if ('SystemAllegiance' in msgData) {
		systemObj['allegiance'] = msgData['SystemAllegiance'];
	}

	if ('SystemGovernment' in msgData) {
		if (msgData['SystemGovernment'] in typeMap) {
			systemObj['government'] = typeMap[msgData['SystemGovernment']];
		} else {
			console.error("Unknown government value '" + msgData['SystemGovernment'] + "'");
		}
	}

	if ('SystemEconomy' in msgData && msgData['SystemEconomy'] != "$economy_Undefined") {
		systemObj['economies'] = [];
		if (msgData['SystemEconomy'] in typeMap) {
			systemObj['economies'].push(typeMap[msgData['SystemEconomy']]);
		} else {
			console.error("Unknown economy value '" + msgData['SystemEconomy'] + "'");
		}

		if ('SystemSecondEconomy' in msgData && msgData['SystemSecondEconomy'] != "$economy_None;" && msgData['SystemSecondEconomy'] != "$economy_Undefined;") {
			if (msgData['SystemSecondEconomy'] in typeMap) {
				systemObj['economies'].push(typeMap[msgData['SystemSecondEconomy']]);
			} else {
				console.error("Unknown economy value '" + msgData['SystemSecondEconomy'] + "'");
			}
		}	
	}

	if ('SystemSecurity' in msgData) {
		if (msgData['SystemSecurity'] in typeMap) {
			systemObj['security'] = typeMap[msgData['SystemSecurity']];
		} else {
			console.error("Unknown security value '" + msgData['SystemSecurity'] + "'");
		}
	}
}

async function parseFSDJump(msgData, software) {
	const systemName = msgData['StarSystem'];

	const oldSystemData = await data.getSystem(systemName);

	const multi = data.getRedisClient().multi();

	const inFactionsData = msgData["Factions"];
	var now = Date.now();

	var systemObj = {
		'name': systemName,
		'lastUpdate': now,
		'updatedBy': software
	};

	if ("subscriptions" in oldSystemData) {
		systemObj["subscriptions"] = oldSystemData["subscriptions"];
	}

	systemObj['factions'] = {};
	var promiseArray = [];
	for (const factionIndex in inFactionsData) {
		const inFaction = inFactionsData[factionIndex];
		const factionName = inFaction['Name'];
		promiseArray.push(data.getFaction(factionName));
	}

	const oldFactionObjArray = await Promise.all(promiseArray);

	for (const factionIndex in inFactionsData) {
		const inFaction = inFactionsData[factionIndex];
		const factionName = inFaction['Name'];
		const oldFactionData = oldFactionObjArray[factionIndex];

		if (factionName == 'Pilots Federation Local Branch' && (!('Influence' in inFaction) || inFaction['Influence'] == 0)) {
			continue;
		}

		var factionObj = {
			'name': factionName,
			'lastUpdate': now
		};

		var factionSystemObj = {
			'name': systemName,
			'lastUpdate': now
		};

		if ('Allegiance' in inFaction) {
			factionObj['allegiance'] = inFaction['Allegiance'];
		}
		if ('Government' in inFaction) {
			factionObj['government'] = inFaction['Government'];
		}

		addFactionStatesAndInfluence(factionObj, inFaction);
		addFactionStatesAndInfluence(factionSystemObj, inFaction);

		if (factionName == systemObj['controllingFaction']) {
			factionSystemObj['controllingFaction'] = true;
			if ('Allegiance' in inFaction) {
				systemObj['allegiance'] = inFaction['Allegiance'];
			}
			if ('Government' in inFaction) {
				systemObj['government'] = inFaction['Government'];
			}
		}

		const factionKeyName = tools.getKeyName(factionName);
		systemObj['factions'][factionKeyName] = factionObj;

		if ('name' in oldFactionData) {
			data.updateFactionDetails(multi, factionName, factionObj['allegiance'], factionObj['government']);
			data.updateFactionSystem(multi, factionName, systemName, factionSystemObj);
		} else {
			factionObj['systems'] = {};
			factionObj['systems'][tools.getKeyName(systemName)] = factionSystemObj;
			data.storeFaction(multi, factionName, factionObj);
			Reflect.deleteProperty(factionObj, 'systems');
		}
	}

	addSystemProperties(systemObj, msgData);

	const changeList = data.storeSystem(multi, systemName, systemObj, oldSystemData);
	// changeTracking.sendChangeNotifications(eventsChannel, changeList);
	changeTracking.sendSystemChangeNotifications(systemObj, changeList, discordClient);

	data.incrementVisitCounts(multi, systemName);

	try {
		const replies = await multi.execAsync();

		var updates = 0;
		var inserts = 0;
		var errors = 0;
		for (var replyIndex in replies) {
			if (replies[replyIndex] instanceof redis.ReplyError) {
				errors++;
			} else if (replies[replyIndex] == 1) {
				inserts++;
			} else {
				updates++;
			}
		}
		console.log(systemName + ": " + inserts + " inserts, " + updates + " updates " + errors + " errors (" + software + ")");
		eventsProcessedCounter.inc(1);
	} catch (err) {
		console.error(systemName + ": MULTI error: " + err);
	}
}
