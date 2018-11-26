const data = require('../modules/data');
const tools = require('../modules/tools');
var fs = require('fs');
var config = require('config');

var dataDir = config.get('dataDir');

function convertEDSMSystem(edsmObj) {
    var systemObj = {};
    const systemName = edsmObj['name'];

    var now = Date.now();
    systemObj['lastUpdate'] = now;

    systemObj['name'] = systemName;
    systemObj['controllingFaction'] = edsmObj['controllingFaction']['name'];
    systemObj['factions'] = {};

    for (const factionIndex in edsmObj['factions']) {
        const edsmFaction = edsmObj['factions'][factionIndex];
        const factionName = edsmFaction['name'];
        var outFaction = {};

        outFaction['name'] = factionName;
        outFaction['allegiance'] = edsmFaction['allegiance'];
        outFaction['government'] = edsmFaction['government'];
        outFaction['influence'] = edsmFaction['influence'];

        if ('pendingStates' in edsmFaction && edsmFaction['pendingStates'].length > 0) {
            outFaction['pendingStates'] = edsmFaction['pendingStates'];
        }

        if ('recoveringStates' in edsmFaction && edsmFaction['recoveringStates'].length > 0) {
            outFaction['recoveringStates'] = edsmFaction['recoveringStates'];
        }

        if ('activeStates' in edsmFaction && edsmFaction['activeStates'].length > 0) {
            outFaction['activeStates'] = edsmFaction['activeStates'];
        }
        else if ('state' in edsmFaction && edsmFaction['state'] != 'None') {
            outFaction['activeStates'] = [ { 'state': edsmFaction['state']} ];
        }

        systemObj['factions'][tools.getKeyName(factionName)] = outFaction;
    }

    return systemObj;
}

module.exports = {
    loadFromFile: function () {
        var edsmData = JSON.parse(fs.readFileSync(dataDir + '/edsm_systems.json', 'utf8'));
        var multi = data.getRedisClient().multi();
        for (var sn in edsmData) {
            const edsmObj = edsmData[sn];
            const systemObj = convertEDSMSystem(edsmObj);
            data.hsetPackedObject(multi, tools.getKeyName('system', sn), systemObj);
        }
        multi.exec(function (err, replies) {
            console.log("MULTI got " + replies.length + " replies");
            // replies.forEach(function (reply, index) {
            //     console.log("Reply " + index + ": " + reply.toString());
            // });
        });

        return edsmData.keys().length;
    },
};