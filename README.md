# 📘 Documentation du module goblin-agents

## Aperçu

Le module `goblin-agents` fournit une infrastructure complète pour intégrer des agents d'intelligence artificielle (IA) dans l'écosystème Xcraft. Il permet de créer, configurer et interagir avec différents modèles de langage (LLM) via des fournisseurs comme Ollama et OpenAI. Ce module est conçu pour faciliter l'utilisation d'agents IA dans diverses applications, en offrant des fonctionnalités avancées comme la gestion de conversations, l'analyse de documents PDF, et l'utilisation d'outils externes.

## Structure du module

- **AiAgent** : Acteur principal qui encapsule un agent IA et ses fonctionnalités
- **Providers** : Classes pour interagir avec différents fournisseurs de LLM (Ollama, OpenAI)
- **Utilitaires** : Fonctions pour le traitement de texte, l'OCR, et la manipulation de documents

Le module est organisé autour du pattern Elf, avec une séparation claire entre la logique métier (`AiAgentLogic`) et l'interface de l'acteur (`AiAgent`).

## Fonctionnement global

Le module `goblin-agents` permet de créer et gérer des agents IA qui peuvent interagir avec les utilisateurs via des conversations textuelles. Chaque agent est configuré avec un modèle spécifique, un fournisseur (Ollama ou OpenAI), et des paramètres qui définissent son comportement.

Les agents peuvent maintenir plusieurs contextes de conversation simultanément, ce qui permet d'avoir des conversations distinctes avec différents utilisateurs ou sur différents sujets. Chaque contexte conserve son propre historique de messages, ce qui permet à l'agent de maintenir la cohérence dans ses réponses.

Le module prend en charge diverses fonctionnalités avancées :
- Génération de texte à partir de prompts
- Conversations interactives avec historique
- Extraction de texte à partir d'images de documents PDF
- Génération d'embeddings vectoriels pour la recherche sémantique
- Utilisation d'outils externes via un système d'appels d'outils
- Paradigme ReAct (Reasoning and Acting) pour des agents plus autonomes

Les agents peuvent être configurés avec une grande variété d'options qui influencent leur comportement, comme la température (créativité), la taille du contexte, et diverses pénalités pour éviter les répétitions.

## Exemples d'utilisation

### Création d'un agent IA

```javascript
const {AiAgent} = require('goblin-agents/lib/llm/aiAgent.js');

// Dans une méthode d'un acteur Elf
async initAgents() {  
  const feedId = await this.newQuestFeed();

  // Création d'un agent avec Ollama (local)
  const ollamaAgentId = SmartId.from('aiAgent', 'ollama-mistral-assistant');
  const agent = await new AiAgent(this).create(ollamaAgentId, feedId, {
    name: 'Assistant Personnel',
    role: 'assistant',
    prompt: 'Tu es un assistant personnel serviable et précis.',
    provider: 'ollama',
    model: 'mistral-small',
    host: 'http://127.0.0.1:11434',
    options: {
      temperature: 0.7
    },
    usability: 'stable'
  });

  // Création d'un agent avec OpenAI (cloud)
  const openAiAgentId = SmartId.from('aiAgent', 'gpt-4o-assistant');
  const agent = await new AiAgent(this).create(openAiAgentId, feedId, {
    name: 'Assistant Personnel',
    role: 'assistant',
    provider: 'open-ai',
    model: 'openai/gpt-4o',
    host: 'https://openrouter.ai/api/v1',
    headers: {
      Authorization: `Bearer <votre-clef-api>`,
    },
    usability: 'stable'
  });
```

### Conversation avec un agent

```javascript

// Dans une méthode d'un acteur Elf
async askAgent(desktopId, agentId, contextId, question, saveExchange = false) {
  const feedId = await this.newQuestFeed();
  
  // Instancie l'agent approprié par ex. 'aiAgent@gpt-4o-assistant'
  const agent = await new AiAgent(this).create(agentId, feedId);
 
  // Continue la conversation sur ce contexte par ex. 'story-xyz' et 
  // obtient une réponse à la question de l'utilisateur
  const response = await agent.chat(contextId, question, desktopId);

  if(saveExchange) {
    //Persiste l'échange contextuel nouvelle paire (question->réponse) sur le disque
    await agent.save();
  }
  return response;
}
```

### Résumer et "squasher" un contexte

