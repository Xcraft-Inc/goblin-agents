// @ts-check
const OllamaProvider = require('./providers/ollama.js');
const OpenAIProvider = require('./providers/opanAi.js');

class LLMProviders {
  static get(name) {
    switch (name) {
      default:
      case 'ollama':
        return OllamaProvider;
      case 'open-ai':
        return OpenAIProvider;
    }
  }
}

module.exports = LLMProviders;
