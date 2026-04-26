import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            default: 'New Chat',
            trim: true,
        },
        model: {
            type: String,
            default: null,
        },
        // Share feature
        shareToken: {
            type: String,
            default: null,
        },
        shareExpiry: {
            type: Date,
            default: null,
        },
        shareActive: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const chatModel = mongoose.model('Chat', chatSchema);

export default chatModel;