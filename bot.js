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
const Discord = require('discord.js');
const logger = require('winston');
// var auth = require('./auth.json');
const config = require('config');
// const data = require('./data');
// const eddn = require('./eddn');
const prefix = '!';

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
var client = new Discord.Client();
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}


client.once('ready', () => {
	logger.info('Logged in as: ' + client.user.username + ' - (' + client.user.id + ')');
});

client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLowerCase();

	if (!client.commands.has(command)) return;

	try {
		client.commands.get(command).execute(message, command, args);
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