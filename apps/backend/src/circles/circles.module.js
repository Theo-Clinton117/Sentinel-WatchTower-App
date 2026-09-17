"use strict";
const { Module } = require("@nestjs/common"); const { CirclesController } = require("./circles.controller"); const { CirclesService } = require("./circles.service");
let CirclesModule = class CirclesModule {}; CirclesModule = Module({ controllers:[CirclesController], providers:[CirclesService] })(CirclesModule) || CirclesModule; exports.CirclesModule = CirclesModule;
