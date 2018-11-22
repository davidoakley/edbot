var redis = require("redis");
var config = require('config');
var fs = require('fs');
// var flatten = require('flat')
var bluebird = require('bluebird');
// var request = require('request-promise');
const tools = require('./modules/tools');

bluebird.promisifyAll(redis);

var dataDir = config.get('dataDir');
var redisClient = redis.createClient();
// var unflatten = require('flat').unflatten

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

redisClient.on('connect', function() {
    console.log("Redis connected");
    loadData();
});

function loadData() {
    console.log("Loading data...");

    var multi = redisClient.multi();
    var systemsData = JSON.parse(fs.readFileSync(dataDir + '/systemsPopulated.json', 'utf8'));

    console.log("Entering data...");
    for (var i in systemsData) {
        //console.log(systemsData[i].name);
        var systemName = systemsData[i]['name'];
        if (systemName === null) {
            console.log("NULL");
        }
        var keyName = tools.getKeyName("system", systemName);

        multi.hset(keyName, 'name', systemName);
        if ('population' in systemsData[i] && systemsData[i]['population'] !== null) {
            multi.hset(keyName, 'population', systemsData[i]['population']);
        }

        // console.log("> " + i + ": " + keyName + ", " + systemName + ", " + systemsData[i]['population']);
    }

    multi.exec(function (err, replies) {
        console.log("MULTI got " + replies.length + " replies");
        // replies.forEach(function (reply, index) {
        //     console.log("Reply " + index + ": " + reply.toString());
        // });
        process.exit(0);
    });

    console.log("Done.");
}