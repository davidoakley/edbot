// var redis = require("redis");
// var fs = require('fs');
var flatten = require('flat')
var tools = require('./tools');
var dateFormat = require('dateformat');
// var request = require('request-promise');

// var bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

var redisClient = undefined; // = redis.createClient();
var unflatten = require('flat').unflatten


function setRedisClient(client) {
    redisClient = client;
}

function hsetPackedObject(multi, keyName, obj) {
    multi.del(keyName);
    const flatData = flatten(obj);
    for (var attr in flatData) {
        if (Array.isArray(flatData[attr])) {
            multi.hset(keyName, attr, "∅");
        } else {
            multi.hset(keyName, attr, flatData[attr]);
        }
    }
}

function unpackObject(flatData) {
    for (var attr in flatData) {
        if (flatData[attr] == '∅') {
            flatData[attr] = []; // Create an empty array here
        }
    }

    return unflatten(flatData);
}

function getSystemChanges(oldSystemObj, newSystemObj) {
    if (!('name' in oldSystemObj)) {
        // New system
        return {
            property: "system",
            oldValue: undefined,
            newValue: newSystemObj
        };
    }

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
                property: property,
                oldValue: oldSystemObj[property],
                newValue: newSystemObj[property]
            });
        }
    }

    if ('economies' in oldSystemObj && JSON.stringify(oldSystemObj['economies']) != JSON.stringify(newSystemObj['economies'])) {
        changeList.push({
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
                property: 'faction:' + factionKey,
                oldValue: undefined,
                newValue: newSystemObj['factions'][factionKey]
            });
        } else if (!(factionKey in newSystemObj['factions'])) {
            // Retreated faction
            changeList.push({
                property: 'faction:' + factionKey,
                oldValue: newSystemObj['factions'][factionKey],
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

            for (const property of factionPropertyList) {
                if (oldSystemObj['factions'][factionKey][property] != newSystemObj['factions'][factionKey][property]) {
                    changeList.push({
                        property: 'faction:' + factionKey,
                        oldValue: oldSystemObj['factions'][factionKey][property],
                        newValue: newSystemObj['factions'][factionKey][property]
                    });
                }
            }        
        }

    }

    return changeList;
}

function storeSystem(multi, systemName, systemObj, oldSystemObj) {
    const keyName = tools.getKeyName('system', systemName);

    const changeList = getSystemChanges(oldSystemObj, systemObj);
    if (changeList.length > 0) {
        for (const change of changeList) {
            console.log(systemName + ": " + change.property + ": " + change.oldValue + " -> " + change.newValue);
        }
        hsetPackedObject(multi, keyName, systemObj);
    } else {
        // No changes - just update lastUpdate
        multi.hset(keyName, 'lastUpdate', systemObj['lastUpdate']);
    }
}

function storeFactionDetails(multi, factionName, factionAllegiance, factionGovernment) {
    const keyName = tools.getKeyName('faction', factionName);
    multi.hset(keyName, 'name', factionName);
    multi.hset(keyName, 'lastUpdate', Date.now());
    if (factionAllegiance !== undefined) {
        multi.hset(keyName, 'allegiance', factionAllegiance);
    }
    if (factionGovernment !== undefined) {
        multi.hset(keyName, 'government', factionGovernment);
    }
}

function storeFactionSystem(multi, factionName, systemName, factionSystemObj) {
    const keyName = tools.getKeyName('faction', factionName);
    const flatData = flatten(factionSystemObj);
    const attrPrefix = 'systems.' + tools.getKeyName(systemName) + '.';
    for (const attr in flatData) {
        if (Array.isArray(flatData[attr])) {
            multi.hset(keyName, attrPrefix + attr, "∅");
        } else {
            multi.hset(keyName, attrPrefix + attr, flatData[attr]);
        }
    }

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

    hsetPackedObject: hsetPackedObject,

    storeSystem: storeSystem,
    storeFactionDetails: storeFactionDetails,
    storeFactionSystem: storeFactionSystem,

    getSystemCount: getSystemCount,
    getFactionCount: getFactionCount,

    incrementVisitCounts: incrementVisitCounts,

    getSystem: function (systemName) {
        var systemKeyName = tools.getKeyName('system', systemName);
        return new Promise(function (resolve, reject) {
            redisClient.hgetallAsync(systemKeyName).then(function (flatData) {
                if (flatData != null) {
                    var systemObj = unpackObject(flatData);
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
            redisClient.hgetallAsync(factionKeyName).then(function (flatData) {
                if (flatData != null) {
                    var factionObj = unpackObject(flatData);
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
