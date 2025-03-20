const {Ollama} = require('ollama');

//Nemo:
//ollama pull mistral-nemo:12b-instruct-2407-q4_0
class YetiAssistant {
  _ollama = null;
  _sessions = {};
  _chatModel = 'mistral-nemo:12b-instruct-2407-q4_0';
  _chatModelTemp = 0;
  constructor(host = 'http://127.0.0.1:11434') {
    this._ollama = new Ollama({host});
    return this;
  }

  async setup() {}

  async ocr(path, onPart, onError) {
    const prompt = `
Act as an OCR assistant. Analyze the provided image and:
1. Recognize all visible text in the image as accurately as possible.
2. Maintain the original structure and formatting of the text.
3. If any words or phrases are unclear, indicate this with [unclear] in your transcription.
Provide only the transcription without any additional comments.
`;

    try {
      const response = await this._ollama.chat({
        model: 'llama3.2-vision',
        messages: [{role: 'user', content: prompt, images: [path]}],
        stream: true,
      });
      for await (const part of response) {
        await onPart(part.message.content);
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }

  async queryBuilderAgent(prompt, onPart) {
    const agentDescription = `
    Instructions :
    Identifie l'entité principale (selectedEntity) en utilisant le mapping suivant :
      - clients -> debtor
      - contenu (ticket, demandes, procédures) -> case
      - tâches -> task
      - informations de contacts -> contact
      - utilisateurs -> webUser
    voici la demande de l'utilisateur :
     ${prompt}

  [Appel l'outil "getSchema" avec (selectedEntity)]`;

    let messages = [];
    messages.push({role: 'user', content: agentDescription});
    try {
      await onPart(`queryBuilderAgent...</br>`);
      const response = await this._ollama.chat({
        model: this._chatModel,
        options: {
          temperature: this._chatModelTemp,
        },
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'getSchema',
              description: `Permet de retrouver les information de schema d'une entité`,
              parameters: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    description: `type de l'entité`,
                  },
                },
                required: ['type'],
              },
            },
          },
        ],
      });
      messages.push(response.message);
      if (
        !response.message.tool_calls ||
        response.message.tool_calls.length === 0
      ) {
        return `désolé, je n'arrive pas trouver de schéma pour construire une requête`;
      }
      if (response.message.tool_calls) {
        const availableFunctions = {
          getSchema: async ({type}) => {
            await onPart(`récupération du schéma pour ${type}</br>`);
            return `
            Voici les informations de schéma :
            fields: id, postalAddress/townName, name
            selectedEntity: ${type}
            `;
          },
        };
        for (const tool of response.message.tool_calls) {
          const functionToCall = availableFunctions[tool.function.name];
          const functionResponse = await functionToCall(
            tool.function.arguments
          );
          messages.push({
            role: 'tool',
            content: functionResponse,
          });
        }
      }
      await onPart(`Construction de la requête...</br>`);

      const queryPrompt = `
      Construis la condition de la requête (query) en utilisant les opérateurs appropriés (and, or, eq, neq, like).
      - **eq** : égal à
      - **neq** : différent de
      - **like** : contient

      Exemple de construction d'une requête JSON :
      {"version":"1","selectedEntity":"case","fields":[{"property":"id"},{"property":"kind"},{"property":"reference"}],"query":[{"operator":"and","conditions":[{"path":"skillLevels","operator":"like","value":"%sal%"}]}]}

      voici la demande initiale :
      ${prompt}
    `;
      const tools = messages.filter((m) => m.role === 'tool');

      messages = []; //;
      messages = messages.concat(tools);
      messages.push({role: 'user', content: queryPrompt});

      const finalResponse = await this._ollama.chat({
        model: this._chatModel,
        messages,
        options: {
          temperature: this._chatModelTemp,
        },
        stream: true,
        format: {
          type: 'object',
          properties: {
            version: {
              type: 'string',
            },
            selectedEntity: {
              type: 'string',
            },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  property: {
                    type: 'string',
                  },
                },
              },
            },
            query: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  operator: {
                    type: 'string',
                  },
                  conditions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        path: {
                          type: 'string',
                        },
                        operator: {
                          type: 'string',
                        },
                        value: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      for await (const part of finalResponse) {
        await onPart(part.message.content);
      }
      return '0 résultats';
    } catch (error) {
      await onPart(`Erreur: ${error.message}`);
    }
  }

  async chatWithTool(contextId, question, context, onPart) {
    const agentDescription = `
    Tu es un agent intelligent capable d'utiliser divers outils pour répondre aux requêtes des utilisateurs. 
    Voici les outils disponibles :

    1. queryBuilder : Pour obtenir des données spécifiques depuis la base de donnée.
    2. ticketSummary : Pour obtenir des donnée en rapport avec un numéro de ticket.
    
    Exemple d'utilisation de l'outil d'extraction de données:

    Utilisateur : "J'ai besoin des données de vente pour le mois dernier."
    [Appelle queryBuilder avec les paramètres nécessaires]
    [Analyse et construit la réponse finale a partir des résultats des outils]
    Agent : "Voici les résultats: ..."

    N'oublie pas de vérifier si l'utilisation d'un outil pourrait t'aider à répondre à la question de l'utilisateur.
    N'essaie pas de répondre sans utiliser les outils.
    voici la nouvelle question de l'utilisateur :
    ${question}
    `;

    if (!this._sessions[contextId]) {
      this._sessions[contextId] = [];
    }
    const messages = this._sessions[contextId];
    messages.push({role: 'user', content: agentDescription});
    try {
      await onPart(`analyse...</br>`);
      const response = await this._ollama.chat({
        model: this._chatModel,
        messages,
        options: {
          temperature: this._chatModelTemp,
        },
        tools: [
          {
            type: 'function',
            function: {
              name: 'ticketSummary',
              description: `Permet de retrouver les information d'un ticket`,
              parameters: {
                type: 'object',
                properties: {
                  reference: {
                    type: 'string',
                    description: 'Le numéro du ticket par ex. T500.000',
                  },
                },
                required: ['reference'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'queryBuilder',
              description:
                'Effectue des requêtes et des extractions de données',
              parameters: {
                type: 'object',
                properties: {
                  prompt: {
                    type: 'string',
                    description: 'Une définition de la requête à effectuer',
                  },
                },
                required: ['prompt'],
              },
            },
          },
        ],
      });
      messages.push(response.message);
      if (
        !response.message.tool_calls ||
        response.message.tool_calls.length === 0
      ) {
        //reset la session
        this._sessions[contextId] = [{role: 'user', content: agentDescription}];
        await onPart(response.message.content);
        return;
      }
      if (response.message.tool_calls) {
        const availableFunctions = {
          ticketSummary: async ({reference}) => {
            await onPart(`appel de l'outil 'ticketSummary'...</br>`);
            return `${reference}: ticket Yeti`;
          },
          queryBuilder: async ({prompt}) => {
            return await this.queryBuilderAgent(prompt, onPart);
          },
        };
        for (const tool of response.message.tool_calls) {
          const functionToCall = availableFunctions[tool.function.name];
          const functionResponse = await functionToCall(
            tool.function.arguments
          );
          messages.push({
            role: 'tool',
            content: functionResponse,
          });
        }
      }
      await onPart(`Prépare la réponse finale...</br>`);
      const finalResponse = await this._ollama.chat({
        model: this._chatModel,
        messages,
        stream: true,
      });
      for await (const part of finalResponse) {
        await onPart(part.message.content);
      }
    } catch (error) {
      await onPart(`Erreur: ${error.message}`);
    }
  }

  async chat(question, context, onPart, onError) {
    const prompt = `
    ### Contexte:
    ${context}

    ### Question:
    ${question}`;
    try {
      const response = await this._ollama.chat({
        model: this._chatModel,
        messages: [{role: 'user', content: prompt}],
        stream: true,
      });
      for await (const part of response) {
        await onPart(part.message.content);
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }
  async embed(rawText) {
    const {embeddings} = await this._ollama.embed({
      model: 'granite-embedding:278m',
      input: rawText,
    });
    return embeddings;
  }
}

module.exports = YetiAssistant;
