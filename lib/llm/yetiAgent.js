// @ts-check
const {Elf} = require('xcraft-core-goblin');
const {id} = require('xcraft-core-goblin/lib/types.js');
const {
  string,
  array,
  enumeration,
  option,
  object,
  boolean,
  number,
  record,
} = require('xcraft-core-stones');
const MetaShape = require('goblin-yennefer/lib/metaShape.js');
const LLMProvider = require('./providers.js');
const {OCR_SYSTEM_PROMPT, getPDFImages} = require('./utils.js');

class MessageShape {
  role = enumeration('assistant', 'user', 'tool');
  content = string;
  images = option(array(string));
  tool_calls = option(array(object));
  tool_call_id = option(string);
  name = option(string);
}

class OptionsShape {
  // Active NUMA (Non-Uniform Memory Access) pour optimiser la gestion mémoire sur les architectures multi-sockets.
  numa = option(boolean);
  // Détermine la taille maximale du contexte utilisé par le modèle (en tokens).
  num_ctx = option(number);
  // Nombre de requêtes traitées simultanément par lots (batch processing).
  num_batch = option(number);
  // Nombre de GPU à utiliser pour l'inférence (si pris en charge).
  num_gpu = option(number);
  // Identifiant du GPU principal utilisé pour l'inférence.
  main_gpu = option(number);
  // Active le mode faible consommation de mémoire vidéo (utile pour les GPU avec peu de VRAM).
  low_vram = option(boolean);
  // Utilise des valeurs en float16 pour les clés et valeurs des caches d'attention (optimisation mémoire et performance).
  f16_kv = option(boolean);
  // Active la sortie des logits pour chaque token généré (utile pour le débogage et certaines analyses).
  logits_all = option(boolean);
  // Charge uniquement le vocabulaire du modèle, sans les poids (utile pour l'analyse des tokens).
  vocab_only = option(boolean);
  // Utilise mmap pour mapper les poids du modèle en mémoire au lieu de les charger en RAM (économie de mémoire).
  use_mmap = option(boolean);
  // Utilise mlock pour empêcher la mise en cache des poids en swap (utile pour les systèmes à faible latence).
  use_mlock = option(boolean);
  // Ne génère pas de texte, mais renvoie uniquement les embeddings des tokens (pour des cas d'usage spécifiques comme la recherche vectorielle).
  embedding_only = option(boolean);
  // Nombre de threads utilisés pour l'inférence sur CPU.
  num_thread = option(number);
  // Nombre de tokens à conserver avant le début d'une nouvelle génération.
  num_keep = option(number);
  // Graine pour la génération aléatoire, permet de reproduire les mêmes résultats.
  seed = option(number);
  // Nombre de tokens à prédire lors de la génération.
  num_predict = option(number);
  // Filtre les tokens les moins probables en ne conservant que les `top_k` plus probables.
  top_k = option(number);
  // Filtre les tokens en fonction d'une probabilité cumulative `top_p` (nucleus sampling).
  top_p = option(number);
  // Facteur de filtrage basé sur la fonction TFS-z pour la diversité dans la génération.
  tfs_z = option(number);
  // Probabilité typique utilisée pour équilibrer la diversité et la cohérence de la génération.
  typical_p = option(number);
  // Nombre de tokens récents pris en compte pour éviter la répétition dans la génération.
  repeat_last_n = option(number);
  // Contrôle la température du modèle (plus haut = génération plus créative, plus bas = plus déterministe).
  temperature = option(number);
  // Applique une pénalité sur la répétition de mots/tokens déjà générés.
  repeat_penalty = option(number);
  // Applique une pénalité sur les tokens déjà générés pour encourager la diversité.
  presence_penalty = option(number);
  // Applique une pénalité en fonction de la fréquence d’apparition des tokens (évite les répétitions excessives).
  frequency_penalty = option(number);
  // Active le mode Mirostat, un algorithme adaptatif pour le contrôle de la perplexité.
  mirostat = option(number);
  // Paramètre `tau` du mode Mirostat, ajuste le niveau de perplexité cible.
  mirostat_tau = option(number);
  // Paramètre `eta` du mode Mirostat, contrôle la vitesse d'adaptation.
  mirostat_eta = option(number);
  // Applique une pénalisation spécifique aux nouvelles lignes pour limiter leur apparition.
  penalize_newline = option(boolean);
  // Liste de tokens ou mots qui stoppent immédiatement la génération lorsqu’ils sont rencontrés.
  stop = option(array(string));
}

