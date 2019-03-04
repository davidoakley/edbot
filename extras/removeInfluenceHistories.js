"use strict";

 /* eslint-disable no-await-in-loop */

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();

removeSystemFactions().then(function() {
    console.log("Finished");
})

function processSystem(keyName, systemObj, multi) {
    var changeCount = 0;

    if ('factions' in systemObj) {
        for (const factionKey in systemObj.factions) {
            if ('influenceHistory' in systemObj.factions[factionKey] && systemObj.factions[factionKey].influenceHistory.length > 0) {
                systemObj.factions[factionKey].influenceHistory = [];
                changeCount++;
            }
        }
    }

    if (changeCount > 0) {
        console.log(systemObj.name);
        multi.json_set(keyName, '.', JSON.stringify(systemObj));
    }
}

async function removeSystemFactions() {
    var cursor = 0;
    var updateCount = 0;
    try {
        do {
            var result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'system:*');
            cursor = result.shift();
            const keyList = result.shift();
            const multi = redisClient.multi();

            for (const keyName of keyList) {
                const jsonData = await redisClient.json_getAsync(keyName);
                const systemObj = JSON.parse(jsonData);

                processSystem(keyName, systemObj, multi);
            }

            const replies = await multi.execAsync();
            const count = replies.length;

            updateCount += count;

            //systemCount += keyList.length;
            console.log(`Updated ${updateCount} keys`);
        } while (cursor != 0);
    } catch (error) {
        console.log(error);
        return 0;
    }

    return undefined;
}
