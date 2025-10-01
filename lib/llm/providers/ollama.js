// @ts-check
const {Ollama} = require('ollama');
const {Semaphore} = require('xcraft-core-utils/lib/locks.js');
const LLMProvider = require('./provider.js');

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
    const {
      model,
      messages,
      options,
      format,
      tools,
      stream,
      reasoning,
    } = chatRequest;
    const useFormat = !!format;
    const chat = await this.#ollama.chat({
      model,
      messages,
      options,
      format,
      tools,
      stream,
      think: reasoning,
    });
    if (useFormat) {
      chat.message.content = JSON.parse(chat.message.content);
      return chat;
    } else {
      return chat;
    }
  }

  async gen(genRequest) {
    const {
      model,
      system,
      prompt,
      format,
      options,
      stream,
      reasoning,
    } = genRequest;
    const useFormat = !!format;
    const gen = await this.#ollama.generate({
      model,
      prompt,
      system,
      format,
      options,
      stream,
      think: reasoning,
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

module.exports = OllamaProvider;
