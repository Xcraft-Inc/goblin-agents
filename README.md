# 📘 Documentation du module goblin-agents

## Aperçu

Le module `goblin-agents` fournit une infrastructure complète pour intégrer des agents d'intelligence artificielle (IA) dans l'écosystème Xcraft. Il permet de créer, configurer et interagir avec différents modèles de langage (LLM) via des fournisseurs comme Ollama et OpenAI. Ce module est conçu pour faciliter l'utilisation d'agents IA dans diverses applications, en offrant des fonctionnalités avancées comme la gestion de conversations, l'analyse de documents PDF, et l'utilisation d'outils externes.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)

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
  const ollamaAgentId = 'aiAgent@ollama-mistral-assistant';
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
  const openAiAgentId = 'aiAgent@gpt-4o-assistant';
  const cloudAgent = await new AiAgent(this).create(openAiAgentId, feedId, {
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
}
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

  // L'agent pourra maintenant utiliser l'outil weather.getWeather
  const question = "Quel temps fait-il à Paris aujourd'hui?";
  const response = await agent.chat(contextId, question, desktopId);
}
```

### Génération d'embeddings pour la recherche sémantique

```javascript
// Dans une méthode d'un acteur Elf
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
```

## Interactions avec d'autres modules

Le module `goblin-agents` interagit avec plusieurs autres composants de l'écosystème Xcraft :

- **[xcraft-core-goblin]** : Fournit l'infrastructure Elf pour la création d'acteurs
- **[xcraft-core-stones]** : Utilisé pour la définition des types de données
- **[xcraft-core-utils]** : Utilisé pour les appels API REST et la gestion des verrous
- **[xcraft-core-etc]** : Utilisé pour la gestion de la configuration du module

Le module peut également interagir avec d'autres services Goblin via le système d'appels d'outils, permettant aux agents d'effectuer des actions concrètes dans l'application.

## Configuration avancée

| Option          | Description                           | Type   | Valeur par défaut |
| --------------- | ------------------------------------- | ------ | ----------------- |
| version         | Version des agents                    | Number | 2                 |
| defaultProfile  | Profil par défaut des agents          | String | null              |
| defaultSettings | Paramètres par défaut                 | Object | null              |
| profiles        | Profils pour remplacer les paramètres | Object | {}                |
| settings        | Paramètres par nom                    | Object | {}                |

## Détails des sources

### `aiAgent.js`

Ce fichier est le point d'entrée du module, exportant les commandes Xcraft pour l'acteur AiAgent. Il importe l'acteur et sa logique depuis le fichier principal et les expose au système Xcraft via `Elf.birth()`.

### `config.js`

Ce fichier définit la configuration du module, permettant de spécifier :

- La version des agents (`version`)
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

#### État et modèle de données

L'état d'un agent IA est défini par la classe `AiAgentShape` qui contient les propriétés suivantes :

- `id` : Identifiant unique de l'agent
- `version` : Version de l'agent
- `name` : Nom de l'agent
- `role` : Rôle de l'agent (assistant, etc.)
- `prompt` : Prompt par défaut utilisé pour définir le comportement de l'agent
- `provider` : Fournisseur LLM ('ollama' ou 'open-ai')
- `model` : Modèle de langage utilisé
- `host` : URL du serveur LLM
- `headers` : En-têtes HTTP pour les requêtes API
- `messages` : Historique des messages par contexte
- `options` : Options de configuration du modèle (voir OptionsShape)
- `format` : Format de sortie attendu
- `tools` : Outils externes disponibles pour l'agent
- `toolServiceId` : Identifiant du service d'outils
- `usability` : État d'utilisabilité ('disabled', 'experimental', 'stable', 'deprecated')
- `meta` : Métadonnées de l'agent

La classe `OptionsShape` définit de nombreuses options de configuration pour les modèles LLM, incluant des paramètres comme la température, la taille du contexte, les pénalités de répétition, et les options d'optimisation mémoire.

#### Cycle de vie de l'acteur

L'acteur AiAgent suit le cycle de vie standard des acteurs Elf Archetype :

1. **Création** : Via la méthode `create()` qui initialise l'agent avec un ID et un état
2. **Configuration** : Via `patch()` pour modifier les paramètres ou `upgrade()` pour les mises à jour de version
3. **Utilisation** : Via les méthodes de conversation et de génération
4. **Persistance** : Via `save()` pour sauvegarder l'état
5. **Suppression** : Via `trash()` pour marquer comme supprimé ou `delete()` pour suppression définitive

#### Méthodes publiques

**`create(id, desktopId, agentState)`** - Crée un nouvel agent avec l'ID et l'état spécifiés. Persiste automatiquement l'agent après création.

**`patch(agentState)`** - Met à jour l'état de l'agent avec les propriétés fournies et persiste les changements.

**`upgrade(version, agentState)`** - Met à niveau l'agent vers une nouvelle version avec l'état spécifié, uniquement si la version est supérieure à la version actuelle.

**`gen(prompt)`** - Génère du texte à partir d'un prompt en utilisant le modèle configuré de l'agent.

**`reset(contextId, save)`** - Réinitialise l'historique des messages pour un contexte spécifique. Si aucun contextId n'est fourni, réinitialise tous les contextes.

**`readPDFpages(pdfPath)`** - Extrait le texte des pages d'un document PDF en utilisant l'OCR via un modèle multimodal.

**`embed(rawText)`** - Génère un embedding vectoriel pour un texte donné, retourné sous forme de littéral SQL hexadécimal.

**`embedInBatch(rawTexts)`** - Génère des embeddings vectoriels pour plusieurs textes en une seule requête, optimisé pour les traitements par lots.

**`set(contextId, messages)`** - Définit directement l'historique des messages pour un contexte spécifique.

**`chat(contextId, question, userDesktopId, sessionId)`** - Engage une conversation avec l'agent dans un contexte spécifique. Gère automatiquement l'historique et les appels d'outils.

**`ask(contextId, question, questionId)`** - Pose une question à l'agent avec streaming de la réponse (uniquement pour Ollama). Émet des événements pour chaque partie de la réponse.

**`resumeExchange(resumePrompt, contextId)`** - Reprend un échange existant avec un nouveau prompt système, en utilisant l'historique du contexte comme base.

**`react(reactPrompt, contextId, question)`** - Utilise le paradigme ReAct (Reasoning and Acting) pour permettre à l'agent de raisonner et d'agir de manière autonome.

**`callAgent(contextId, agentId, action, feedId)`** - Appelle un autre agent pour effectuer une action spécifique dans le cadre d'une orchestration multi-agents.

**`addAssistantMessage(contextId, message)`** - Ajoute un message de l'assistant à l'historique d'un contexte spécifique.

**`change(path, newValue)`** - Modifie une propriété spécifique de l'état de l'agent avec gestion automatique des types pour certains paramètres.

**`getUserChatContextHistory(contextId, filterTool)`** - Récupère l'historique des messages pour un contexte spécifique avec option de filtrage des messages d'outils.

**`getBaseSettings()`** - Retourne les paramètres de base de l'agent (provider, host, headers, model).

**`getUsability()`** - Retourne l'état d'utilisabilité de l'agent.

**`trash()`** - Marque l'agent comme supprimé en changeant son statut meta à 'trashed'.

**`save()`** - Persiste l'état actuel de l'agent sur le disque.

### `lib/llm/providers.js`

Ce fichier définit l'architecture des fournisseurs de LLM avec une classe abstraite `LLMProvider` et ses implémentations concrètes :

#### LLMProvider (classe abstraite)

Définit l'interface commune que tous les fournisseurs doivent implémenter :

- `chat()` : Conversation avec le modèle
- `gen()` : Génération de texte
- `embed()` : Génération d'embeddings
- `embedInBatch()` : Génération d'embeddings par lots

#### OllamaProvider

Implémentation pour le fournisseur Ollama (serveur local) :

- Utilise la bibliothèque `ollama` pour communiquer avec le serveur
- Gère le streaming pour les conversations en temps réel
- Implémente un sémaphore pour limiter les requêtes d'embedding simultanées (max 4)
- Supporte tous les formats de sortie JSON structurés

#### OpenAIProvider

Implémentation pour OpenAI et services compatibles (OpenRouter, etc.) :

- Utilise `RestAPI` de xcraft-core-utils pour les appels HTTP
- Adapte les formats de requête entre Ollama et OpenAI
- Gère les schémas JSON pour les réponses structurées
- Supporte les en-têtes d'authentification personnalisés

### `lib/llm/utils.js`

Ce fichier contient un ensemble complet d'utilitaires pour le traitement de texte et de documents :

#### Traitement de documents PDF

**`getPDFImages(pdfPath)`** - Convertit les pages d'un PDF en images base64 pour l'OCR avec des options optimisées pour la qualité du texte.

**`OCR_SYSTEM_PROMPT`** - Prompt système spécialisé pour guider les modèles multimodaux dans l'extraction de texte à partir d'images.

#### Traitement de texte et HTML

**`cleanHtmlContent(html)`** - Nettoie le contenu HTML en supprimant les balises et en normalisant les espaces.

**`simplifyHtml(html)`** - Simplifie le HTML en gardant uniquement les éléments sûrs via sanitize-html.

**`extractTitlesAndContent(html)`** - Extrait intelligemment les titres et le contenu d'un document HTML en préservant la structure.

**`html2chunks(html, chunkSize, chunkOverlap)`** - Découpe un document HTML en chunks en utilisant RecursiveCharacterTextSplitter de LangChain.

#### Gestion des tokens et découpage

**`estimateTokenCount(text)`** - Estime le nombre de tokens d'un texte (approximation basée sur les mots × 1.33).

**`splitLongText(text, maxLength, baseId)`** - Découpe un texte long en segments de taille maximale en préservant les mots entiers.

**`sliceText(text, chunkSize)`** - Découpe un texte en chunks en respectant les limites de phrases.

**`groupSentences(text, maxSize)`** - Groupe les phrases en chunks de taille optimale pour les modèles de langage.

#### Traitement par lots et optimisation

**`chunkArray(array, size)`** - Divise un tableau en sous-tableaux de taille spécifiée pour le traitement par lots.

**`embedChunksInBatch(agent, allChunks, batchSize)`** - Traite les embeddings par lots en associant chaque embedding à son contenu d'origine.

**`buildPromptFromArticlesMulti(initialQuestion, questionsWithArticles, maxTotalTokens)`** - Construit des prompts optimisés à partir de multiples articles en respectant les limites de tokens.

#### Utilitaires de conversion

**`vectorToSqlLiteral(vec)`** - Convertit un vecteur Float32Array en littéral SQL hexadécimal pour le stockage en base de données.

Ces utilitaires sont essentiels pour préparer les données avant de les envoyer aux modèles de langage et pour traiter les résultats. Ils permettent notamment de gérer les contraintes de taille de contexte des modèles en découpant intelligemment les textes longs tout en préservant la cohérence sémantique.

_Cette documentation a été mise à jour automatiquement._

[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[xcraft-core-stones]: https://github.com/Xcraft-Inc/xcraft-core-stones
[xcraft-core-utils]: https://github.com/Xcraft-Inc/xcraft-core-utils
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc