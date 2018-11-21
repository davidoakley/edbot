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
    //multi.del(keyName);
    var flatData = flatten(obj);
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
    return objType + ':' + objName.replace(/ /g, '_');
}

module.exports = {
    loadRedis: function () {
        var systemsData = JSON.parse(fs.readFileSync(dataDir + '/edsm_systems.json', 'utf8'));
        var multi = redisClient.multi();
        for (var sn in systemsData) {
            hsetPackedObject(multi, getKeyName('system', sn), systemsData[sn]);
        }
        multi.exec(function (err, replies) {
            console.log("MULTI got " + replies.length + " replies");
            // replies.forEach(function (reply, index) {
            //     console.log("Reply " + index + ": " + reply.toString());
            // });
        });
    },

    getSystem: function (systemName) {
        var systemKeyName = getKeyName('system', systemName);
        return new Promise(function (resolve, reject) {
            redisClient.hgetallAsync(systemKeyName).then(function (flatData) {
                if (flatData != null) {
                    var systemObj = unpackObject(flatData);
                    resolve(systemObj);
                } else {
                    // Fetch from edsm
                    var uri = 'https://www.edsm.net/api-system-v1/factions?systemName=' + encodeURIComponent(systemName) + '&showHistory=0';
                    request({
                        "method":"GET", 
                        "uri": uri,
                        "json": true,
                        "headers": {
                          "User-Agent": "edbot/0.1"
                        }
                    }).then(function (systemObj) {
                        console.dir(systemObj);

                        var now = Date.now() / 1000;
                        systemObj['lastUpdate'] = now;

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
                }
            }, function(err) {
                reject(err); // Pass the error to our caller
            });
        });
    }
  };
