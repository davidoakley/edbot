"use strict";

// var redis = require("redis");
// var fs = require('fs');
const tools = require('./tools');
// const dateFormat = require('dateformat');
const changeTracking = require('./changeTracking');
// const System = require('./system');
// var request = require('request-promise');

// var bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

//var redisClient = undefined; // = redis.createClient();
var db = undefined;

function setMongoDB(_db) {
    db = _db;
}

async function storeSystem(/*multi,*/ systemName, newSystemObj, oldSystemObj) {
    //const keyName = tools.getKeyName('system', systemName);
    try {
        const collection = db.collection('systems');

        newSystemObj['lcName'] = newSystemObj['name'].toLowerCase();

        if (!('name' in oldSystemObj)) {
            // New system: store in redis and return
            // multi.json_set(keyName, '.', JSON.stringify(newSystemObj));
            console.log("Inserting system " + systemName);
            await collection.insertOne(newSystemObj);

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
            }

            // await collection.insertOne(newSystemObj);
            await collection.updateOne({lcName: systemName.toLowerCase()}, {$set: newSystemObj});
            await incrementChangeCount();
        } else {
            // No changes - just update lastSeen
            // multi.json_set(keyName, 'lastSeen', JSON.stringify(newSystemObj['lastSeen']));
            await collection.updateOne({lcName: systemName.toLowerCase()}, {$set: {lastSeen: newSystemObj['lastSeen']}});
        }

        return changeList;
    } catch (error) {
        console.error(`storeSystem error: ${error}`);
    }
}

async function storeSystemStation(systemName, newSystemObj) {
    //const keyName = tools.getKeyName('system', systemName);
    try {
        const collection = db.collection('systems');

        newSystemObj['lcName'] = newSystemObj['name'].toLowerCase();

        await collection.updateOne({lcName: systemName.toLowerCase()}, {$set: newSystemObj});

        return;
    } catch (error) {
        console.error(`storeSystemStation error: ${error}`);
    }
}
async function storeFaction(/*multi,*/ factionName, factionObj) {
    //const keyName = tools.getKeyName('faction', factionName);
    //multi.json_set(keyName, '.', JSON.stringify(factionObj));
    factionObj['lcName'] = factionObj['name'].toLowerCase();

    try {
        const collection = db.collection('factions');
        const updateResult = await collection.updateOne({lcName: factionObj['lcName']}, {$set: factionObj} /*, {upsert: true}*/);
        if (updateResult.matchedCount < 1) {
            const insertResult = await collection.insertOne(factionObj);
            console.log(`Insert: ${insertResult}`);
        }
    } catch (error) {
        console.error(`storeFaction error: ${error}`);
    }
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

async function incrementChangeCount(/*multi*/) {
    try {
        var collection = db.collection('changeCounts');
        // const hourlyKeyName = baseKeyName + ":" + dateFormat("yyyy-mm-dd_HH");
        const msPerQuarterHour = 1000*60*15;
        var thisQuarterHour = Math.floor(Date.now() / msPerQuarterHour) * msPerQuarterHour;

        await collection.updateOne({date: thisQuarterHour}, {$inc: {count: 1}}, {upsert: true});
        // const keyName = 'changeCount:' + thisQuarterHour;
        // multi.incr(keyName);
        // multi.expire(keyName, 60*60*24*2); // Keep this value for 2 days
    } catch (error) {
        console.error(`incrementChangeCount error: ${error}`);
    }
}

async function logVisitCount(uploaderID, systemName, event, thisUpdate) {
    try {
        var collection = db.collection('visitCounts');
        await collection.insertOne({
            systemName: systemName,
            uploaderID: uploaderID,
            event: event,
            date: new Date(thisUpdate)
        });
    } catch (error) {
        console.error(`incrementVisitCount error: ${error}`);
    }  
}

async function getSystem(systemName) {
    var cursor = db.collection('systems').find({ lcName: systemName.toLowerCase() });

    try {
        const system = await cursor.limit(1).next();
        return system;
    } catch (error) {
        console.error(`getSystem error: ${error}`);
        return null;
    }
}

async function getFaction(factionName) {
    var cursor = db.collection('factions').find({ lcName: factionName.toLowerCase() });

    try {
        const faction = await cursor.limit(1).next();
        return faction;
    } catch (error) {
        console.error(`getFaction error: ${error}`);
        return null;
    }
}

async function getFactionSystems(factionObj) {
    var lcSysNames = [];
    for (const systemName of factionObj['systemNames']) {
        lcSysNames.push(systemName.toLowerCase());
    }

    var cursor = db.collection('systems').find({ lcName: { $in: lcSysNames } });

    var resultList = await cursor.toArray();

    var systems = {};
    const factionKey = tools.getKeyName(factionObj.name);

    for (let i in resultList) {
        if (resultList[i] != null) {
            const fetchedSystemObj = resultList[i];
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
    setMongoDB,
    getMongoDB: function() {
        return db;
    },

    storeSystem,
    storeSystemStation,
    storeFaction,
    getOldFactionSystemNames,

    getSystemCount,
    getFactionCount,

    logVisitCount,

    getSystem,
    getFaction,
    getFactionSystems,

    addSystemSubscription
  };
