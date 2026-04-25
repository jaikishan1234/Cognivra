import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        chat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat',
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: [ 'user', 'ai' ],
            required: true,
        },
        fileUrl: {
            type: String,
            default: null,
        },
        fileName: {
            type: String,
            default: null,
        },
        fileMimeType: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

const messageModel = mongoose.model('Message', messageSchema);

export default messageModel;