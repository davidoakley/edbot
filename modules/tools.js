var dateFormat = require('dateformat');

var discordClient = undefined;

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

function getEliteDate(date) {
	return dateFormat(date, "UTC:HH:MM:ss") + " on " + dateFormat(date, "d mmm") + " " + (parseInt(dateFormat(date, "UTC:yyyy"), 10) + 1286);
}

function getMonospacedPercentage(percent, decimals, width) {
	const numberString = String(Number(percent).toFixed(decimals));
	const spaces = width - numberString.length - 1;
	var result = String.fromCodePoint(0x3000).repeat(spaces);

	for (var i in numberString) {
		if (numberString[i] >= '0' && numberString[i] <= '9') {
			result += String.fromCodePoint(0xFF00 + numberString.codePointAt(i) - 0x20);
		} else {
			result += numberString[i];
		}
	}

	result += String.fromCodePoint(0xFF05); // %

	return result;
}

function niceNumber(number) {
	if (number > 995000000) {
		return (number / 1000000000).toFixed(1).toString() + " billion";
	} else if (number > 995000) {
		return (number / 1000000).toFixed(1).toString() + " million";
	} else if (number >= 1000) {
		return Math.round(number / 1000).toString() + ",000";
	} else {
		return number.toString();
	}
}

module.exports = {
    parseStates: parseStates,
	getKeyName: getKeyName,
	sortByInfluence: sortByInfluence,
	getEliteDate: getEliteDate,
	getMonospacedPercentage: getMonospacedPercentage,
	niceNumber: niceNumber,
	setDiscordClient: function(client) { discordClient = client; },
	getDiscordClient: function() { return discordClient; },
	getMyAvatar: function() { return discordClient.user.avatar; },
	getMyUserId: function() { return discordClient.user.id; }
}