class YetiAgentShape {
  id = id('yetiAgent');
  name = string; //agent name
  role = string; //agent role
  prompt = string; //default prompt
  provider = enumeration('ollama', 'open-router');
  model = enumeration(
    'mistral-small',
    'llama3.2-vision',
    'mistral-nemo:12b-instruct-2407-q4_0',
    'granite-embedding:278m',
    'yeti-sdk',
    'openai/gpt-4o'
  ); //supported model's
  host = string;
  headers = record(string, string);
  messages = record(string, array(MessageShape)); //for keeping chat history by context
  options = option(OptionsShape); //for tweeking
  format = option(object);
  tools = option(array(object));
  toolServiceId = option(string);
  meta = MetaShape;
}

class YetiAgentState extends Elf.Sculpt(YetiAgentShape) {}

class YetiAgentLogic extends Elf.Archetype {
  static db = 'agents';
  state = new YetiAgentState({
    id: undefined,
    name: 'agent',
    role: 'assistant',
    prompt: '',
    provider: 'ollama',
    model: 'mistral-small',
    messages: {},
    options: {},
    host: 'http://127.0.0.1:11434',
    headers: {},
    format: null,
    tools: null,
    meta: {
      status: 'published',
    },
  });

  create(id, agentState) {
    const {state} = this;
    state.id = id;
    this.patch(agentState);
  }

  patch(patch) {
    const {state} = this;
    for (const [k, v] of Object.entries(patch)) {
      state[k] = v;
    }
  }

  reset(contextId) {
    const {state} = this;
    state.messages[contextId] = [];
  }

  set(contextId, messages) {
    const {state} = this;
    state.messages[contextId] = messages;
  }

  chat(contextId, role, content) {
    const {state} = this;
    if (!state.messages[contextId]) {
      state.messages[contextId] = [];
    }
    state.messages[contextId].push({role, content});
  }

  ask(contextId, question, answer) {
    const {state} = this;
    if (!state.messages[contextId]) {
      state.messages[contextId] = [];
    }
    state.messages[contextId].push({role: 'user', content: question});
    state.messages[contextId].push({role: 'assistant', content: answer});
  }

  addAssistantMessage(contextId, answer) {
    const {state} = this;
    if (!state.messages[contextId]) {
      state.messages[contextId] = [];
    }
    state.messages[contextId].push({role: 'assistant', content: answer});
  }

  callTools(contextId, toolCalls) {
    const {state} = this;
    if (!state.messages[contextId]) {
      state.messages[contextId] = [];
    }
    state.messages[contextId].push({
      role: 'assistant',
      tool_calls: toolCalls,
      content: '',
    });
  }

  addToolMessage(contextId, toolCallId, toolName, answer) {
    const {state} = this;
    if (!state.messages[contextId]) {
      state.messages[contextId] = [];
    }
    state.messages[contextId].push({
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: answer,
    });
  }

  change(path, newValue) {
    const {state} = this;
    state._state.set(path, newValue);
  }

  trash() {
    const {state} = this;
    state.meta.status = 'trashed';
  }
}

class YetiAgent extends Elf {
  logic = Elf.getLogic(YetiAgentLogic);
  state = new YetiAgentState();

  /**
   * @param {string} id
   * @param {string} desktopId
   * @param {Partial<YetiAgentState>} [agentState]
   * @returns {Promise<this>}
   */
  async create(id, desktopId, agentState) {
    this.logic.create(id, agentState);
    await this.persist();
    return this;
  }

  /**
   * @param {Partial<YetiAgentState>} [agentState]
   */
  async patch(agentState) {
    this.logic.patch(agentState);
    await this.persist();
  }

