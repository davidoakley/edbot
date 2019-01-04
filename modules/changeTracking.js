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

function sendChangeNotifications(eventsChannel, changeList) {
	if (eventsChannel == undefined) {
		return;
	}

	var outList = [];
	for (const change of changeList) {
		if ('system' in change) {
			if (change.property == 'system') {
				//outList.push(`Discovered a new system **${change.system}**`);
			} else if (change.property.startsWith('faction') && change.oldValue == undefined) {
				outList.push(`Faction **${change.faction}** has expanded into system **${change.system}**`);
			} else if (change.property.startsWith('faction') && change.newValue == undefined) {
				outList.push(`Faction **${change.faction}** has retreated from system **${change.system}**`);
			} else if ('faction' in change) {
				// if (change.property != 'influence') {
					outList.push(`System **${change.system}** Faction **${change.faction}**: ${change.property} changed from '${change.oldValue}' to '${change.newValue}'`);
				// }
			} else {
				outList.push("System **" + change.system + "**: " + change.property + " changed from '" + change.oldValue + "' to '" + change.newValue + "'");
			}
		}
	}

	eventsChannel.send(outList.join("\n"));
}

function sendSystemChangeNotifications(systemData, changeList, discordClient) {
    if ("subscriptions" in systemData === false) {
        return;
    }

    for (const channelID in systemData["subscriptions"]) {
        const channel = discordClient.channels.get(channelID);

        if (changeList.length > 0) {
            sendChangeNotifications(channel, changeList);
        } else {
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