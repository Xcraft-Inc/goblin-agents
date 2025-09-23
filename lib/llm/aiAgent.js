// @ts-check
const {Elf} = require('xcraft-core-goblin');
const {id, MetaShape} = require('xcraft-core-goblin/lib/types.js');
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
const {getMutex} = require('xcraft-core-utils/lib/locks.js');
const LLMProvider = require('./providers.js');
const {OCR_SYSTEM_PROMPT, getPDFImages, splitThinkTags} = require('./utils.js');

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

function vectorToSqlLiteral(vec) {
  const array = new Float32Array(vec);
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    const byte = view[i];
    hex += byte < 16 ? '0' + byte.toString(16) : byte.toString(16);
  }
  return hex;
}

/**
 * Convertit un vecteur float32 normalisé [-1,1]
 * en int8 [-128,127] et retourne une chaîne hex
 * pour stockage en SQL.
 *
 * @param {Array|Float32Array} vec - vecteur normalisé
 * @returns {string} - représentation hex
 */
function vectorToSqlLiteralInt8(vec) {
  const dimensions = vec.length;
  const qvec = new Int8Array(dimensions);

  // Quantization uniforme
  const step = 2.0 / 255.0;
  for (let i = 0; i < dimensions; i++) {
    qvec[i] = Math.round((vec[i] + 1.0) / step - 128);
  }

  // Vue mémoire en octets non signés
  const view = new Uint8Array(qvec.buffer, qvec.byteOffset, qvec.byteLength);

  // Conversion en hex
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    const byte = view[i];
    hex += byte < 16 ? '0' + byte.toString(16) : byte.toString(16);
  }

  return hex;
}

class AiAgentShape {
  id = id('aiAgent');
  version = number;
  name = string; //agent name
  role = string; //agent role
  prompt = string; //default prompt
  provider = enumeration('ollama', 'open-ai');
  model = string;
  host = string;
  headers = record(string, string);
  messages = record(string, array(MessageShape)); //for keeping chat history by context
  options = option(OptionsShape); //for tweeking
  format = option(object);
  tools = option(array(object));
  toolServiceId = option(string);
  usability = enumeration('disabled', 'experimental', 'stable', 'deprecated');
  reasoning = option(boolean);
  vectorQuality = option(enumeration('f32', 'int8'));
  meta = MetaShape;
}

class AiAgentState extends Elf.Sculpt(AiAgentShape) {}

/** @type {Partial<AiAgentState>} */
const defaultValues = {
  name: 'agent',
  role: 'assistant',
  provider: 'open-ai',
  model: '',
  options: {},
  host: 'http://127.0.0.1:11434',
  headers: {},
  format: null,
  toolServiceId: null,
  tools: null,
  reasoning: false,
  usability: 'disabled',
  vectorQuality: 'f32',
};

