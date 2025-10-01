// @ts-check

class LLMProvider {
  constructor() {
    if (new.target === LLMProvider) {
      throw new Error('Cannot instantiate an abstract class.');
    }
  }

  async chatStream() {
    throw new Error('not impl.');
  }

  /**
   * @returns {Promise<*>}
   */
  async chat() {
    throw new Error('not impl.');
  }

  /**
   * @returns {Promise<*>}
   */
  async gen() {
    throw new Error('not impl.');
  }

  /**
   * @returns {Promise<*>}
   */
  async embed() {
    throw new Error('not impl.');
  }
}

module.exports = LLMProvider;
