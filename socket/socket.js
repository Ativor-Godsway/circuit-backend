import jwt from 'jsonwebtoken';
import CommunityMessage from '../models/CommunityMessage.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { updateStreak } from '../utils/streakUpdater.js';
import { updateCircuitScore } from '../utils/circuitScoreUpdater.js';

// userId -> socketId
const onlineUsers = new Map();

// userId -> otherUserId they currently have open in DM
const activeDMRoom = new Map();

export const initSocket = (io) => {
  // ── Auth middleware ─────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
      io.emit('userOnline', userId);
    }

    // ── Community chat ──────────────────────────────────────────────────────
    socket.on('joinCommunity', (communityId) => {
      socket.join(`community:${communityId}`);
    });

    socket.on('leaveCommunity', (communityId) => {
      socket.leave(`community:${communityId}`);
    });

    // New unified event: sendCommunityMessage
    socket.on('sendCommunityMessage', async (data) => {
      // data: { communityId, text, image? }
      try {
        const msg = await CommunityMessage.create({
          community: data.communityId,
          sender: userId,
          text: data.text || '',
          image: data.image || '',
        });

        const populated = await msg.populate('sender', '_id name avatar');
        if (userId) {
          await updateStreak(userId, data.communityId);
          updateCircuitScore(userId); // non-blocking
        }

        io.to(`community:${data.communityId}`).emit('receiveCommunityMessage', populated);
      } catch {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicators for group chat
    socket.on('communityTyping', ({ communityId, userName }) => {
      socket.to(`community:${communityId}`).emit('communityTyping', { userId, userName, communityId });
    });

    socket.on('communityStopTyping', ({ communityId }) => {
      socket.to(`community:${communityId}`).emit('communityStopTyping', { userId, communityId });
    });

    // ── DM: track which chat window user has open ───────────────────────────
    socket.on('setActiveDM', ({ otherUserId }) => {
      if (otherUserId) {
        activeDMRoom.set(userId, otherUserId);
      } else {
        activeDMRoom.delete(userId);
      }
    });

    // ── DM: send message via socket ─────────────────────────────────────────
    socket.on('sendMessage', async (data) => {
      // data: { receiverId, text, image? }
      try {
        const receiver = await User.findById(data.receiverId).select('_id');
        if (!receiver) return;

        const msg = await Message.create({
          sender: userId,
          receiver: receiver._id,
          text: data.text || '',
          image: data.image || '',
          deliveredAt: new Date(),
        });

        const populated = await msg.populate([
          { path: 'sender', select: 'name avatar' },
          { path: 'receiver', select: 'name avatar' },
        ]);

        // Always deliver to receiver's personal room
        io.to(data.receiverId).emit('receiveMessage', populated);
        // Echo to sender (multi-tab support)
        io.to(userId).emit('receiveMessage', populated);

        // Send unread notification only if receiver doesn't have this chat open
        const receiverActiveDM = activeDMRoom.get(data.receiverId);
        if (receiverActiveDM !== userId) {
          io.to(data.receiverId).emit('newMessageNotification', {
            from: { _id: userId },
          });
        }
      } catch {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── DM: mark messages as read ───────────────────────────────────────────
    socket.on('markAsRead', async ({ senderId }) => {
      try {
        const now = new Date();
        await Message.updateMany(
          { sender: senderId, receiver: userId, isRead: false },
          { isRead: true, readAt: now }
        );
        // Notify the original sender their messages were read
        io.to(senderId).emit('messagesRead', { by: userId });
      } catch {
        // silent
      }
    });

    // ── Typing indicators ───────────────────────────────────────────────────
    socket.on('typing', ({ to }) => {
      io.to(to).emit('typing', { from: userId });
    });

    socket.on('stopTyping', ({ to }) => {
      io.to(to).emit('stopTyping', { from: userId });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        activeDMRoom.delete(userId);
        io.emit('userOffline', userId);
      }
    });
  });
};
