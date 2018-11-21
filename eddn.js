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
    const multi = data.getRedisClient().multi();

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

        var factionSystemMapObj = {};
    
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
    
            const factionKeyName = inFaction['Name'].replace(/ /g, '_');
            systemObj['factions'][factionKeyName] = factionObj;

            data.storeFactionDetails(multi, factionName, factionAllegiance, factionGovernment);
            data.storeFactionSystem(multi, factionName, systemName, factionSystemObj);
        }

        data.storeSystem(multi, systemName, systemObj)

        multi.exec(function (err, replies) {
            if (err == null) {
                console.log(systemName + ": MULTI got " + replies.length + " replies");
            } else {
                console.error(systemName + ": MULTI error: " + err);
            }
        });
   
    }
}