const {Elf} = require('xcraft-core-goblin');
const {
  YetiAgentsManager,
  YetiAgentsManagerLogic,
} = require('goblin-agents/lib/llm/yetiAgentsManager.js');

exports.xcraftCommands = Elf.birth(YetiAgentsManager, YetiAgentsManagerLogic);
