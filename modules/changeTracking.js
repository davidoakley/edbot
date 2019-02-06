const config = require("config");
const tools = require('./tools');

function getFactionStateChanges(systemName, factionName, oldFactionObj, newFactionObj) {
    var changeList = [];

    // Compare faction properties
    const factionPropertyList = [
        'name',
        'security',
        'population',
        'allegiance',
        'government',
        'controllingFaction'
    ];

    for (const property of factionPropertyList) {
        if (oldFactionObj[property] != newFactionObj[property]) {
            changeList.push({
                system: systemName,
                faction: factionName,
                property: property,
                oldValue: oldFactionObj[property],
                newValue: newFactionObj[property]
            });
        }
    }

    const oldInfluence = Number(oldFactionObj['influence'] * 100).toFixed(1);
    const newInfluence = Number(newFactionObj['influence'] * 100).toFixed(1);
    if (oldInfluence != newInfluence) {
        changeList.push({
            system: systemName,
            faction: factionName,
            property: 'influence',
            oldValue: oldInfluence,
            newValue: newInfluence
        });
    }

    return changeList;
}


function getSystemChanges(oldSystemObj, newSystemObj) {
    var changeList = [];

    const basicPropertyList = [
        'name',
        'security',
        'population',
        'allegiance',
        'government',
        'controllingFaction'
    ];

    const systemName = newSystemObj['name'];

    for (const property of basicPropertyList) {
        if (property in oldSystemObj && oldSystemObj[property] != newSystemObj[property]) {
            changeList.push({
                system: systemName,
                property: property,
                oldValue: oldSystemObj[property],
                newValue: newSystemObj[property]
            });
        }
    }

    if ('economies' in oldSystemObj && JSON.stringify(oldSystemObj['economies'].slice(0).sort()) != JSON.stringify(newSystemObj['economies'].slice(0).sort())) {
        changeList.push({
            system: systemName,
            property: 'economies',
            oldValue: oldSystemObj['economies'],
            newValue: newSystemObj['economies']
        });
    }

    var factionList = Object.keys(oldSystemObj['factions']).concat(Object.keys(newSystemObj['factions']));
    var uniqueFactionList = [ ...new Set(factionList) ];
    for (const factionKey of uniqueFactionList) {
        if (!(factionKey in oldSystemObj['factions'])) {
            // Expanded faction
            changeList.push({
                system: systemName,
                faction: newSystemObj['factions'][factionKey]['name'],
                property: 'faction',
                oldValue: undefined,
                newValue: newSystemObj['factions'][factionKey]
            });
        } else if (!(factionKey in newSystemObj['factions'])) {
            // Retreated faction
            changeList.push({
                system: systemName,
                faction: oldSystemObj['factions'][factionKey]['name'],
                property: 'faction',
                oldValue: oldSystemObj['factions'][factionKey],
                newValue: undefined
            });
        } else {
            const oldFactionObj = oldSystemObj['factions'][factionKey];
            const newFactionObj = newSystemObj['factions'][factionKey]

            changeList = changeList.concat(getFactionStateChanges(systemName, newFactionObj['name'], oldFactionObj, newFactionObj));
        }

    }

    return changeList;
}

function sendChangeNotifications(eventsChannel, systemData, changeList, software) {
	if (eventsChannel == undefined) {
		return;
    }
    
    var systemName = systemData['name'];
	var controllingFactionName = systemData['controllingFaction']
	var date = new Date(parseInt(systemData['lastUpdate'], 10));

    var content = `Received an update for the **${systemName}** system`; //, obtained from EDDN at ${niceDate}`;

    var embed = {
		"fields": [],
		timestamp: date.toISOString(),
		footer: {
			"icon_url": "https://cdn.discordapp.com/avatars/" + tools.getMyUserId() + "/" + tools.getMyAvatar() + ".png",
			text: "Data sent by " + software
		},
		"color": 16747520,
	};

    var outList = [];
    var factionOutList = [];
    var controlOutList = [];
	for (const change of changeList) {
		if (('system' in change) === false) {
            continue;
        }

        if (change.property == 'system') {
            //outList.push(`Discovered a new system **${change.system}**`);
        } else if (change.property.startsWith('faction') && change.oldValue == undefined) {
            factionOutList.push(`**${change.faction}** has expanded here`);
        } else if (change.property.startsWith('faction') && change.newValue == undefined) {
            factionOutList.push(`**${change.faction}** has retreated from here`);
        } else if ('faction' in change) {
            if (change.property == 'influence') {
                factionOutList.push(getFactionChangeLine(change, controllingFactionName));
            } else {
                factionOutList.push(`**${change.faction}**: ${change.property} changed from '${change.oldValue}' to '${change.newValue}'`);
            }
        } else if (change.property == 'controllingFaction') {
            controlOutList.splice(0, 0, `**${change.newValue}** has replaced **${change.oldValue}** as the controlling faction`);
        } else if (change.property == 'government') {
            controlOutList.push(`Government is now **${change.newValue}**`);
        } else if (change.property == 'allegience') {
            controlOutList.push(`Allegience is now **${change.newValue}**`);
        } else {
            outList.push(change.property + " changed from '" + change.oldValue + "' to '" + change.newValue + "'");
        }
    }

    if (controlOutList.length > 0) {
        embed.fields.push({
            name: "Control",
            value: controlOutList.join("\n")
        });
    }

    if (factionOutList.length > 0) {
        embed.fields.push({
            name: "Minor Factions",
            value: factionOutList.join("\n")
        });
    }

    if (outList.length > 0) {
        embed.fields.push({
            name: "Other Updates",
            value: outList.join("\n")
        });
    }

    if (embed.fields.length > 0) {
        eventsChannel.send(content, { embed: embed });
    }
}

function getFactionChangeLine(change, controllingFactionName) {
    const percent = change.newValue + "%";
    const diff = parseFloat(change.newValue) - parseFloat(change.oldValue);
    const diffString = (diff > 0 ? '+' : '') + diff.toFixed(1) + "%";
    var text = '`∙ ';
    text += "\u00a0".repeat(6 - percent.length) + percent;
    text += " (" + diffString + ") :` ";
    text += "**" + change.faction + "**";
    if (change.faction == controllingFactionName) {
        text += " 👑";
    }
    return text;
}

function sendSystemChangeNotifications(systemData, changeList, discordClient, software) {
    var subscriptionList = {};

    if ("subscriptions" in systemData) {
        subscriptionList = systemData["subscriptions"];
    } else {
        // subscriptionList[config.eventChannel] = {};
        return;
    }

    for (const channelID in subscriptionList) {
        const channel = discordClient.channels.get(channelID);

        if (changeList.length > 0) {
            sendChangeNotifications(channel, systemData, changeList, software);
        } else if (config.get("reportNoChanges")) {
            channel.send(`System **${systemData.name}**: no changes`);
        }
    }
}

module.exports = {
    getFactionStateChanges,
    getSystemChanges,
    sendChangeNotifications,
    sendSystemChangeNotifications
  };