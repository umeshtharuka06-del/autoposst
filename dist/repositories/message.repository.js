"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRepository = exports.MessageRepository = void 0;
const prisma_1 = require("../lib/prisma");
class MessageRepository {
    create(params) {
        return prisma_1.prisma.telegramMessage.create({ data: params });
    }
    linkToPost(ids, postId) {
        return prisma_1.prisma.telegramMessage.updateMany({ where: { id: { in: ids } }, data: { postId } });
    }
}
exports.MessageRepository = MessageRepository;
exports.messageRepository = new MessageRepository();
//# sourceMappingURL=message.repository.js.map