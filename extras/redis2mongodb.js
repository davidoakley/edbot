"use strict";

 /* eslint-disable no-await-in-loop */

const config = require("config");

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();

var mongoClient = require('mongodb').MongoClient;
var url = config.get("mongoUrl");

if (config.has('wakeOnLan')) {
    const wol = require('wol'); 
    wol.wake(config.get('wakeOnLan'), function(err, res){
        console.log("Wake on LAN: " + res);
    });
}

run();

async function run() {
    const db = await mongoClient.connect(url);

    await copy(db, 'systems', 'system');
    console.log("Creating systems indexes");
    await db.collection('systems').createIndex({ 'lcName': 1 }, { unique: true });

    await copy(db, 'factions', 'faction');
    console.log("Creating factions indexes");
    await db.collection('factions').createIndex({ 'lcName': 1 }, { unique: true });

    try {
        await db.dropCollection('changeCounts');
    } catch (error) {
        console.log(error);
    }

    //     collection.createIndex( { [keyName]: "text" } )

    console.log("Done.");
    db.close();
    process.exit();
}

async function copy(db, collectionName, keyName) {
    var cursor = 0;
    var updateCount = 0;

    console.log(`Dropping existing ${collectionName} collection`);
    try {
        await db.dropCollection(collectionName);
    } catch (error) {
        console.log(error);
    }

    var collection = db.collection(collectionName);

    console.log(`Copying ${collectionName}s`);
    try {
        do {
            var redisResult = await redisClient.scanAsync(cursor, 'COUNT', 1000, 'MATCH', `${keyName}:*`);
            cursor = redisResult.shift();
            const keyList = redisResult.shift();
            var insertList = [];

            for (const keyName of keyList) {
                const jsonData = await redisClient.json_getAsync(keyName);
                var obj = JSON.parse(jsonData);
                obj['lcName'] = obj['name'].toLowerCase();

                insertList.push(obj);
            }

            const dbResult = await collection.insertMany(insertList);

            updateCount += dbResult.result.n;

            console.log(`${collectionName}: Updated ${updateCount} keys`);
        } while (cursor != 0);
    } catch (error) {
        console.log(error);
        return 0;
    }

    return undefined;
}
