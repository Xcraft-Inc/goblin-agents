// @ts-check
const {Elf, SmartId} = require('xcraft-core-goblin');
const {string} = require('xcraft-core-stones');

const {YetiAgent} = require('./yetiAgent.js');
const {Team} = require('goblin-yennefer/lib/cms/team.js');
const {Case, CaseLogic, CaseShape} = require('goblin-yennefer/lib/cms/case.js');
const {ContentLogic} = require('goblin-yennefer/lib/cms/content.js');
const {ContentShape} = require('goblin-yennefer/lib/cms/shapes.js');
const {Task} = require('goblin-yennefer/lib/cms/task.js');

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

  async orchestrate(caseId) {
    const feedId = Elf.createFeed();
    this.quest.defer(async () => await this.killFeed(feedId));
    const caseAPI = await new Case(this).create(caseId, feedId);
    const {caseInfosId} = await this.cryo.getState(
      CaseLogic.db,
      caseId,
      CaseShape
    );
    //Récupérer la mission
    const {content} = await this.cryo.getState(
      ContentLogic.db,
      caseInfosId,
      ContentShape
    );
    const orchestratorAgentId = 'yetiAgent@orchestrator';
    const promptGenAgentId = 'yetiAgent@prompt-gen';
    const orchestrator = await new YetiAgent(this).create(
      orchestratorAgentId,
      feedId
    );
    const promptGen = await new YetiAgent(this).create(
      promptGenAgentId,
      feedId
    );
    //Générer le workflow
    const missionDef = {
      mission: content,
      constraints: [],
      context: '',
      required_expertise: [],
      available_tools: [],
      preferredProvider: 'open-router',
      preferredModel: 'openai/gpt-4o',
    };

    const workflow = await orchestrator.chat(
      caseId,
      JSON.stringify(missionDef)
    );

    //Créer les agents
    const taskAgentIdMapping = {};
    for (const agentInfos of workflow.agents) {
      const {name, model, provider, role, settings} = agentInfos;
      const prompt = await promptGen.gen(JSON.stringify(agentInfos));
      const agentId = SmartId.from('yetiAgent', `${caseId}-${name}`);
      const agentDef = {prompt, model, provider, role, settings};
      await new YetiAgent(this).create(agentId, feedId, agentDef);
      await this.applyDefaultSettings(agentId);
      taskAgentIdMapping[name] = agentId;
    }
    //Créer les tâches
    const taskIdMapping = {};
    for (const taskInfos of workflow.tasks) {
      const {agent, task} = taskInfos;
      const taskId = `task@${Elf.uuid()}`;
      const taskAPI = await new Task(this).create(
        taskId,
        feedId,
        caseId,
        task,
        '',
        'default',
        null
      );
      await caseAPI.addTask(taskAPI.id);
      taskIdMapping[agent] = taskId;
    }
    //executer les tâches
    for (const taskInfos of workflow.tasks) {
      const {agent, task} = taskInfos;
      const agentId = taskAgentIdMapping[agent];
      const agentAPI = await new YetiAgent(this).create(agentId, feedId);
      const result = await agentAPI.gen(task);
      const taskId = taskIdMapping[agent];
      const taskAPI = await new Task(this).create(taskId, feedId);
      await taskAPI.change('description', result);
      await taskAPI.setAsDone();
      await agentAPI.trash();
    }
  }
}
module.exports = {YetiAgentsManager, YetiAgentsManagerLogic};
