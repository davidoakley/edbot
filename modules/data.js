var redis = require("redis");
var config = require('config');
var fs = require('fs');
var flatten = require('flat')
var bluebird = require('bluebird');
var tools = require('./tools');
// var request = require('request-promise');

bluebird.promisifyAll(redis);

var dataDir = config.get('dataDir');
var redisClient = redis.createClient();
var unflatten = require('flat').unflatten

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

redisClient.on('connect', function() {
    console.log("Redis connected");
});

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

function convertEDSMSystem(edsmObj) {
    var systemObj = {};
    const systemName = edsmObj['name'];

    var now = Date.now();
    systemObj['lastUpdate'] = now;

    systemObj['name'] = systemName;
    systemObj['controllingFaction'] = edsmObj['controllingFaction']['name'];
    systemObj['factions'] = {};

    for (var factionIndex in edsmObj['factions']) {
        const edsmFaction = edsmObj['factions'][factionIndex];
        const factionName = edsmFaction['name'];
        var outFaction = {};

        outFaction['name'] = factionName;
        outFaction['allegiance'] = edsmFaction['allegiance'];
        outFaction['government'] = edsmFaction['government'];
        outFaction['influence'] = edsmFaction['influence'];

        if ('pendingStates' in edsmFaction && edsmFaction['pendingStates'].length > 0) {
            outFaction['pendingStates'] = edsmFaction['pendingStates'];
        }

        if ('recoveringStates' in edsmFaction && edsmFaction['recoveringStates'].length > 0) {
            outFaction['recoveringStates'] = edsmFaction['recoveringStates'];
        }

        if ('activeStates' in edsmFaction && edsmFaction['activeStates'].length > 0) {
            outFaction['activeStates'] = edsmFaction['activeStates'];
        }
        else if ('state' in edsmFaction && edsmFaction['state'] != 'None') {
            outFaction['activeStates'] = [ { 'state': edsmFaction['state']} ];
        }

        systemObj['factions'][tools.getKeyName(factionName)] = outFaction;
    }

    return systemObj;
}

function storeSystem(multi, systemName, systemObj) {
    // var multi = redisClient.multi();
    hsetPackedObject(multi, tools.getKeyName('system', systemName), systemObj);
    // multi.exec(function (err, replies) {
    //     console.log(systemName + ": MULTI got " + replies.length + " replies");
    // });
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
    for (var attr in flatData) {
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

module.exports = {
    getRedisClient: function() {
        return redisClient;
    },

    hsetPackedObject: hsetPackedObject,

    storeSystem: storeSystem,
    storeFactionDetails: storeFactionDetails,
    storeFactionSystem: storeFactionSystem,

    getSystemCount: getSystemCount,
    getFactionCount: getFactionCount,

    loadFromFile: function () {
        var edsmData = JSON.parse(fs.readFileSync(dataDir + '/edsm_systems.json', 'utf8'));
        var multi = redisClient.multi();
        for (var sn in edsmData) {
            const edsmObj = edsmData[sn];
            const systemObj = convertEDSMSystem(edsmObj);
            hsetPackedObject(multi, tools.getKeyName('system', sn), systemObj);
        }
        multi.exec(function (err, replies) {
            console.log("MULTI got " + replies.length + " replies");
            // replies.forEach(function (reply, index) {
            //     console.log("Reply " + index + ": " + reply.toString());
            // });
        });

        return edsmData.keys().length;
    },

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
