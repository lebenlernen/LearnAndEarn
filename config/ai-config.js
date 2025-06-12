// AI Configuration for LearnAndEarn
// This file manages AI model selection and API keys

const AI_PROVIDERS = {
    OPENAI: {
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY || 'sk-proj-rA6QE9rp6x9Z0hRFKwFmT3BlbkFJUNwKOfSlKyRKa2KOoQa5',
        baseURL: 'https://api.openai.com/v1',
        models: {
            'gpt-3.5-turbo': {
                name: 'GPT-3.5 Turbo',
                maxTokens: 4096,
                costPer1kTokens: { input: 0.0005, output: 0.0015 }
            },
            'gpt-4': {
                name: 'GPT-4',
                maxTokens: 8192,
                costPer1kTokens: { input: 0.03, output: 0.06 }
            },
            'gpt-4-turbo': {
                name: 'GPT-4 Turbo',
                maxTokens: 128000,
                costPer1kTokens: { input: 0.01, output: 0.03 }
            }
        },
        defaultModel: 'gpt-3.5-turbo'
    },
    DEEPSEEK: {
        name: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY || 'sk-86d2c0ee5b8944eab79cbfd2b5521858',
        baseURL: 'https://api.deepseek.com',
        models: {
            'deepseek-chat': {
                name: 'DeepSeek Chat',
                maxTokens: 32768,
                costPer1kTokens: { input: 0.0001, output: 0.0002 }
            },
            'deepseek-coder': {
                name: 'DeepSeek Coder',
                maxTokens: 16384,
                costPer1kTokens: { input: 0.0001, output: 0.0002 }
            }
        },
        defaultModel: 'deepseek-chat'
    }
};

// Default configuration
let currentProvider = 'OPENAI';
let currentModel = AI_PROVIDERS[currentProvider].defaultModel;

// Get active AI configuration
function getActiveConfig() {
    const provider = AI_PROVIDERS[currentProvider];
    if (!provider) {
        throw new Error(`Unknown AI provider: ${currentProvider}`);
    }
    
    return {
        provider: currentProvider,
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        model: currentModel,
        modelConfig: provider.models[currentModel],
        allModels: provider.models
    };
}

// Set active provider and model
function setActiveProvider(provider, model = null) {
    if (!AI_PROVIDERS[provider]) {
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    currentProvider = provider;
    currentModel = model || AI_PROVIDERS[provider].defaultModel;
    
    return getActiveConfig();
}

// Get all available providers and models
function getAllProviders() {
    return Object.entries(AI_PROVIDERS).map(([key, provider]) => ({
        key,
        name: provider.name,
        models: Object.entries(provider.models).map(([modelKey, model]) => ({
            key: modelKey,
            name: model.name,
            maxTokens: model.maxTokens
        })),
        defaultModel: provider.defaultModel
    }));
}

// Create AI client based on current configuration
async function createAIClient() {
    const config = getActiveConfig();
    
    if (config.provider === 'OPENAI' || config.provider === 'DEEPSEEK') {
        // Both use OpenAI-compatible API
        const { OpenAI } = await import('openai');
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL
        });
    }
    
    throw new Error(`Unsupported provider: ${config.provider}`);
}

// Helper function to make AI requests
async function askAI(prompt, options = {}) {
    const config = getActiveConfig();
    const client = await createAIClient();
    
    try {
        const completion = await client.chat.completions.create({
            model: config.model,
            messages: [
                {
                    role: 'system',
                    content: options.systemPrompt || 'You are a helpful language learning assistant.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('AI request failed:', error);
        throw error;
    }
}

module.exports = {
    getActiveConfig,
    setActiveProvider,
    getAllProviders,
    createAIClient,
    askAI
};