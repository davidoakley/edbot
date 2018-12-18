// const io = require('@pm2/io')

// io.init({
//   metrics: {
//     network: {
//       ports: true
//     }
//   }
// });

// https://discordapp.com/oauth2/authorize?&client_id=512352639107858432&scope=bot&permissions=8
// Nightstorm is user ID 78955103381360640
const discord = require('discord.js');
const logger = require('winston');
const config = require('config');
const tools = require('./modules/tools');
const prefix = config.get('defaultPrefix');
const redis = require("redis");
const data = require("./modules/data");
const commandRunner = require('./modules/discordCommandRunner');
const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();
data.setRedisClient(redisClient);

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
const client = new discord.Client();
commandRunner.init(client, './commands', prefix);

client.once('ready', () => {
	logger.info('Logged in as: ' + client.user.username + ' - (' + client.user.id + ')');
	tools.setDiscordClient(client);
});

client.on('message', message => {
	commandRunner.processMessage(message);
});

client.login(config.get('botToken'));

process.on('SIGTERM', () => {
	console.info('SIGTERM signal received.');
	process.exit(0);
});
