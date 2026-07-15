"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("../config/env");
exports.logger = (0, pino_1.default)({
    level: env_1.env.LOG_LEVEL,
    base: { service: 'autopost' },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    transport: env_1.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
});
//# sourceMappingURL=logger.js.map