// var redis = require("redis");
// var fs = require('fs');
var tools = require('./tools');
var dateFormat = require('dateformat');
// var request = require('request-promise');

// var bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

var redisClient = undefined; // = redis.createClient();


function setRedisClient(client) {
    redisClient = client;
}

function setJSONObject(multi, keyName, obj) {
    multi.json_set(keyName, '.', JSON.stringify(obj));
}

function getFactionStateChanges(oldFactionObj, newFactionObj) {
    var changeList = [];

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

    for (const property of basicPropertyList) {
        if (property in oldSystemObj && oldSystemObj[property] != newSystemObj[property]) {
            changeList.push({
                system: newSystemObj['name'],
                property: property,
                oldValue: oldSystemObj[property],
                newValue: newSystemObj[property]
            });
        }
    }

    if ('economies' in oldSystemObj && JSON.stringify(oldSystemObj['economies']) != JSON.stringify(newSystemObj['economies'])) {
        changeList.push({
            system: newSystemObj['name'],
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
                system: newSystemObj['name'],
                faction: factionKey,
                property: 'faction',
                oldValue: undefined,
                newValue: newSystemObj['factions'][factionKey]
            });
        } else if (!(factionKey in newSystemObj['factions'])) {
            // Retreated faction
            changeList.push({
                system: newSystemObj['name'],
                faction: factionKey,
                property: 'faction',
                oldValue: oldSystemObj['factions'][factionKey],
                newValue: undefined
            });
        } else {
            // Compare faction properties
            const factionPropertyList = [
                'name',
                'security',
                'population',
                'allegiance',
                'government',
                'controllingFaction'
            ];
            const oldFactionObj = oldSystemObj['factions'][factionKey];
            const newFactionObj = newSystemObj['factions'][factionKey]

            for (const property of factionPropertyList) {
                if (oldFactionObj[property] != newSystemObj['factions'][factionKey][property]) {
                    changeList.push({
                        system: newSystemObj['name'],
                        faction: newFactionObj['name'],
                        property: property,
                        oldValue: oldFactionObj[property],
                        newValue: newSystemObj['factions'][factionKey][property]
                    });
                }
            }

            const oldInfluence = Number(oldFactionObj['influence'] * 100).toFixed(1);
            const newInfluence = Number(newFactionObj['influence'] * 100).toFixed(1);
            if (oldInfluence != newInfluence) {
                changeList.push({
                    system: newSystemObj['name'],
                    faction: newFactionObj['name'],
                    property: 'influence',
                    oldValue: oldInfluence,
                    newValue: newInfluence
                });
            }

            changeList = changeList.concat(getFactionStateChanges(oldFactionObj, newFactionObj));
        }

    }

    return changeList;
}

function storeSystem(multi, systemName, newSystemObj, oldSystemObj) {
    const keyName = tools.getKeyName('system', systemName);

    if (!('name' in oldSystemObj)) {
        // New system: store in redis and return
        setJSONObject(multi, keyName, newSystemObj);

        return [
            {
                system: newSystemObj['name'],
                property: "system",
                oldValue: undefined,
                newValue: newSystemObj
            }
        ];
    }

    const changeList = getSystemChanges(oldSystemObj, newSystemObj);
    if (changeList.length > 0) {
        for (const change of changeList) {
            var logEntry = systemName + ": ";
            if ("faction" in change) {
                logEntry += change.faction + ": ";
            }

            logEntry += change.property + ": " + change.oldValue + " -> " + change.newValue;

            console.log(logEntry);

            // if ("faction" in change) {
            //     console.log(systemName + ": " + change.faction + ": " + change.property + ": " + change.oldValue + " -> " + change.newValue + " (" + newSystemObj.updatedBy + ")");
            // } else {
            //     console.log(systemName + ": " + change.property + ": " + change.oldValue + " -> " + change.newValue + " (" + newSystemObj.updatedBy + ")");
            // }
        }
        setJSONObject(multi, keyName, newSystemObj);
    } else {
        // No changes - just update lastUpdate
        multi.json_set(keyName, 'lastUpdate', JSON.stringify(newSystemObj['lastUpdate']));
    }

    return changeList;
}

