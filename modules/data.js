var redis = require("redis");
var config = require('config');
var fs = require('fs');
var flatten = require('flat')
var bluebird = require('bluebird');
var request = require('request-promise');

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

function getKeyName(objType, objName) {
    if (objName !== undefined) {
        return objType + ':' + objName.replace(/ /g, '_');
    } else {
        return objType.replace(/ /g, '_');
    }
}

function convertEDSMSystem(edsmObj) {
    var systemObj = {};
    const systemName = edsmObj['name'];

    var now = Date.now() / 1000;
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

        systemObj['factions'][getKeyName(factionName)] = outFaction;
    }

    return systemObj;
}

function storeSystem(multi, systemName, systemObj) {
    // var multi = redisClient.multi();
    hsetPackedObject(multi, getKeyName('system', systemName), systemObj);
    // multi.exec(function (err, replies) {
    //     console.log(systemName + ": MULTI got " + replies.length + " replies");
    // });
}

function storeFactionDetails(multi, factionName, factionAllegiance, factionGovernment) {
    const keyName = getKeyName('faction', factionName);
    if (factionAllegiance !== undefined) {
        multi.hset(keyName, 'allegiance', factionAllegiance);
    }
    if (factionGovernment !== undefined) {
        multi.hset(keyName, 'government', factionGovernment);
    }
}

function storeFactionSystem(multi, factionName, systemName, factionSystemObj) {
    const keyName = getKeyName('faction', factionName);
    const flatData = flatten(factionSystemObj);
    const attrPrefix = 'systems.' + systemName.replace(/ /g, '_') + '.';
    for (var attr in flatData) {
        if (Array.isArray(flatData[attr])) {
            multi.hset(keyName, attrPrefix + attr, "∅");
        } else {
            multi.hset(keyName, attrPrefix + attr, flatData[attr]);
        }
    }

}

module.exports = {
    getRedisClient: function() {
        return redisClient;
    },

    hsetPackedObject: hsetPackedObject,

    getKeyName: getKeyName,
    storeSystem: storeSystem,
    storeFactionDetails: storeFactionDetails,
    storeFactionSystem: storeFactionSystem,


    loadFromFile: function () {
        var edsmData = JSON.parse(fs.readFileSync(dataDir + '/edsm_systems.json', 'utf8'));
        var multi = redisClient.multi();
        for (var sn in edsmData) {
            const edsmObj = edsmData[sn];
            const systemObj = convertEDSMSystem(edsmObj);
            hsetPackedObject(multi, getKeyName('system', sn), systemObj);
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
        var systemKeyName = getKeyName('system', systemName);
        return new Promise(function (resolve, reject) {
            redisClient.hgetallAsync(systemKeyName).then(function (flatData) {
                if (flatData != null) {
                    var systemObj = unpackObject(flatData);
                    resolve(systemObj);
                } else {
                    /*
                    // Fetch from edsm
                    var uri = 'https://www.edsm.net/api-system-v1/factions?systemName=' + encodeURIComponent(systemName) + '&showHistory=0';
                    request({
                        "method":"GET", 
                        "uri": uri,
                        "json": true,
                        "headers": {
                          "User-Agent": "edbot/0.1"
                        }
                    }).then(function (edsmObj) {
                        var systemObj = convertEDSMSystem(edsmObj)
                        console.dir(systemObj);

                        // Cache this system
                        var multi = redisClient.multi();
                        hsetPackedObject(multi, systemKeyName, systemObj);
                        multi.exec(function (err, replies) {
                            console.log("MULTI got " + replies.length + " replies");
                            // replies.forEach(function (reply, index) {
                            //     console.log("Reply " + index + ": " + reply.toString());
                            // });
                        });
                        
                        resolve(systemObj);
                    });
                    */
                    resolve({});
                }
            }, function(err) {
                reject(err); // Pass the error to our caller
            });
        });
    }
  };
