"use strict";
 
/* eslint-disable no-await-in-loop */

const tools = require('../modules/tools');

const fetch = require("node-fetch");

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
    const playerFactionList = await getPlayerFactions();

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

    /*
    var cursor = 0;
    var updateCount = 0;
    try {
        do {
            var result = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', 'faction:*');
            cursor = result.shift();
            const keyList = result.shift();

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
    */

    return undefined;
}

async function getPlayerFactions() {
    console.log('Fetching faction data from EDDB');
    const response = await fetch('https://eddb.io/archive/v6/factions.json');
    const json = await response.json();
    // console.log(json);

    console.log('Scanning for player factions');
    var pfList = [];
    for (var f of json) {
        if (f.is_player_faction) {
            pfList.push(f.name);
        }
    }

    return pfList;
}
