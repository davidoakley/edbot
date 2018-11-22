const io = require('@pm2/io')

io.init({
  metrics: {
    network: {
      ports: true
    }
  }
});

const zlib = require('zlib');
const zmq = require('zeromq');
const tools = require('./modules/tools');
const data = require('./modules/data');

const eventsProcessedCounter = io.counter({
    name: 'Events processed',
    type: 'counter',
});

const sock = zmq.socket('sub');

sock.connect('tcp://eddn.edcd.io:9500');
console.log('Connected to EDDN port 9500');

sock.subscribe('');

sock.on('message', topic => {
    try {
        var inData = JSON.parse(zlib.inflateSync(topic));

        if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/journal/1") {
            parseJournal(inData);
        }
    }
    catch (error) {
        console.error(error);
        // message.reply('there was an error trying to execute that command!');
    }       
});

function convertStates(eddnStates) {
    var outStates = [];

    for (var stateIndex in eddnStates) {
        var stateObj = {};
        if ('State' in eddnStates[stateIndex]) {
            stateObj['state'] = eddnStates[stateIndex]['State'];
        }
        if ('Trend' in eddnStates[stateIndex]) {
            stateObj['trend'] = eddnStates[stateIndex]['Trend'];
        }

        outStates.push(stateObj);
    }

    return outStates;
}

function parseJournal(inData) {
    const msgData = inData["message"];
    const event = msgData['event'];
    if ("Factions" in msgData && event == "FSDJump") {
        parseFSDJump(msgData);
    }
}

function parseFSDJump(msgData) {
    const systemName = msgData['StarSystem'];
    const multi = data.getRedisClient().multi();
    // console.log("Message for "+systemName + " with factions");
    const inFactionsData = msgData["Factions"];

    var systemObj = {};
    systemObj['name'] = systemName;
    
    var now = Date.now() / 1000;
    systemObj['lastUpdate'] = now;

    if ('SystemFaction' in msgData) {
        systemObj['controllingFaction'] = msgData['SystemFaction'];
    }

    systemObj['factions'] = {};
    for (var index in inFactionsData) {
        const inFaction = inFactionsData[index];
        const factionName = inFaction['Name'];

        if (factionName == 'Pilots Federation Local Branch' && (!('Influence' in inFaction) || inFaction['Influence'] == 0)) {
            continue;
        }

        var factionObj = {};

        var factionSystemObj = {};
        var factionAllegiance = undefined;
        var factionGovernment = undefined;

        factionObj['name'] = factionName;
        factionSystemObj['lastUpdate'] = now;

        if ('Allegiance' in inFaction) {
            factionObj['allegiance'] = inFaction['Allegiance'];
            factionAllegiance = inFaction['Allegiance'];
        }
        if ('Government' in inFaction) {
            factionObj['government'] = inFaction['Government'];
            factionGovernment = inFaction['Government'];
        }
        if ('Influence' in inFaction) {
            factionObj['influence'] = inFaction['Influence'];
            factionSystemObj['influence'] = inFaction['Influence'];
        }

        if ('PendingStates' in inFaction && Array.isArray(inFaction['PendingStates']) && inFaction['PendingStates'].length > 0) {
            factionObj['pendingStates'] = convertStates(inFaction['PendingStates']);
            factionSystemObj['pendingStates'] = factionObj['pendingStates'];
        }

        if ('RecoveringStates' in inFaction && Array.isArray(inFaction['RecoveringStates']) && inFaction['RecoveringStates'].length > 0) {
            factionObj['recoveringStates'] = convertStates(inFaction['RecoveringStates']);
            factionSystemObj['recoveringStates'] = factionObj['recoveringStates'];
        }

        if ('ActiveStates' in inFaction && Array.isArray(inFaction['ActiveStates']) && inFaction['ActiveStates'].length > 0) {
            factionObj['activeStates'] = convertStates(inFaction['ActiveStates']);
            factionSystemObj['activeStates'] = factionObj['activeStates'];
        }
        else if ('State' in inFaction && inFaction['State'] != 'None') {
            factionObj['activeStates'] = [ { 'state': inFaction['State']} ];
            factionSystemObj['activeStates'] = factionObj['activeStates'];
        }

        const factionKeyName = tools.getKeyName(inFaction['Name']);
        systemObj['factions'][factionKeyName] = factionObj;

        data.storeFactionDetails(multi, factionName, factionAllegiance, factionGovernment);
        data.storeFactionSystem(multi, factionName, systemName, factionSystemObj);
    }

    data.storeSystem(multi, systemName, systemObj)

    multi.exec(function (err, replies) {
        if (err == null) {
            var updates = 0;
            var inserts = 0;
            for (var index in replies) {
                if (replies[index] == 1) {
                    inserts++;
                } else {
                    updates++;
                }
            }
            console.log(systemName + ": " + inserts + " inserts, " + updates + " updates");
            eventsProcessedCounter.inc(1);
        } else {
            console.error(systemName + ": MULTI error: " + err);
        }
    });
}