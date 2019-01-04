const data = require('../modules/data');
// const fs = require('fs');

async function execute(message, command, args) {
    if (message.author.id != '78955103381360640') {
        message.channel.send("Sorry, only Nightstorm can add subscriptions for now. 🤭");
        return;
    }

    if (args.length < 2) {
        message.channel.send("The "+command+" command needs to be followed by a type (currently *system*) and a system name, such as `subscribe system shinrarta dezhra`");
        return;
    }
    
    const subscriptionType = args.shift();

    if (subscriptionType == "system") {
        var enteredSystemName = args.join(' ');

        const systemData = await data.getSystem(enteredSystemName);

        const systemName = systemData['name'];

        if (systemName !== undefined) {
            const result = await data.addSystemSubscription(systemName, message.channel.id);
            if (result == "OK") {
                message.channel.send("OK, this channel is now subscribed to changes to the *" + systemName + "* system 😎");
            } else if (result == "alreadySubscribed") {
                message.channel.send("This channel is already subscribed to changes to the *" + systemName + "* system 😛");
            } else {
                message.channel.send("Sorry, there was a problem subscribing to changes to the *" + systemName + "* system 🤯");
            }
        } else {
            message.channel.send("Sorry, I don't know about the *" + enteredSystemName + "* system 😶");
        }
    }
}

module.exports = {
	name: 'subscribe',
    description: 'Automatically receive faction or system change information',
    execute    
};