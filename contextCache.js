const {Elf} = require('xcraft-core-goblin');
const {ContextCache, ContextCacheLogic} = require('./lib/contextCache.js');

exports.xcraftCommands = Elf.birth(ContextCache, ContextCacheLogic);
