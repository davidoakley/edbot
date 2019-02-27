// var redis = require("redis");
// var fs = require('fs');
const tools = require('./tools');
const dateFormat = require('dateformat');
const changeTracking = require('./changeTracking');
// var request = require('request-promise');

// var bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

var redisClient = undefined; // = redis.createClient();


function setRedisClient(client) {
    redisClient = client;
}

function storeSystem(multi, systemName, newSystemObj, oldSystemObj) {
    const keyName = tools.getKeyName('system', systemName);

    if (!('name' in oldSystemObj)) {
        // New system: store in redis and return
        multi.json_set(keyName, '.', JSON.stringify(newSystemObj));

        return [
            {
                system: newSystemObj['name'],
                property: "system",
                oldValue: undefined,
                newValue: newSystemObj
            }
        ];
    }

    const changeList = changeTracking.getSystemChanges(oldSystemObj, newSystemObj);
    if (changeList.length > 0) {
        for (const change of changeList) {
            var logEntry = systemName + ": ";
            if ("faction" in change) {
                logEntry += change.faction + ": ";
            }

            logEntry += change.property + ": " + change.oldValue + " -> " + change.newValue;
            
            logEntry += " (" + oldSystemObj.updatedBy + " -> " + newSystemObj.updatedBy + ")";

            console.log(logEntry);

            // if ("faction" in change) {
            //     console.log(systemName + ": " + change.faction + ": " + change.property + ": " + change.oldValue + " -> " + change.newValue + " (" + newSystemObj.updatedBy + ")");
            // } else {
            //     console.log(systemName + ": " + change.property + ": " + change.oldValue + " -> " + change.newValue + " (" + newSystemObj.updatedBy + ")");
            // }
        }
        multi.json_set(keyName, '.', JSON.stringify(newSystemObj));
    } else {
        // No changes - just update lastUpdate
        multi.json_set(keyName, 'lastUpdate', JSON.stringify(newSystemObj['lastUpdate']));
    }

    return changeList;
}

function storeFaction(multi, factionName, factionObj) {
    const keyName = tools.getKeyName('faction', factionName);
    multi.json_set(keyName, '.', JSON.stringify(factionObj));
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

function updateFactionSystemNames(multi, factionName, systemNames) {
    const keyName = tools.getKeyName('faction', factionName);
    multi.json_set(keyName, 'systemNames', JSON.stringify(systemNames));
}

function getOldFactionSystemNames(factionObj) {
    var systemNames = [];
    for (var key in factionObj['systems']) {
        systemNames.push(factionObj['systems'][key]['name']);
    }

    return systemNames;
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

function getSystem(systemName) {
    const systemKeyName = tools.getKeyName('system', systemName);
    return new Promise(function (resolve, reject) {
        redisClient.json_getAsync(systemKeyName).then(function (jsonData) {
            if (jsonData != null) {
                var systemObj = JSON.parse(jsonData);

                // resolve(addSystemFactions(systemObj));
                resolve(systemObj);
            } else {
                resolve({});
            }
        }, function(err) {
            reject(err); // Pass the error to our caller
        });
    });
}

function getFaction(factionName) {
    const factionKeyName = tools.getKeyName('faction', factionName);
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

async function getFactionSystems(factionObj) {
    if ('systems' in factionObj) {
        return factionObj['systems'];
    }
    
    var mgetArgs = [];
    for (let systemName of factionObj['systemNames']) {
        mgetArgs.push(tools.getKeyName('system', systemName));
    }

    mgetArgs.push('.'); // Add JSON path to retrieve
    
    const resultList = await redisClient.json_mgetAsync(...mgetArgs);

    var systems = {};
    const factionKey = tools.getKeyName(factionObj.name);

    for (let i in resultList) {
        if (resultList[i] != null) {
            const fetchedSystemObj = JSON.parse(resultList[i]);
            const systemName = fetchedSystemObj['name'];
            var systemObj = fetchedSystemObj['factions'][factionKey];
            systemObj['name'] = fetchedSystemObj['name'];
            systems[tools.getKeyName(systemName)] = systemObj;
            // factionObj['systems'][tools.getKeyName(systemFaction['systemName'])] = systemFaction;
        } else {
            console.warn(`${factionObj['systemNames'][i]}: ${factionObj.name} system is null`);                
        }
    }

    return systems;
}

async function addSystemSubscription(systemName, channelID) {
    const systemKeyName = tools.getKeyName('system', systemName);

    var jsonData = await redisClient.json_getAsync(systemKeyName);

    if (jsonData != null) {
        var systemData = JSON.parse(jsonData);

        if ("subscriptions" in systemData === false) {
            systemData["subscriptions"] = {};
        }

        if (channelID in systemData["subscriptions"]) {
            return "alreadySubscribed";
        }

        systemData["subscriptions"][channelID] = {};

        var result = await redisClient.json_setAsync(systemKeyName, 'subscriptions', JSON.stringify(systemData["subscriptions"]));

        return (result == "OK") ? "OK" : "error";
    } else {
        return "unknownSystem";
    }
}

module.exports = {
    setRedisClient: setRedisClient,
    getRedisClient: function() {
        return redisClient;
    },

    storeSystem,
    storeFaction,
    updateFactionDetails,
    updateFactionSystemNames,
    getOldFactionSystemNames,

    getSystemCount,
    getFactionCount,

    incrementVisitCounts,

    getSystem,
    getFaction,
    getFactionSystems,

    addSystemSubscription
  };
