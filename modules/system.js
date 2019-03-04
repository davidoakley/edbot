"use strict";

//var moment = require('moment');

class System {
    constructor(name, updatedBy) {
        this.name = name;
        this.updatedBy = updatedBy;
        this.lastSeen = Date.now();
        this.lastUpdate = Date.now();
    }

}

module.exports = System;
