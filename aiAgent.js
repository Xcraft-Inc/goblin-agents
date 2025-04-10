const {Elf} = require('xcraft-core-goblin');
const {AiAgent, AiAgentLogic} = require('goblin-agents/lib/llm/aiAgent.js');

exports.xcraftCommands = Elf.birth(AiAgent, AiAgentLogic);
