const {Ollama} = require('ollama');
const {RestAPI} = require('xcraft-core-utils');
const {Semaphore} = require('xcraft-core-utils/lib/locks.js');

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
  #semEmbed = new Semaphore(4);
  #ollama;

  constructor(host, headers) {
    super();
    this.#ollama = new Ollama({
      host,
      headers,
    });
  }

  async chat(chatRequest) {
    const {model, messages, options, format, tools, stream} = chatRequest;
    const useFormat = !!format;
    const chat = await this.#ollama.chat({
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
    const gen = await this.#ollama.generate({
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
    try {
      await this.#semEmbed.wait();
      const {model, input} = embedRequest;
      const {embeddings} = await this.#ollama.embed({
        model,
        input,
      });
      return embeddings[0];
    } finally {
      this.#semEmbed.signal();
    }
  }

  async embedInBatch(embedRequest) {
    const {model, input} = embedRequest;
    const {embeddings} = await this.#ollama.embed({
      model,
      input,
    });
    return embeddings;
  }
}

class OpenAIProvider extends LLMProvider {
  #baseUrl;
  #openAI;

  constructor(host = 'https://openrouter.ai/api/v1', headers) {
    super();
    this.#baseUrl = host;
    this.#openAI = new RestAPI(300000, headers);
  }

  async chat(chatRequest) {
    if (chatRequest.options) {
      chatRequest = {...chatRequest, ...chatRequest.options};
      delete chatRequest.options;
    }
    if (!chatRequest.tools) {
      delete chatRequest.tools;
    }
    if (!chatRequest.format) {
      delete chatRequest.format;
    }
    const useFormat = chatRequest?.format !== undefined;
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
    const query = `${this.#baseUrl}/chat/completions`;
    const chat = await this.#openAI._post(query, chatRequest);
    const {choices} = chat;
    if (chat.error) {
      const err = new Error(
        chat.error?.metadata
          ? JSON.stringify(chat.error?.metadata)
          : chat.error.message
      );
      err.code = chat.error.code;
      throw err;
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
    const query = `${this.#baseUrl}/v1/embeddings`;
    const {data} = await this.#openAI._post(query, embedRequest);
    return data[0].embedding;
  }

  async embedInBatch(embedRequest) {
    const query = `${this.#baseUrl}/v1/embeddings`;
    const {data} = await this.#openAI._post(query, embedRequest);
    return data;
  }
}

module.exports = LLMProvider;
