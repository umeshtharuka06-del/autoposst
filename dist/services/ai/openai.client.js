"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../../config/env");
exports.openai = new openai_1.default({
    apiKey: env_1.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 120_000,
});
//# sourceMappingURL=openai.client.js.map