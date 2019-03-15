"use strict";

 /* eslint-disable no-await-in-loop */

const redis = require("redis");
const rejson = require('redis-rejson');
rejson(redis);

const bluebird = require('bluebird');
bluebird.promisifyAll(redis);

const redisClient = redis.createClient();

var mongoClient = require('mongodb').MongoClient;
// var assert = require('assert');

var url = 'mongodb://localhost:27017/edbot';

run();

async function run() {
    const db = await mongoClient.connect(url);

    await copy(db, 'systems', 'system');
    await copy(db, 'factions', 'faction');

    console.log("Creating indexes");
    await db.collection('systems').createIndex({ 'name': 1 }, { unique: true });
    await db.collection('factions').createIndex({ 'name': 1 }, { unique: true });

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
                const systemObj = JSON.parse(jsonData);

                insertList.push(systemObj);
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
