const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const aiConfig = require('../config/ai-config');

// Get current AI configuration
router.get('/config', requireAuth, requireAdmin, (req, res) => {
    try {
        const config = aiConfig.getActiveConfig();
        const providers = aiConfig.getAllProviders();
        
        res.json({
            current: {
                provider: config.provider,
                model: config.model,
                modelName: config.modelConfig.name
            },
            providers
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update AI configuration
router.post('/config', requireAuth, requireAdmin, (req, res) => {
    try {
        const { provider, model } = req.body;
        
        if (!provider) {
            return res.status(400).json({ error: 'Provider is required' });
        }
        
        const config = aiConfig.setActiveProvider(provider, model);
        
        res.json({
            message: 'AI configuration updated successfully',
            current: {
                provider: config.provider,
                model: config.model,
                modelName: config.modelConfig.name
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Test AI connection
router.post('/test', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { testPrompt } = req.body;
        const prompt = testPrompt || 'Hello! Please respond with "AI connection successful" if you can read this.';
        
        const response = await aiConfig.askAI(prompt, {
            maxTokens: 100,
            temperature: 0.5
        });
        
        const config = aiConfig.getActiveConfig();
        
        res.json({
            success: true,
            provider: config.provider,
            model: config.model,
            response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;