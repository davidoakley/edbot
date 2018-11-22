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
        return objType + ':' + objName.replace(/ /g, '_');
    } else {
        return objType.replace(/ /g, '_');
    }
}


module.exports = {
    parseStates = parseStates,
    getKeyName = getKeyName
}