function storeFaction(multi, factionName, factionObj) {
    const keyName = tools.getKeyName('faction', factionName);
    setJSONObject(multi, keyName, factionObj);
}

function updateFactionDetails(multi, factionName, factionAllegiance, factionGovernment) {
    const keyName = tools.getKeyName('faction', factionName);
    multi.json_set(keyName, 'name', JSON.stringify(factionName));
    multi.json_set(keyName, 'lastUpdate', JSON.stringify(Date.now()));
    if (factionAllegiance !== undefined) {
        multi.json_set(keyName, 'allegiance', JSON.stringify(factionAllegiance));
    }
    if (factionGovernment !== undefined) {
        multi.json_set(keyName, 'government', JSON.stringify(factionGovernment));
    }
}

function updateFactionSystem(multi, factionName, systemName, factionSystemObj) {
    const keyName = tools.getKeyName('faction', factionName);

    multi.json_set(keyName, 'systems["' + tools.getKeyName(systemName) + '"]', JSON.stringify(factionSystemObj));
}

async function getSystemCount() {
    var cursor = 0;
    var systemCount = 0;

    try {
        do {
            var result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'system:*'); // eslint-disable-line no-await-in-loop
            cursor = result.shift();
            const keyList = result.shift();
            systemCount += keyList.length;
            // console.log('keys:' + keyList.length + ', total:' + systemCount + 'newCursor:' + cursor);
        } while (cursor != 0);

        return systemCount;
    } catch (error) {
        console.log(error);
        return 0;
    }
}

async function getFactionCount() {
    var cursor = 0;
    var factionCount = 0;

    try {
        do {
            var result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'faction:*'); // eslint-disable-line no-await-in-loop
            cursor = result.shift();
            const keyList = result.shift();
            factionCount += keyList.length;
            // console.log('keys:' + keyList.length + ', total:' + factionCount + 'newCursor:' + cursor);
        } while (cursor != 0);

        return factionCount;
    } catch (error) {
        console.log(error);
        return 0;
    }
}

function incrementVisitCounts(multi, systemName) {

    const baseKeyName = tools.getKeyName('visitCount', systemName);

    const hourlyKeyName = baseKeyName + ":" + dateFormat("yyyy-mm-dd_HH");
    multi.incr(hourlyKeyName);
    multi.expire(hourlyKeyName, 60*60*24*7); // Keep this value for 7 days

    const dailyKeyName = baseKeyName + ":" + dateFormat("yyyy-mm-dd");
	multi.incr(dailyKeyName);
    multi.expire(dailyKeyName, 60*60*24*31); // Keep this value for 31 days
}


module.exports = {
    setRedisClient: setRedisClient,
    getRedisClient: function() {
        return redisClient;
    },

    storeSystem: storeSystem,
    storeFaction: storeFaction,
    updateFactionDetails: updateFactionDetails,
    updateFactionSystem: updateFactionSystem,

    getSystemCount: getSystemCount,
    getFactionCount: getFactionCount,

    incrementVisitCounts: incrementVisitCounts,

    getSystem: function (systemName) {
        var systemKeyName = tools.getKeyName('system', systemName);
        return new Promise(function (resolve, reject) {
            redisClient.json_getAsync(systemKeyName).then(function (jsonData) {
                if (jsonData != null) {
                    var systemObj = JSON.parse(jsonData);
                    resolve(systemObj);
                } else {
                    resolve({});
                }
            }, function(err) {
                reject(err); // Pass the error to our caller
            });
        });
    },

    getFaction: function (factionName) {
        var factionKeyName = tools.getKeyName('faction', factionName);
        return new Promise(function (resolve, reject) {
            redisClient.json_getAsync(factionKeyName).then(function (jsonData) {
                if (jsonData != null) {
                    var factionObj = JSON.parse(jsonData);
                    resolve(factionObj);
                } else {
                    resolve({});
                }
            }, function(err) {
                reject(err); // Pass the error to our caller
            });
        });
    }
  };
