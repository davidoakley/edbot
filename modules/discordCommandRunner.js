const discord = require('discord.js');
const fs = require('fs');
const io = require('@pm2/io')

io.init({
  metrics: {
    network: {
      ports: true
    }
  }
});

const commandsProcessedCounter = io.counter({
    name: 'Commands processed',
    type: 'counter',
});

var client = null;
var prefix = null;

module.exports = {
    init: function(_client, directory, _prefix) {
        client = _client;
        prefix = _prefix;

        client.commands = new discord.Collection();
        const commandFiles = fs.readdirSync(directory).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`../${directory}/${file}`);
            client.commands.set(command.name, command);
        }
    },

    processMessage: function(message) {
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
    }
};