```javascript

// Dans une méthode d'un acteur Elf
async resumeAndSquashContexte(agentId, contextId) {
  const feedId = await this.newQuestFeed();
  
  // Instancie l'agent approprié par ex. 'aiAgent@gpt-4o-assistant'
  const agent = await new AiAgent(this).create(agentId, feedId);

  // Demande un résumé des échanges
  const resumePrompt = "Résume l'essentiel de nos échanges en utilisant l'historique des messages";
  const resumedContent = await agent.resumeExchange(resumePrompt, contextId);

  // Reset la mémoire contextuel et persiste le changement
  await agent.reset(contextId, true);

  // Ajoute un nouvel historique d'échange a partir du résumé 
  await agent.set(contextId, [{role: 'assistant', content: resumedContent}]);

  // Sauve ce nouvel état
  await agent.save();
}
```

### Utilisation d'outils externes

```javascript

// Dans une méthode d'un acteur Elf
async addWeatherToolSupportToAgent(agentId) {
  const feedId = await this.newQuestFeed();
  
  // Instancie l'agent approprié par ex. 'aiAgent@gpt-4o-assistant'
  const agent = await new AiAgent(this).create(agentId, feedId);

  // Configurer un agent avec des outils
  // Provoquera des envois de commandes sur le bus à l'acteur "weather"
  // en appelant la quête "getWeather(city)"
  await agent.patch({
    toolServiceId: 'weather', //acteur (ici le singleton weather) qui expose des quêtes "outils"
    tools: [
      {
        type: 'function',
        function: {
          name: 'getWeather', //nom de la quête de l'acteur qui récupère la météo
          description: 'Obtenir la météo pour une ville',
          parameters: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'Nom de la ville'
              }
            },
            required: ['city']
          }
        }
      }
    ]
  });
}


// L'agent pourra maintenant utiliser l'outil weather.getWeather
const question = "Quel temps fait-il à Paris aujourd'hui?";
const response = await agent.chat(contextId, question, desktopId);

```

### Génération d'embeddings pour la recherche sémantique

```javascript

// Dans une méthode d'un acteur Elf
// {
//  'indexContent@article-1', 'Contenu à indexer'
//  'indexContent@article-2', 'Un autre contenu à indexer'
// }
//
async updateKnowledgeBase(articles) {
  const feedId = await this.newQuestFeed();

  // Instancie l'agent approprié pour faire un embedding
  // par ex. 'aiAgent@default-embedder'
  const agent = await new AiAgent(this).create(agentId, feedId);

  // Récupère les textes à indexer
  const texts = Object.values(articles);

  // Prépare un boucle d'insertion par id d'article
  const articlesIds = Object.keys(articles);

  // Générer des embeddings pour plusieurs textes en une seule requête
  const vectorsBatch = await agent.embedInBatch(texts);

  // Upsert les articles dans un archetype IndexedContent 
  for(const articleId of articleIds) {
    // Récupère les vecteurs correspondant au texte dans le lot 
    // et le texte original
    const index = articleIds.indexOf(articleId);
    const vectors = vectorsBatch[index];
    const text = texts[index];

    const indexedContent = new IndexedContentState({
      id: articleId,
      text, //texte original de l'article
      meta: {
        locale: 'fr', //définit la locale
        scope: 'knowledge-base', //définit le scope
        vectors, //vecteur correspondants au texte
        status: 'published',
      }
    });

    // Effectue l'upsert de l'archetype
    await new IndexedContent(this).insertOrReplace(
      articleId,
      feedId,
      indexedContent
    );
  }
}

// Dans une méthode d'un acteur Elf
async queryKnowledgeBase(question = "Comment fonctionne l'apprentissage par renforcement?") {
  const feedId = await this.newQuestFeed();

  // Instancie l'agent approprié pour faire un embedding
  // par ex. 'aiAgent@default-embedder'
  const agent = await new AiAgent(this).create(agentId, feedId);

  // Générer un embedding pour un texte, par ex. pour une recherche
  // Convertit la question texte en vecteurs
  const vectors = await agent.embed(question);

  // Effectue une recherche par similitude dans cryo
  // Utilise un Archetype "IndexedContent"
  // Limite la recherche au contenu indexé en français
  // avec un scope 'knowledge-base'
  // les 100 premier résultats les plus pertinents
  const results = await this.cryo.searchDistance2(
    IndexedContentLogic.db,
    vectors,
    ['fr'],
    ['knowledge-base'],
    100
  );

  // Itère sur les données et retourne les résultats
  // a l'appelant
  return Array.from(results);
}
```

