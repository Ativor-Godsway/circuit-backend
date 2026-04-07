import Message from '../models/Message.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../middleware/uploadMiddleware.js';

// @desc    Get all conversations for current user (latest message per contact)
// @route   GET /api/messages/conversations
export const getConversations = async (req, res) => {
  const userId = req.user._id;

  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .populate('sender', 'name avatar')
    .populate('receiver', 'name avatar')
    .sort({ createdAt: -1 });

  const seen = new Set();
  const conversations = [];

  for (const msg of messages) {
    const other = msg.sender._id.equals(userId) ? msg.receiver : msg.sender;
    const key = other._id.toString();
    if (!seen.has(key)) {
      seen.add(key);

      // Count unread messages from this person
      const unreadCount = await Message.countDocuments({
        sender: other._id,
        receiver: userId,
        isRead: false,
      });

      conversations.push({
        _id: other._id,
        name: other.name,
        avatar: other.avatar,
        lastMessage: msg.text || (msg.image ? '📷 Photo' : ''),
        lastMessageAt: msg.createdAt,
        unreadCount,
      });
    }
  }

  res.json(conversations);
};

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
export const getUnreadCount = async (req, res) => {
  const count = await Message.countDocuments({
    receiver: req.user._id,
    isRead: false,
  });
  res.json({ count });
};

// @desc    Get messages in a conversation with a specific user (marks all as read)
// @route   GET /api/messages/:userId
export const getMessages = async (req, res) => {
  const myId = req.user._id;
  const otherId = req.params.userId;

  const messages = await Message.find({
    $or: [
      { sender: myId, receiver: otherId },
      { sender: otherId, receiver: myId },
    ],
  })
    .populate('sender', 'name avatar')
    .populate('receiver', 'name avatar')
    .sort({ createdAt: 1 });

  // Mark all unread messages from the other user as read
  const now = new Date();
  await Message.updateMany(
    { sender: otherId, receiver: myId, isRead: false },
    { isRead: true, readAt: now }
  );

  // Notify sender their messages were read via socket
  const io = req.app.get('io');
  if (io) {
    io.to(otherId.toString()).emit('messagesRead', { by: myId.toString() });
  }

  res.json(messages);
};

// @desc    Send a message
// @route   POST /api/messages/:userId
export const sendMessage = async (req, res) => {
  const { text } = req.body;
  const receiverId = req.params.userId;

  if (!text && !req.file) {
    return res.status(400).json({ message: 'Message text or image is required' });
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) return res.status(404).json({ message: 'Recipient not found' });

  let image = '';
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'circuit/messages');
    image = result.secure_url;
  }

  const message = await Message.create({
    sender: req.user._id,
    receiver: receiver._id,
    text: text || '',
    image,
    deliveredAt: new Date(),
  });

  const populated = await message.populate([
    { path: 'sender', select: 'name avatar' },
    { path: 'receiver', select: 'name avatar' },
  ]);

  const io = req.app.get('io');
  if (io) {
    // Deliver to receiver's personal room
    io.to(receiverId).emit('receiveMessage', populated);

    // Notify receiver with unread indicator if they're not in this chat
    io.to(receiverId).emit('newMessageNotification', {
      from: {
        _id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      },
      messageId: message._id,
    });
  }

  res.status(201).json(populated);
};

// @desc    Mark all messages from a user as read
// @route   PUT /api/messages/:userId/read
export const markAsRead = async (req, res) => {
  const myId = req.user._id;
  const senderId = req.params.userId;
  const now = new Date();

  await Message.updateMany(
    { sender: senderId, receiver: myId, isRead: false },
    { isRead: true, readAt: now }
  );

  const io = req.app.get('io');
  if (io) {
    io.to(senderId.toString()).emit('messagesRead', { by: myId.toString() });
  }

  res.json({ message: 'Marked as read' });
};
