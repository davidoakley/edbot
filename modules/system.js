"use strict";

//var moment = require('moment');

class System {
    constructor(name, thisUpdate, updatedBy) {
        this.name = name;
        this.updatedBy = updatedBy;
        this.lastSeen = thisUpdate;
        this.lastUpdate = thisUpdate;
    }

}

module.exports = System;
