// @ts-check
const {RestAPI} = require('xcraft-core-utils');
const LLMProvider = require('./provider.js');

class OpenAIProvider extends LLMProvider {
  #baseUrl;
  #openAI;

  constructor(host = 'https://openrouter.ai/api/v1', headers) {
    super();
    this.#baseUrl = host;
    this.#openAI = new RestAPI(300000, headers);
  }

  async chat(chatRequest) {
    delete chatRequest.reasoning; //not yet supported
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
    const chat = await this.#openAI._post(query, chatRequest, {
      retry: {
        methods: ['POST'],
      },
    });
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

module.exports = OpenAIProvider;
