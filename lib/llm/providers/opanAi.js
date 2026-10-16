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
    if (chatRequest.reasoning !== undefined) {
      if (chatRequest.reasoning) {
        chatRequest.reasoning_effort = chatRequest.reasoning;
      }
      delete chatRequest.reasoning;
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
    const {choices, usage} = chat;
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
      return {result: choices[0], usage};
    } else {
      return {result: choices[0], usage};
    }
  }

  async gen(genRequest) {
    const {
      model,
      system,
      prompt,
      format,
      tools,
      options,
      stream,
      reasoning,
    } = genRequest;
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
      reasoning,
    };
    const {result} = await this.chat(chatRequest);
    return result.message.content;
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
