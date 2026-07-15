"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAllWorkers = startAllWorkers;
exports.stopWorkers = stopWorkers;
const ai_worker_1 = require("./ai.worker");
const media_worker_1 = require("./media.worker");
const publish_worker_1 = require("./publish.worker");
const schedule_worker_1 = require("./schedule.worker");
function startAllWorkers() {
    return [(0, media_worker_1.startMediaWorker)(), (0, ai_worker_1.startAiWorker)(), (0, publish_worker_1.startPublishWorker)(), (0, schedule_worker_1.startScheduleWorker)()];
}
async function stopWorkers(workers) {
    await Promise.all(workers.map((w) => w.close()));
}
//# sourceMappingURL=index.js.map