export default async function handler(req, res) {
    try {
        const { default: app } = await import('../dist/index.js');

        if (typeof app !== 'function') {
            console.error('Exported app is not a function:', typeof app);
            return res.status(500).json({
                error: 'Backend configuration error',
                details: 'App export is not a function'
            });
        }

        return app(req, res);
    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({
            error: 'Failed to load backend',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
