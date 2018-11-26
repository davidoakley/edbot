const io = require('@pm2/io')

io.init({
  metrics: {
    network: {
      ports: true
    }
  }
});

// https://discordapp.com/oauth2/authorize?&client_id=512352639107858432&scope=bot&permissions=8
// Nightstorm is user ID 78955103381360640
const fs = require('fs');
const discord = require('discord.js');
const logger = require('winston');
const config = require('config');
const tools = require('./modules/tools');
const prefix = config.get('defaultPrefix');
const redis = require("redis");
const data = require("./modules/data");
const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();
data.setRedisClient(redisClient);

const commandsProcessedCounter = io.counter({
    name: 'Commands processed',
    type: 'counter',
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
const client = new discord.Client();
client.commands = new discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}


client.once('ready', () => {
	logger.info('Logged in as: ' + client.user.username + ' - (' + client.user.id + ')');
	tools.setDiscordClient(client);
});

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();
	var command = undefined;

	if (client.commands.has(commandName)) {
		command = client.commands.get(commandName);
	}

	client.commands.forEach(function (value) {
		if ("aliases" in value && value.aliases.indexOf(commandName) > -1) {
			command = value;
		}
	});

	if (command === undefined) {
		return;
	}

	try {
		command.execute(message, commandName, args);
		commandsProcessedCounter.inc(1);
	}
	catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!');
	}
});

client.login(config.get('botToken'));

process.on('SIGTERM', () => {
	console.info('SIGTERM signal received.');
	process.exit(0);
});

// eddn.connect();