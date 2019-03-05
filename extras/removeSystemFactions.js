"use strict";

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();

removeSystemFactions().then(function() {
    console.log("Finished");
})

async function removeSystemFactions() {
    var cursor = 0;
    var delCount = 0;
    try {
        do {
            var result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'systemFaction:*'); // eslint-disable-line no-await-in-loop
            cursor = result.shift();
            const keyList = result.shift();
            const count = await redisClient.delAsync(...keyList);
            delCount += count;

            //systemCount += keyList.length;
            console.log(`Deleted ${delCount} keys`);
        } while (cursor != 0);
    } catch (error) {
        console.log(error);
        return 0;
    }
}
