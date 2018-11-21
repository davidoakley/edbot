const zlib = require('zlib');
const zmq = require('zeromq');
const data = require('./data');

const sock = zmq.socket('sub');

module.exports = {
    connect: function () {
        sock.connect('tcp://eddn.edcd.io:9500');
        console.log('Connected to EDDN port 9500');
        
        sock.subscribe('');
        
        sock.on('message', topic => {
            var inData = JSON.parse(zlib.inflateSync(topic));
            // console.log(JSON.stringify(JSON.parse(zlib.inflateSync(topic)), null, 2));
        
            if (inData["$schemaRef"] == "https://eddn.edcd.io/schemas/journal/1") {
                parseJournal(inData);
            }
          });
    }
}

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
    const systemName = msgData['StarSystem'];
    const event = msgData['event'];

    if ("Factions" in msgData && event == "FSDJump") {
        console.log("Message for "+systemName + " with factions");
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
            var outFaction = {};
            outFaction['name'] = inFaction['Name'];
            if ('Allegiance' in inFaction) {
                outFaction['allegiance'] = inFaction['Allegiance'];
            }
            if ('Government' in inFaction) {
                outFaction['government'] = inFaction['Government'];
            }
            if ('Influence' in inFaction) {
                outFaction['influence'] = inFaction['Influence'];
            }

            // outFaction['state'] = inFaction['FactionState'];
            if ('PendingStates' in inFaction && inFaction['PendingStates'].length > 0) {
                outFaction['pendingStates'] = convertStates(inFaction['PendingStates']);
            }
    
            if ('RecoveringStates' in inFaction && inFaction['RecoveringStates'].length > 0) {
                outFaction['RecoveringStates'] = convertStates(inFaction['RecoveringStates']);
            }
    
            if ('ActiveStates' in inFaction && inFaction['ActiveStates'].length > 0) {
                outFaction['activeStates'] = convertStates(inFaction['ActiveStates']);
            }
            else if ('State' in inFaction && inFaction['State'] != 'None') {
                outFaction['activeStates'] = [ { 'state': inFaction['State']} ];
            }
    
            const factionKeyName = inFaction['Name'].replace(/ /g, '_');
            systemObj['factions'][factionKeyName] = outFaction;
        }
        console.dir(systemObj);

        /*
        var multi = redisClient.multi();
        hsetPackedObject(multi, getKeyName('system', systemName), systemObj);
        multi.exec(function (err, replies) {
            console.log(systemName + ": MULTI got " + replies.length + " replies");
            // replies.forEach(function (reply, index) {
            //     console.log("Reply " + index + ": " + reply.toString());
            // });
        });
        */
       data.storeSystem(systemName, systemObj);
    }
}