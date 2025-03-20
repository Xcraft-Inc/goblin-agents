const {loadPrompt} = require('./llm/utils.js');

const messageProposalAgent = {
  name: 'Rédacteur Yeti',
  role: 'redaction',
  model: 'mistral-small',
  prompt: loadPrompt('messageProposalAgent.md'),
};

const tasksProposalAgent = {
  name: 'Chef de projet Yeti',
  role: 'agent',
  model: 'mistral-small',
  prompt: loadPrompt('tasksProposalAgent.md'),
  format: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: {type: 'string'},
        description: {type: 'string'},
        urgency: {type: 'integer', enum: [1, 2, 3]},
        importance: {type: 'integer', enum: [1, 2, 3]},
        priority: {type: 'integer', enum: [1, 2, 3]},
      },
      required: ['name', 'description', 'urgency', 'importance', 'priority'],
    },
  },
};

const searchInYetiAgent = {
  name: 'Recherche Yeti',
  role: 'agent',
  model: 'mistral-small',
  prompt: loadPrompt('searchInYetiAgent.md'),
  tools: [
    {
      type: 'function',
      function: {
        name: 'indexer.searchDistance',
        description: `Permet de rechercher par similitude de phrase`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'requête',
            },
          },
        },
      },
    },
  ],
};

//Assistant Yeti pour la rédaction
//Important: le role yeti-assistant permet l'apparition de ceux-ci dans la liste des agents
//disponible dans l'assistant
const rewriteAssistantAgent = {
  name: 'Reformuler',
  role: 'yeti-assistant',
  model: 'mistral-small',
  prompt: loadPrompt('rewriteAgent.md'),
};

const translateAssistantAgent = {
  name: 'Traduire',
  role: 'yeti-assistant',
  model: 'mistral-small',
  prompt: loadPrompt('translateAgent.md'),
};

const embedAgent = {
  name: 'Embed',
  role: 'embedder',
  model: 'granite-embedding:278m',
  prompt: '',
};

//Orchestration multi-agents

const orchestrator = {
  name: 'Orchestrateur',
  role: 'agent-generator',
  provider: 'open-router',
  model: 'openai/gpt-4o',
  prompt: loadPrompt('agentOrchestrator.md'),
  tools: [
    {
      type: 'function',
      function: {
        name: 'agentGenerator',
        description: `Générer les spécifications JSON d'un agent`,
        parameters: {
          type: 'object',
          properties: {
            agentRole: {type: 'string'},
          },
        },
      },
    },
  ],
  format: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {type: 'string'},
            role: {type: 'string'},
            expertise: {type: 'array', items: {type: 'string'}},
            context: {type: 'string'},
            objectives: {type: 'array', items: {type: 'string'}},
            tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {type: 'string'},
                  description: {type: 'string'},
                  parameters: {type: 'array', items: {type: 'string'}},
                },
              },
            },
            delegation: {type: 'array', items: {type: 'string'}},
            provider: {type: 'string'},
            model: {type: 'string'},
            settings: {
              type: 'object',
              properties: {
                temperature: {type: 'integer', max_tokens: {type: 'integer'}},
              },
            },
          },
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agent: {type: 'string'},
              task: {type: 'string'},
              dependencies: {type: 'array', items: {type: 'string'}},
            },
          },
        },
      },
    },
  },
};

const agentGenFormat = {
  type: 'object',
  properties: {
    name: {type: 'string'},
    role: {type: 'string'},
    expertise: {type: 'array', items: {type: 'string'}},
    context: {type: 'string'},
    objectives: {type: 'array', items: {type: 'string'}},
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {type: 'string'},
          description: {type: 'string'},
          parameters: {type: 'array', items: {type: 'string'}},
        },
      },
    },
    delegation: {type: 'array', items: {type: 'string'}},
    provider: {type: 'string', enum: ['open-router', 'ollama']},
    model: {type: 'string', enum: ['openai/gpt-4o', 'mistral-small']},
    settings: {
      type: 'object',
      properties: {
        temperature: {type: 'integer', max_tokens: {type: 'integer'}},
      },
    },
  },
};

const agentGeneratorSmall = {
  name: 'AgentGen (small)',
  role: 'agent-generator',
  provider: 'ollama',
  model: 'mistral-small',
  prompt: loadPrompt('agentGeneratorSmall.md'),
  format: agentGenFormat,
};

const agentGeneratorLarge = {
  name: 'AgentGen (large)',
  role: 'agent-generator',
  provider: 'open-router',
  model: 'openai/gpt-4o',
  prompt: loadPrompt('agentGeneratorLarge.md'),
  format: agentGenFormat,
};

const promptGen = {
  name: 'PromptGen',
  role: 'prompt-generator',
  provider: 'open-router',
  model: 'openai/gpt-4o',
  prompt: loadPrompt('promptGen.md'),
};

const agents = {
  'yetiAgent@orchestrator': orchestrator,
  'yetiAgent@agent-gen-small': agentGeneratorSmall,
  'yetiAgent@agent-gen-large': agentGeneratorLarge,
  'yetiAgent@prompt-gen': promptGen,
  'yetiAgent@message-proposal': messageProposalAgent,
  'yetiAgent@tasks-proposal': tasksProposalAgent,
  'yetiAgent@search-in-yeti': searchInYetiAgent,
  'yetiAgent@rewrite-assistant': rewriteAssistantAgent,
  'yetiAgent@translate-assistant': translateAssistantAgent,
  'yetiAgent@default-embed': embedAgent,
};

module.exports = agents;
