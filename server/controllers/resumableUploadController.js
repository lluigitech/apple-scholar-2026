const resumable = require('../services/resumableUploadService');

const sendError = (res, error) => res.status(error.statusCode || 500).json({ error: error.message || 'Resumable upload failed' });

exports.createSession = async (req, res) => {
    try {
        const session = await resumable.createSession({ scholarId: req.user.scholar_id, ...req.body });
        res.status(201).json({ uploadId: session.id, chunkSize: session.chunkSize, totalChunks: session.totalChunks });
    } catch (error) {
        sendError(res, error);
    }
};

exports.uploadChunk = async (req, res) => {
    try {
        const session = await resumable.saveChunk(req.params.id, req.user.scholar_id, req.params.index, req.file?.buffer);
        res.json({ uploadId: session.id, received: session.received, totalChunks: session.totalChunks });
    } catch (error) {
        sendError(res, error);
    }
};

exports.getStatus = async (req, res) => {
    try {
        const session = await resumable.getStatus(req.params.id, req.user.scholar_id);
        res.json({ uploadId: session.id, received: session.received, totalChunks: session.totalChunks, completed: session.completed });
    } catch (error) {
        sendError(res, error);
    }
};

exports.completeSession = async (req, res) => {
    try {
        const session = await resumable.completeSession(req.params.id, req.user.scholar_id);
        res.json({ uploadId: session.id, completed: true, originalName: session.originalName, fieldname: session.fieldname });
    } catch (error) {
        sendError(res, error);
    }
};

exports.cancelSession = async (req, res) => {
    try {
        const session = await resumable.getStatus(req.params.id, req.user.scholar_id);
        await resumable.removeSession(session.id);
        res.status(204).end();
    } catch (error) {
        sendError(res, error);
    }
};
