const {Elf} = require('xcraft-core-goblin');
const {
  YetiAgent,
  YetiAgentLogic,
} = require('goblin-agents/lib/llm/yetiAgent.js');

exports.xcraftCommands = Elf.birth(YetiAgent, YetiAgentLogic);
