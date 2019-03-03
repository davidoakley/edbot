"use strict";

//var moment = require('moment');

class System {
    constructor(name, updatedBy) {
        this.name = name;
        this.updatedBy = updatedBy;
        this.lastUpdate = Date.now();
    }

}

module.exports = System;
