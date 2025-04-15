const {Ollama} = require('ollama');
const {RestAPI} = require('xcraft-core-utils');
class LLMProvider {
  static get(name) {
    switch (name) {
      default:
      case 'ollama':
        return OllamaProvider;
      case 'open-ai':
        return OpenAIProvider;
    }
  }

  constructor() {
    if (new.target === LLMProvider) {
      throw new Error('Cannot instantiate an abstract class.');
    }
  }

  async chatStream() {
    throw new Error('not impl.');
  }

  async chat() {
    throw new Error('not impl.');
  }

  async gen() {
    throw new Error('not impl.');
  }

  async embed() {
    throw new Error('not impl.');
  }
}

class OllamaProvider extends LLMProvider {
  _ollama;
  constructor(host, headers) {
    super();
    this._ollama = new Ollama({
      host,
      headers,
    });
  }

  async chat(chatRequest) {
    const {model, messages, options, format, tools, stream} = chatRequest;
    const useFormat = !!format;
    const chat = await this._ollama.chat({
      model,
      messages,
      options,
      format,
      tools,
      stream,
    });
    if (useFormat) {
      chat.message.content = JSON.parse(chat.message.content);
      return chat;
    } else {
      return chat;
    }
  }

  async gen(genRequest) {
    const {model, system, prompt, format, options, stream} = genRequest;
    const useFormat = !!format;
    const gen = await this._ollama.generate({
      model,
      prompt,
      system,
      format,
      options,
      stream,
    });
    if (useFormat) {
      return JSON.parse(gen.response);
    } else {
      return gen.response;
    }
  }

  async embed(embedRequest) {
    const {model, input} = embedRequest;
    const {embeddings} = await this._ollama.embed({
      model,
      input,
    });
    return embeddings;
  }
}

class OpenAIProvider extends LLMProvider {
  _baseUrl;
  _openAI;
  constructor(host = 'https://openrouter.ai/api/v1', headers) {
    super();
    this._baseUrl = host;
    this._openAI = new RestAPI(30000, headers);
  }

  async chat(chatRequest) {
    const useFormat = chatRequest.format !== undefined;
    if (useFormat) {
      chatRequest.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'default',
          schema: {
            type: 'object',
            properties: {
              results: {...chatRequest.format},
            },
            required: ['results'],
          },
        },
      };
      delete chatRequest.format;
    }
    const query = `${this._baseUrl}/chat/completions`;
    const chat = await this._openAI._post(query, chatRequest);
    const {choices} = chat;
    if (chat.error) {
      return chat.error;
    }
    if (useFormat) {
      choices[0].message.content = JSON.parse(
        choices[0].message.content
      ).results;
      return choices[0];
    } else {
      return choices[0];
    }
  }

  async gen(genRequest) {
    const {model, system, prompt, format, tools, options, stream} = genRequest;
    const chatRequest = {
      model,
      messages: [
        {role: 'system', content: system},
        {role: 'user', content: prompt},
      ],
      options,
      format,
      tools,
      stream,
    };
    const chat = await this.chat(chatRequest);
    return chat.message.content;
  }

  async embed(embedRequest) {
    const query = `${this._baseUrl}/v1/embeddings`;
    const {data} = await this._openAI._post(query, embedRequest);
    return data[0].embedding;
  }
}

module.exports = LLMProvider;
