const bluebird = require('bluebird');
const redis = require("redis");
const argv = require('yargs').argv; // https://github.com/yargs/yargs/blob/master/docs/examples.md
// const config = require('config');
// const fs = require('fs');
// const tools = require('./modules/tools');


bluebird.promisifyAll(redis);

const redisClient = redis.createClient();
// const unflatten = require('flat').unflatten

redisClient.on("error", function (err) {
    console.log("Error " + err);
});

async function loadEDSMSystemsPopulatedData() {
    console.log("Loading EDSM systemsPopulatedData data...");

    var multi = redisClient.multi();

    multi.set("foo", "bar");
    /*
    var dataDir = config.get('dataDir');
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
*/

    const result = await multi.execAsync();

    // multi.exec(function (err, replies) {
        console.log("MULTI got " + result.length + " replies");
        // replies.forEach(function (reply, index) {
        //     console.log("Reply " + index + ": " + reply.toString());
        // });
        // process.exit(0);
    // });

    console.log("Done.");
}

async function run() {
    // await redisClient.onAsync('connect');
    // console.log("Redis connected");

    if (argv.systemsPopulated) {
        await loadEDSMSystemsPopulatedData();
    }

    console.log("Exiting");
    process.exit(0);
}

run();