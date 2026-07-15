"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMediaWorker = startMediaWorker;
const client_1 = require("@prisma/client");
const types_1 = require("../../types");
const media_service_1 = require("../../services/media/media.service");
const post_repository_1 = require("../../repositories/post.repository");
const queues_1 = require("../queues");
const worker_utils_1 = require("../worker-utils");
function startMediaWorker() {
    return (0, worker_utils_1.createWorker)(types_1.QUEUE_NAMES.media, async (job) => {
        const { postId } = job.data;
        await media_service_1.mediaService.processPostMedia(postId);
        await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.GENERATING);
        await (0, queues_1.enqueueAiGeneration)(postId);
    });
}
//# sourceMappingURL=media.worker.js.map