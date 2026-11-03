// @ts-check
const {Elf} = require('xcraft-core-goblin');
const {record, string} = require('xcraft-core-stones');

class ContextCacheShape {
  id = string;
  contexts = record(string, string);
}

class ContextCacheState extends Elf.Sculpt(ContextCacheShape) {}

class ContextCacheLogic extends Elf.Spirit {
  state = new ContextCacheState({
    id: 'contextCache',
    contexts: {},
  });

  append(contextId, markdown) {
    const current = this.state.contexts[contextId] || '';
    this.state.contexts[contextId] = current + markdown;
  }

  clear(contextId) {
    delete this.state.contexts[contextId];
  }
}

class ContextCache extends Elf.Alone {
  logic = Elf.getLogic(ContextCacheLogic);
  state = new ContextCacheState();

  async init() {
    return this;
  }

  async append(contextId, markdown) {
    if (typeof contextId !== 'string') {
      throw new TypeError('contextId must be a string');
    }
    if (typeof markdown !== 'string') {
      throw new TypeError('markdown must be a string');
    }

    this.logic.append(contextId, markdown);
  }

  async read(contextId) {
    if (typeof contextId !== 'string') {
      throw new TypeError('contextId must be a string');
    }

    return this.state.contexts[contextId] || '';
  }

  async clear(contextId) {
    if (typeof contextId !== 'string') {
      throw new TypeError('contextId must be a string');
    }

    this.logic.clear(contextId);
  }
}

module.exports = {
  ContextCache,
  ContextCacheLogic,
  ContextCacheShape,
  ContextCacheState,
};
