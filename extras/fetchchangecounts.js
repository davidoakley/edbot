"use strict";
 
/* eslint-disable no-await-in-loop */

var dateFormat = require('dateformat');
const config = require('config');
const mongoClient = require('mongodb').MongoClient;

// const redis = require("redis");
// const rejson = require('redis-rejson');
// rejson(redis);

// const bluebird = require('bluebird');
// bluebird.promisifyAll(redis);

// const redisClient = redis.createClient();

updatePlayerFactions().then(function() {
    console.log("Finished");
    process.exit();
})

async function updatePlayerFactions() {
    var changeKeys = [];

    console.log('Connecting to MongoDB...');
	const db = await mongoClient.connect(config.get("mongoUrl"));
	console.log('Connected to MongoDB');

/*
    var cursor = 0;
    // var changeMap = {};
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
    */
    const msPerQuarterHour = 1000*60*15;
    var thisQuarterHour = Math.floor(Date.now() / msPerQuarterHour) * msPerQuarterHour;
    var startQuarterHour = thisQuarterHour - 1000*60*60*36;

    for (let i = startQuarterHour; i <= thisQuarterHour; i += msPerQuarterHour) {
        changeKeys.push(i);
    }

    var cursor = db.collection('changeCounts').find({ date: { $in: changeKeys } });

    var resultList = await cursor.toArray();

    for (const i in resultList) {
        const timestamp = new Date(resultList[i].date);
        const dateString = dateFormat(timestamp, "UTC:HH:MM");
        const count = resultList[i].count;

        console.log(dateString + "\t" + count);
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
