const buckets = new Map();

const rateLimit = ({ windowMs = 60 * 1000, max = 120, message = 'Too many requests. Please try again later.' } = {}) => (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now >= current.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }

    current.count += 1;
    if (current.count > max) {
        res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
        return res.status(429).json({ error: message });
    }

    return next();
};

module.exports = { rateLimit };