## Interactions avec d'autres modules

Le module `goblin-agents` interagit avec plusieurs autres composants de l'écosystème Xcraft :

- **xcraft-core-goblin** : Fournit l'infrastructure Elf pour la création d'acteurs
- **xcraft-core-stones** : Utilisé pour la définition des types de données
- **xcraft-core-utils** : Utilisé pour les appels API REST et la gestion des verrous

Le module peut également interagir avec d'autres services Goblin via le système d'appels d'outils, permettant aux agents d'effectuer des actions concrètes dans l'application.

## Configuration avancée

- **version** : Version des agents (par défaut: 2)
- **defaultProfile** : Profil par défaut des agents (par défaut: null)
- **defaultSettings** : Paramètres par défaut (par défaut: null)
- **profiles** : Profils pour remplacer les paramètres (par défaut: {})
- **settings** : Paramètres par nom (par défaut: {})

## Détails des sources

### `aiAgent.js`

Ce fichier est le point d'entrée du module, exportant les commandes Xcraft pour l'acteur AiAgent. Il importe l'acteur et sa logique depuis le fichier principal et les expose au système Xcraft.

### `config.js`

Ce fichier définit la configuration du module, permettant de spécifier :

- Le profil par défaut des agents (`defaultProfile`)
- Les paramètres par défaut (`defaultSettings`)
- Les profils pour remplacer les paramètres (`profiles`)
- Les paramètres par nom (`settings`)

Cette configuration permet de personnaliser le comportement des agents au niveau de l'application.

### `lib/llm/aiAgent.js`

Ce fichier contient la définition complète de l'acteur AiAgent, avec :

- **MessageShape** : Définit la structure des messages échangés (rôle, contenu, images, appels d'outils)
- **OptionsShape** : Définit les nombreuses options de configuration des modèles LLM
- **AiAgentShape** : Définit la structure des données de l'agent
- **AiAgentState** : Classe d'état de l'agent basée sur le shape
- **AiAgentLogic** : Logique métier de l'agent (mutations d'état)
- **AiAgent** : Classe principale de l'acteur avec les méthodes d'interaction

L'acteur AiAgent offre de nombreuses méthodes pour interagir avec les modèles de langage, gérer les conversations, et utiliser des outils externes. Il prend en charge différentes configurations et options pour personnaliser le comportement des modèles.

Les options de configuration sont particulièrement riches et permettent d'ajuster finement le comportement des modèles, notamment :
- Gestion de la mémoire (NUMA, VRAM)
- Taille du contexte et traitement par lots
- Paramètres de génération (température, top_k, top_p)
- Pénalités pour éviter les répétitions
- Algorithmes adaptatifs comme Mirostat

### `lib/llm/providers.js`

Ce fichier définit les classes pour interagir avec différents fournisseurs de LLM :

- **LLMProvider** : Classe abstraite définissant l'interface commune
- **OllamaProvider** : Implémentation pour le fournisseur Ollama (local)
- **OpenAIProvider** : Implémentation pour OpenAI et services compatibles

Ces classes encapsulent les détails d'implémentation spécifiques à chaque fournisseur, offrant une interface unifiée pour le reste du module. Elles gèrent les différences dans les formats de requête et de réponse, permettant à l'acteur AiAgent de fonctionner de manière transparente avec différents fournisseurs.

### `lib/llm/utils.js`

Ce fichier contient diverses fonctions utilitaires pour :

- Extraction de texte à partir d'images PDF (`getPDFImages`)
- Nettoyage et simplification de contenu HTML (`cleanHtmlContent`, `simplifyHtml`)
- Découpage de texte en segments gérables (`splitLongText`, `html2chunks`)
- Estimation du nombre de tokens (`estimateTokenCount`)
- Construction de prompts à partir d'articles (`buildPromptFromArticles`)
- Traitement par lots des embeddings (`embedChunksInBatch`, `chunkArray`)

Ces utilitaires sont essentiels pour préparer les données avant de les envoyer aux modèles de langage et pour traiter les résultats. Ils permettent notamment de gérer les contraintes de taille de contexte des modèles en découpant intelligemment les textes longs.

Le module inclut également des fonctionnalités spécifiques pour l'OCR (reconnaissance optique de caractères) avec un prompt système dédié (`OCR_SYSTEM_PROMPT`) qui guide les modèles multimodaux dans l'extraction de texte à partir d'images.

*Ce document est une mise à jour de la documentation précédente.*