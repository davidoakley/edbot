"use strict";
 
/* eslint-disable no-await-in-loop */

// const tools = require('../modules/tools');

// const fetch = require("node-fetch");

var dateFormat = require('dateformat');

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();

updatePlayerFactions().then(function() {
    console.log("Finished");
    process.exit();
})

async function updatePlayerFactions() {

    var cursor = 0;
    // var changeMap = {};
    var changeKeys = [];
    try {
        do {
            const result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'changeCount:*'); // eslint-disable-line no-await-in-loop
            cursor = result.shift();
            const keyList = result.shift();

            changeKeys = changeKeys.concat(keyList);
        } while (cursor != 0);
    } catch (error) {
        console.log(error);
        return 0;
    }

    changeKeys.sort();

    const resultList = await redisClient.mgetAsync(...changeKeys);

    for (const i in resultList) {
        const timestamp = new Date(parseInt(changeKeys[i].substr(12), 10));
        const dateString = dateFormat(timestamp, "UTC:HH:MM");
        const count = resultList[i];

        console.log(dateString + ": " + count);
    }

    // console.log(result);


    /*
    const multi = redisClient.multi();

    console.log('Creating update list');
    var skipCount = 0;
    for (var pf of playerFactionList) {
        const keyName = tools.getKeyName('faction', pf);
        const jsonData = await redisClient.json_getAsync(keyName);

        if (jsonData != null) {
            const factionObj = JSON.parse(jsonData);

            factionObj.isPlayer = true;
            multi.json_set(keyName, '.', JSON.stringify(factionObj));
        } else {
            skipCount++;
        }
    }
    console.log(`${skipCount} unknown factions skipped`);

    console.log('Applying changes');
    const replies = await multi.execAsync();
    const count = replies.length;

    console.log(`Updated ${count} keys`);
    */

    return undefined;
}
