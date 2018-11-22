function parseStates(inList) {
	var outList = [];
	
	for (var index in inList) {
		var inObj = inList[index];
		var elt = inObj["state"];
		if (inObj['trend'] > 0) {
			elt += "˄";
		} else if (inObj['trend'] < 0) {
			elt += "˅";
		}
		outList.push(elt);
	}
	
	return outList;
}

function getKeyName(objType, objName) {
    if (objName !== undefined) {
        return objType + ':' + objName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    } else {
        return objType.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
}

function orderByInfluence(a, b) {
	return Math.sign(b.influence - a.influence); //(a.influence > b.influence) ? 1 : ((b.influence > a.influence) ? -1 : 0);
}

function sortByInfluence(factions) {
	var factionList = Array.isArray(factionList) ? factions : Object.values(factions);

	factionList.sort(orderByInfluence);

	return factionList;
}

module.exports = {
    parseStates: parseStates,
	getKeyName: getKeyName,
	sortByInfluence: sortByInfluence
}