class AiAgentLogic extends Elf.Archetype {
  static db = 'agents';
  state = new AiAgentState({
    id: undefined,
    version: 1,
    name: defaultValues.name,
    role: defaultValues.role,
    prompt: defaultValues.prompt,
    provider: defaultValues.provider,
    model: defaultValues.model,
    messages: {},
    options: defaultValues.options,
    host: defaultValues.host,
    headers: defaultValues.headers,
    format: defaultValues.format,
    toolServiceId: defaultValues.toolServiceId,
    tools: defaultValues.tools,
    usability: defaultValues.usability,
    vectorQuality: 'f32',
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
    for (const [k, v] of Object.entries(defaultValues)) {
      state[k] = patch[k] ? patch[k] : v;
    }
  }

  upgrade(version, patch) {
    const {state} = this;
    this.patch(patch);
    state.version = version;
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

  publish() {
    const {state} = this;
    state.meta.status = 'published';
  }

  trash() {
    const {state} = this;
    state.meta.status = 'trashed';
  }
}

class AiAgent extends Elf {
  logic = Elf.getLogic(AiAgentLogic);
  state = new AiAgentState();

  _provider;
  _conf;
  _batchLock = getMutex;

  /**
   * @param {string} id
   * @param {string} desktopId
   * @param {Partial<AiAgentState>} [agentState]
   * @returns {Promise<this>}
   */
  async create(id, desktopId, agentState) {
    this.logic.create(id, agentState);
    await this.persist();
    return this;
  }

  /**
   * Restore the last known 'persist' when the changes provided by the client
   * are using a different version.
   */
  async beforePersistOnServer() {
    const {state} = this;
    const {version} = require('xcraft-core-etc')().load('goblin-agents');
    if (state.version === version) {
      return; /* It's fine, we keep the changes */
    }

    /* Restore the last 'persist' */
    const prev = await this.cryo.getState(
      AiAgentLogic.db,
      this.id,
      AiAgentShape
    );
    this.logic.patch(prev);
  }

  async _loadProvider() {
    const {state} = this;
    const {provider, host, headers} = state;
    const headersStr = JSON.stringify(headers);
    if (
      this._provider &&
      this._conf.provider === provider &&
      this._conf.host === host &&
      this._conf.headersStr === headersStr
    ) {
      return;
    }

    const Instance = LLMProvider.get(this.state.provider);
    this._provider = new Instance(this.state.host, this.state.headers.toJS());
    this._conf = {provider, host, headersStr};
  }

  /**
   * @param {Partial<AiAgentState>} [agentState]
   */
  async patch(agentState) {
    this.logic.patch(agentState);
    await this.persist();
  }

  /**
   * @param {number} version
   * @param {Partial<AiAgentState>} [agentState]
   */
  async upgrade(version, agentState) {
    const {state} = this;
    if (state.version >= version) {
      return;
    }
    this.logic.upgrade(version, agentState);
    await this.persist();
  }

  async gen(prompt) {
    await this._loadProvider();

    let options;
    if (this.state.options) {
      options = this.state.options.toJS();
    }
    const format = this.state.format
      ? typeof this.state.format === 'string'
        ? this.state.format
        : this.state.format.toJS()
      : undefined;
    let res = await this._provider.gen({
      model: this.state.model,
      reasoning: this.state.reasoning,
      prompt,
      system: this.state.prompt,
      format,
      options,
      stream: false,
    });
    if (typeof res === 'string') {
      const {thinks, cleanText} = splitThinkTags(res);
      for (const think of thinks) {
        this.log.dbg(`🧐 ${think}`);
      }
      res = cleanText;
    }
    return res;
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
    await this._loadProvider();

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
      const result = await this._provider.chat({
        model: this.state.model,
        reasoning: this.state.reasoning,
        messages,
      });
      descriptions.push(result.message.content);
    }
    return descriptions;
  }

  async embed(rawText) {
    if (!rawText) {
      return null;
    }
    await this._loadProvider();
    const vectors = await this._provider.embed({
      model: this.state.model,
      input: rawText,
    });
    let vectorToSql = vectorToSqlLiteral;
    if (this.state.vectorQuality === 'int8') {
      vectorToSql = vectorToSqlLiteralInt8;
    }
    return vectorToSql(vectors);
  }

  async embedInBatch(rawTexts = []) {
    if (rawTexts.length === 0) {
      return [];
    }

    await this._batchLock.lock(this.id);
    this.quest.defer(() => this._batchLock.unlock(this.id));

    await this._loadProvider();
    const res = await this._provider.embedInBatch({
      model: this.state.model,
      input: rawTexts,
    });
    let vectorToSql = vectorToSqlLiteral;
    if (this.state.vectorQuality === 'int8') {
      vectorToSql = vectorToSqlLiteralInt8;
    }
    return res.map((v) => vectorToSql(v));
  }

  async set(contextId, messages) {
    this.logic.set(contextId, messages);
  }

  async chat(contextId, question, userDesktopId) {
    await this._loadProvider();
    const contextMessages = this.state.messages[contextId] || [];
    const messages = [
      {role: 'system', content: this.state.prompt},
      ...Array.from(contextMessages).map((m) => m._state.toJS()), //history
    ];

    let options;
    if (this.state.options) {
      const pState = this.state._state.toJS();
      options = pState?.options;
    }

    if (question) {
      this.logic.chat(contextId, 'user', question);
      //add new question
      messages.push({role: 'user', content: question});
    }

    this.log.dbg(`🐈 Chat session started : ${contextId}`);

    const chatCompletionRequest = {
      model: this.state.model,
      messages,
      options,
      format: this.state.format?.toJS(),
      tools: this.state.tools?.toJS(),
      reasoning: this.state.reasoning,
    };

    const result = await this._provider.chat(chatCompletionRequest);

    if (this.state.toolServiceId && this.state.tools) {
      const used = await this.callTools(
        contextId,
        result.message,
        userDesktopId
      );
      if (used) {
        //leave for a second turn
        this.log.dbg(`🐈 Chat session ended : ${contextId}`);
        return true;
      }
    }

    //keep agent response
    let res = result.message.content;
    if (typeof res === 'string') {
      const {thinks, cleanText} = splitThinkTags(res);
      this.logic.chat(contextId, 'assistant', cleanText);
      for (const think of thinks) {
        this.log.dbg(`🧐 ${think}`);
      }
      res = cleanText;
    }
    this.log.dbg(`🐈 Chat session ended : ${contextId}`);

    return res;
  }

  async callTools(contextId, message, userDesktopId) {
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
      let toolArguments = {};
      if (
        tool.function.arguments &&
        typeof tool.function.arguments === 'string'
      ) {
        toolArguments = JSON.parse(tool.function.arguments);
      } else if (
        tool.function.arguments &&
        typeof tool.function.arguments === 'object'
      ) {
        toolArguments = tool.function.arguments;
      }
      try {
        const payload = {
          id: this.state.toolServiceId,
          desktopId: userDesktopId,
          contextId,
          ...toolArguments,
        };
        const toolNamespace = this.state.toolServiceId?.split('@', 1)[0];
        const toolCmd = `${toolNamespace}.${name}`;
        this.log.dbg(`🔧 Tool call: ${toolCmd}(${JSON.stringify(payload)})`);
        result = await this.quest.cmd(toolCmd, payload);
        await this.addToolMessage(contextId, id, name, result);
      } catch (err) {
        this.log.dbg(`🔧 Tool error : ${err}`);
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
    await this._loadProvider();

    const contextMessages = this.state.messages[contextId] || [];
    const messages = [
      {role: 'system', content: this.state.prompt},
      ...Array.from(contextMessages).map((m) => m._state.toJS()), //history
    ];
    //add new question
    messages.push({role: 'user', content: question});

    let options;
    if (this.state.options) {
      const pState = this.state._state.toJS();
      options = pState?.options;
    }
    const response = await this._provider.chat({
      model: this.state.model,
      messages,
      reasoning: this.state.reasoning,
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
    await this._loadProvider();
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

    return await this._provider.gen({
      model: this.state.model,
      prompt,
      system: resumePrompt,
      reasoning: this.state.reasoning,
      options,
      stream: false,
    });
  }

  async react(reactPrompt, contextId, question) {
    await this._loadProvider();
    const feedId = await this.newQuestFeed();
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

    const answer = await this._provider.chat({
      model: this.state.model,
      messages,
      options,
      reasoning: this.state.reasoning,
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
    const exist = await this.cryo.isPersisted(AiAgentLogic.db, agentId);
    if (!exist) {
      this.log.dbg(`🥸 "${agentId}" is not available, stopping"`);
      await this.addAssistantMessage(contextId, 'Agent non disponible.');
      return null;
    }
    const toolAgent = await new AiAgent(this).create(agentId, feedId);
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

  async getToolChatContextHistory(contextId) {
    const contextMessages = this.state.messages[contextId] || [];
    return [
      ...Array.from(contextMessages)
        .map((m) => m._state.toJS())
        .filter((m) => {
          if (m.role === 'tool' && !m.tool_calls) {
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

  async publish() {
    this.logic.publish();
    await this.persist();
  }

  delete() {}
}

module.exports = {
  AiAgent,
  AiAgentLogic,
  AiAgentShape,
};
