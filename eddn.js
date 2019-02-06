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
const eddnParser = require('./modules/eddnParser.js')

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
	const headerData = inData["header"];
	const software = headerData["softwareName"] + "/" + headerData["softwareVersion"];
	const msgData = inData["message"];
	const event = msgData['event'];
	if ("Factions" in msgData && (event == "FSDJump" || event == "Location")) {
		parseFSDJump(msgData, software, inString);

		const systemName = msgData['StarSystem'];
		if (systemName in config.get("logSystems")) {
			systemLogger.info(inString);
		}
	}
}

async function parseFSDJump(msgData, software /*, inString*/) {
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

		eddnParser.addFactionStatesAndInfluence(factionObj, inFaction);
		eddnParser.addFactionStatesAndInfluence(factionSystemObj, inFaction);

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

		data.storeSystemFaction(multi, systemName, factionName, factionObj);

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

	eddnParser.addSystemProperties(systemObj, msgData, oldSystemData);

	// const controllingFactionName = systemObj['controllingFaction'];
	// const controllingFactionData = systemObj['factions'][tools.getKeyName(controllingFactionName)];
	// if (controllingFactionData !== undefined && (controllingFactionData['allegiance'] != systemObj['allegiance'] || controllingFactionData['government'] != systemObj['government'])) {
	// 	systemLogger.info(inString);
	// 	console.log("Government/Allegience mismatch");
	// }

	const changeList = data.storeSystem(multi, systemName, systemObj, oldSystemData);
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