  async gen(prompt) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);

    let options;
    if (this.state.options) {
      options = this.state.options.toJS();
    }
    return await provider.gen({
      model: this.state.model,
      prompt,
      system: this.state.prompt,
      format: this.state.format?.toJS(),
      options,
      stream: false,
    });
  }

  async reset(contextId, save = false) {
    if (!contextId) {
      for (const contextId of Object.keys(this.state.messages)) {
        await this.reset(contextId);
      }
    } else {
      this.logic.reset(contextId);
    }
    if (save) {
      await this.persist();
    }
  }

  async readPDFpages(pdfPath) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);

    const images = await getPDFImages(pdfPath);
    const descriptions = [];
    for (const image of images) {
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: OCR_SYSTEM_PROMPT,
            },
            {
              type: 'image_url',
              image_url: {
                url: image,
              },
            },
          ],
        },
      ];
      const result = await provider.chat({
        model: this.state.model,
        messages,
      });
      descriptions.push(result.message.content);
    }
    return descriptions;
  }

  async embed(rawText) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);
    return await provider.embed({
      model: this.state.model,
      input: rawText,
    });
  }

  async set(contextId, messages) {
    this.logic.set(contextId, messages);
  }

  async chat(contextId, question, userDesktopId, sessionId = null) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);
    const contextMessages = this.state.messages[contextId] || [];
    const messages = [
      {role: 'system', content: this.state.prompt},
      ...Array.from(contextMessages).map((m) => m._state.toJS()), //history
    ];
    //add new question
    messages.push({role: 'user', content: question});

    let options;
    if (this.state.options) {
      options = this.state.options._state.toJS();
    }

    if (!sessionId) {
      this.logic.chat(contextId, 'user', question);
      sessionId = Elf.uuid();
      this.log.dbg(`🐈 Chat session started : ${sessionId}`);
    }

    const result = await provider.chat({
      model: this.state.model,
      messages,
      options,
      format: this.state.format?.toJS(),
      tools: this.state.tools?.toJS(),
    });

    if (this.state.toolServiceId && this.state.tools) {
      const used = await this.callTools(
        contextId,
        result.message,
        userDesktopId,
        sessionId
      );
      if (used) {
        return await this.chat(contextId, question, userDesktopId, sessionId);
      }
    }

    //keep agent response
    this.logic.chat(contextId, 'assistant', result.message.content);

    return result.message.content;
  }

  async callTools(contextId, message, userDesktopId, sessionId) {
    const {tool_calls} = message;
    if (!tool_calls || !userDesktopId) {
      return false;
    }
    this.logic.callTools(contextId, tool_calls);
    for (const tool of tool_calls) {
      const {
        id,
        function: {name},
      } = tool;
      let result = '';
      try {
        const payload = {
          id: this.state.toolServiceId,
          desktopId: userDesktopId,
          ...JSON.parse(tool.function.arguments),
        };
        const toolNamespace = this.state.toolServiceId?.split('@', 1)[0];
        const toolCmd = `${toolNamespace}.${name}`;
        this.log.dbg(
          `🔧 Tool call: ${toolCmd}(${JSON.stringify(
            payload
          )}) sid: ${sessionId}`
        );
        result = await this.quest.cmd(toolCmd, payload);
        await this.addToolMessage(contextId, id, name, result);
      } catch (err) {
        this.log.dbg(`🔧 Tool error : ${err} sid: ${sessionId}`);
      }
    }
    return true;
  }

  async addToolMessage(contextId, toolId, toolName, answer) {
    this.logic.addToolMessage(contextId, toolId, toolName, answer);
  }

  async ask(contextId, question, questionId) {
    if (this.state.provider !== 'ollama') {
      throw new Error('Streaming API not impl.');
    }
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    await new YetiAgent(this).create(this.id, feedId);

    const contextMessages = this.state.messages[contextId] || [];
    const messages = [
      {role: 'system', content: this.state.prompt},
      ...Array.from(contextMessages).map((m) => m._state.toJS()), //history
    ];
    //add new question
    messages.push({role: 'user', content: question});

    let options;
    if (this.state.options) {
      options = this.state.options._state.toJS();
    }
    const response = await provider.chat({
      model: this.state.model,
      messages,
      options,
      stream: true,
    });

    let agentResponse = '';
    for await (const part of response) {
      agentResponse += part.message.content;
      this.quest.evt(`<${questionId}>`, {part: part.message.content});
    }

    //keep agent response
    this.logic.ask(contextId, question, agentResponse);
  }

  async resumeExchange(resumePrompt, contextId) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    await new YetiAgent(this).create(this.id, feedId);
    const contextMessages = this.state.messages[contextId] || [];

    let options;
    if (this.state.options) {
      options = this.state.options.toJS();
    }
    const prompt = Array.from(contextMessages)
      .map((m) => m._state.toJS())
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return await provider.gen({
      model: this.state.model,
      prompt,
      system: resumePrompt,
      options,
      stream: false,
    });
  }

  async react(reactPrompt, contextId, question) {
    const Instance = LLMProvider.get(this.state.provider);
    const provider = new Instance(this.state.host, this.state.headers);
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    await new YetiAgent(this).create(this.id, feedId);
    const contextMessages = this.state.messages[contextId] || [];
    const messages = [
      {role: 'system', content: reactPrompt},
      ...Array.from(contextMessages).map((m) => m._state.toJS()), //history
      {role: 'user', content: question},
    ];
    this.log.dbg('ReAct Question:', question);

    let options;
    if (this.state.options) {
      options = this.state.options.toJS();
    }

    const answer = await provider.chat({
      model: this.state.model,
      messages,
      options,
      format: {
        type: 'object',
        properties: {
          observation: {type: 'string'},
          thought: {type: 'string'},
          action: {type: 'string'},
          agentId: {type: 'string'},
          result: {type: 'string'},
        },
        required: ['observation', 'thought', 'action', 'agentId', 'result'],
      },
    });
    if (!answer.message.content) {
      await this.addAssistantMessage(
        contextId,
        'Génération stoppée. Impossible de répondre.'
      );
      return;
    }
    const {agentId, action, result, observation} = answer.message.content;
    this.log.dbg('ReAct Observation:', observation);
    this.log.dbg('ReAct Action:', action);
    // Ajoute l'observation
    await this.addAssistantMessage(contextId, observation);
    // Si un agent est nécessaire, appel de l'agent externe
    if (agentId) {
      const result = await this.callAgent(
        contextId,
        agentId,
        `${observation} -> ${action}`,
        feedId
      );
      return {agentId, action, result, observation};
    }

    return {agentId, action, result, observation};
  }

  async callAgent(contextId, agentId, action, feedId) {
    this.log.dbg(`🥸 calling "${agentId}" with action: "${action}"`);
    const exist = await this.cryo.isPersisted(YetiAgentLogic.db, agentId);
    if (!exist) {
      this.log.dbg(`🥸 "${agentId}" is not available, stopping"`);
      await this.addAssistantMessage(contextId, 'Agent non disponible.');
      return null;
    }
    const toolAgent = await new YetiAgent(this).create(agentId, feedId);
    const agentResponse = await toolAgent.chat(contextId, action);
    if (typeof agentResponse !== 'string') {
      await this.addAssistantMessage(
        contextId,
        '```json' + JSON.stringify(agentResponse, null, 2) + '```'
      );
    } else {
      await this.addAssistantMessage(contextId, agentResponse);
    }
    return agentResponse;
  }

  async addAssistantMessage(contextId, message) {
    this.logic.addAssistantMessage(contextId, message);
  }

  async save() {
    await this.persist();
  }

  /**
   * @template {keyof this['state']} K
   * @param {K} path
   * @param {this['state'][K]} newValue
   */
  async change(path, newValue) {
    if (path === 'options.temperature') {
      newValue = parseFloat(newValue);
    }
    if (path === 'options.num_ctx') {
      newValue = parseInt(newValue);
    }
    this.logic.change(path, newValue);
    await this.persist();
  }

  async getUserChatContextHistory(contextId, filterTool = true) {
    const contextMessages = this.state.messages[contextId] || [];
    return [
      ...Array.from(contextMessages)
        .map((m) => m._state.toJS())
        .filter((m) => {
          if (!filterTool) {
            return m;
          }
          if (m.role !== 'tool' && !m.tool_calls) {
            return m;
          }
        }),
    ];
  }

  async getBaseSettings() {
    const {provider, host, headers, model} = this.state.toJS();
    return {provider, host, headers, model};
  }

  async trash() {
    this.logic.trash();
    await this.persist();
  }

  delete() {}
}

module.exports = {YetiAgent, YetiAgentLogic, YetiAgentShape};
