// @ts-check
const {Elf, SmartId} = require('xcraft-core-goblin');
const {string} = require('xcraft-core-stones');

const {YetiAgent} = require('./yetiAgent.js');

class YetiAgentsManagerShape {
  id = string;
}

class YetiAgentsManagerState extends Elf.Sculpt(YetiAgentsManagerShape) {}

class YetiAgentsManagerLogic extends Elf.Spirit {
  state = new YetiAgentsManagerState({
    id: 'yetiAgentsManager',
  });
}

class YetiAgentsManager extends Elf.Alone {
  async updateYetiAgents(profile = null) {
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    const builtInAgents = require('goblin-agents/lib/builtInAgents.js');
    const agentsConfig = require('xcraft-core-etc')().load('goblin-agents');
    const defaultProfile = agentsConfig.defaultProfile;
    let profileRules = null;
    if (profile) {
      this.log.dbg(`Switching profile: ${profile}`);
      profileRules = agentsConfig.profiles[profile] || null;
    } else if (defaultProfile) {
      this.log.dbg(`Using default profile: ${defaultProfile}`);
      profileRules = agentsConfig.profiles[defaultProfile] || null;
    }
    for (let [agentId, agentDef] of Object.entries(builtInAgents)) {
      this.log.dbg(`Updating ${agentId}...`);
      if (profileRules && profileRules[agentId]) {
        const settings = agentsConfig.settings[profileRules[agentId]];
        if (settings) {
          this.log.dbg(`Applying override for ${profile}...`);
          agentDef = {...agentDef, ...settings};
        }
      }
      const agent = await new YetiAgent(this).create(agentId, feedId, agentDef);
      await agent.patch(agentDef);
      this.log.dbg(`Updating ${agentId}...[DONE]`);
    }
  }

  async applyDefaultSettings(agentId) {
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    const yenneferConfig = require('xcraft-core-etc')().load('goblin-yennefer');
    const settings =
      yenneferConfig.agents.settings[yenneferConfig.agents.defaultSettings] ||
      {};
    const agent = await new YetiAgent(this).create(agentId, feedId);
    const baseSettings = await agent.getBaseSettings();
    await agent.patch({...baseSettings, ...settings});
    this.log.dbg(`Applying new profile to ${agentId}...[DONE]`);
  }
}
module.exports = {YetiAgentsManager, YetiAgentsManagerLogic};
