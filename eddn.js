"use strict";

// require('console-stamp')(console, { pattern: 'yyyy-mm-hh HH:MM:ss' });
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

const discord = require('discord.js');
const config = require('config');
const mongoClient = require('mongodb').MongoClient;

const winston = require('winston');

const tools = require('./modules/tools');
// const changeTracking = require('./modules/changeTracking');

// const redis = require("redis");
// const rejson = require('redis-rejson');
// rejson(redis);
const data = require("./modules/data");
const commandRunner = require('./modules/discordCommandRunner');
// const eddnParser = require('./modules/eddnParser')
const eddnJournalParser = require('./modules/eddnJournalParser');
// const System = require('./modules/system');

var AsyncLock = require('async-lock');
var lock = new AsyncLock();

// const bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

// const systemLogger = winston.createLogger({
// 	format: winston.format.printf(info => `${info.message}`),
// 	transports: [ new winston.transports.File({ filename: 'systems.log' }) ]
//   });

// const redisClient = redis.createClient();
// data.setRedisClient(redisClient);

global.logStream = null;

const discordClient = new discord.Client();
commandRunner.init(discordClient, './eddnCommands', "*");

discordClient.once('ready', () => {
	console.log('Logged in as: ' + discordClient.user.username + ' - (' + discordClient.user.id + ')');
	tools.setDiscordClient(discordClient);
	global.discordClient = discordClient;
});
discordClient.login(config.get('botToken'));

discordClient.on('message', message => {
	commandRunner.processMessage(message);
});

// const publishClient = redisClient.duplicate();

// const eventsProcessedCounter = io.counter({
// 	name: 'Events processed',
// 	type: 'counter',
// });

const sock = zmq.socket('sub');

run();

async function run() {
	console.log('Connecting to MongoDB...');
	const db = await mongoClient.connect(config.get("mongoUrl"));
	data.setMongoDB(db);
	console.log('Connected to MongoDB');

	sock.connect('tcp://eddn.edcd.io:9500');
	console.log('Connected to EDDN port 9500');

	sock.subscribe('');

	sock.on('message', async topic => {
		await lock.acquire('message', async function() {
			try {
				const inString = zlib.inflateSync(topic).toString();
				const inData = JSON.parse(inString);
	
				if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/journal/1") {
					await eddnJournalParser.parseJournal(inData, inString);
				} /*else if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/commodity/3") {
					await parseCommodity(inData, inString);
				}*/
	
				if (global.logStream != null) {
					global.logStream.write(inString + "\n");
				}
			}
			catch (error) {
				console.error(error);
				// message.reply('there was an error trying to execute that command!');
			}       
			});
	});
}
