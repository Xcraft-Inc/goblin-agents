# 📘 goblin-agents

## Aperçu

Le module `goblin-agents` fournit une infrastructure complète pour intégrer des agents d'intelligence artificielle (IA) dans l'écosystème Xcraft. Il permet de créer, configurer et interagir avec différents modèles de langage (LLM) via des fournisseurs comme Ollama et OpenAI/OpenRouter. Ce module facilite l'utilisation d'agents IA dans diverses applications en offrant des fonctionnalités avancées : gestion de conversations multi-contextes, analyse de documents PDF par OCR, génération d'embeddings vectoriels pour la recherche sémantique, utilisation d'outils externes, journalisation HTML des échanges, et support du paradigme ReAct pour des agents autonomes.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module est organisé autour du pattern Elf Archetype, avec une séparation claire entre la logique métier et l'interface de l'acteur :

- **`AiAgent`** : Acteur principal persisté (Elf.Archetype) qui encapsule un agent IA et expose ses fonctionnalités sur le bus Xcraft
- **`AiAgentLogic`** : Logique de mutation d'état de l'acteur (pattern Redux)
- **`LLMProviders`** : Registre et classes concrètes pour interagir avec différents fournisseurs LLM (Ollama, OpenAI)
- **`Logger`** : Système de journalisation HTML des échanges IA par session
- **Utilitaires** : Fonctions pour le traitement de texte, HTML, OCR, découpage de chunks et embeddings

## Fonctionnement global

Chaque agent est configuré avec un modèle spécifique, un fournisseur LLM, un prompt système et des paramètres qui définissent son comportement. Les agents peuvent maintenir plusieurs **contextes de conversation** simultanément via un `contextId`, chaque contexte conservant son propre historique de messages.

Le flux général d'utilisation d'un agent :

```
[Création/chargement de l'agent]
        ↓
[Configuration : provider, model, prompt, tools, options]
        ↓
[Appel de méthodes : chat, gen, embed, ask, react...]
        ↓
[Le provider LLM (Ollama ou OpenAI) traite la requête]
        ↓
[La réponse est stockée dans l'historique du contexte]
        ↓
[Persistance optionnelle via save()]
```

Un **mutex par agent** garantit la sérialisation des requêtes simultanées sur le même agent. Chaque échange peut être journalisé dans un fichier HTML de rapport via le `Logger`.

Le module supporte plusieurs modes d'interaction :

- **Génération simple** (`gen`) : prompt → réponse sans historique
- **Chat conversationnel** (`chat`) : avec historique de contexte, appels d'outils optionnels
- **Streaming** (`ask`) : réponse en flux temps réel via événements Xcraft (Ollama uniquement)
- **Vision/OCR** (`vision`, `readPDFpages`) : analyse d'images et de PDFs
- **Embeddings** (`embed`, `embedInBatch`) : vectorisation pour la recherche sémantique
- **ReAct** (`react`) : raisonnement et action autonomes avec orchestration multi-agents

### Gestion de version des agents

La méthode `beforePersistOnServer` protège contre les régressions de version : si un client tente de persister un agent avec une version différente de celle configurée dans `goblin-agents`, les données du serveur sont restaurées depuis le dernier état persisté (`cryo`).

## Exemples d'utilisation

### Création d'un agent IA

```javascript
const {AiAgent} = require('goblin-agents/lib/llm/aiAgent.js');

// Dans une méthode d'un acteur Elf
async initAgents() {
  const feedId = await this.newQuestFeed();

  // Agent local via Ollama
  const agent = await new AiAgent(this).create('aiAgent@mistral-assistant', feedId, {
    name: 'Assistant Personnel',
    role: 'assistant',
    prompt: 'Tu es un assistant personnel serviable et précis.',
    provider: 'ollama',
    model: 'mistral-small',
    host: 'http://127.0.0.1:11434',
    options: {temperature: 0.7},
    usability: 'stable',
  });

  // Agent cloud via OpenRouter
  const cloudAgent = await new AiAgent(this).create('aiAgent@gpt4o-assistant', feedId, {
    name: 'Assistant GPT-4o',
    role: 'assistant',
    provider: 'open-ai',
    model: 'openai/gpt-4o',
    host: 'https://openrouter.ai/api/v1',
    headers: {Authorization: `Bearer <votre-clef-api>`},
    usability: 'stable',
  });
}
```

### Conversation avec un agent

```javascript
async askAgent(desktopId, agentId, contextId, question, saveExchange = false) {
  const feedId = await this.newQuestFeed();
  const agent = await new AiAgent(this).create(agentId, feedId);

  // Conversation avec historique sur le contexte 'story-xyz'
  const response = await agent.chat(contextId, question, desktopId);

  if (saveExchange) {
    await agent.save();
  }
  return response;
}
```

### Utilisation d'outils externes

```javascript
async addWeatherToolToAgent(agentId, contextId, desktopId) {
  const feedId = await this.newQuestFeed();
  const agent = await new AiAgent(this).create(agentId, feedId);

  await agent.patch({
    toolServiceId: 'weather', // acteur singleton qui expose les quêtes "outils"
    tools: [
      {
        type: 'function',
        function: {
          name: 'getWeather',
          description: 'Obtenir la météo pour une ville',
          parameters: {
            type: 'object',
            properties: {
              city: {type: 'string', description: 'Nom de la ville'},
            },
            required: ['city'],
          },
        },
      },
    ],
  });

  const response = await agent.chat(contextId, "Quel temps fait-il à Paris?", desktopId);
  return response;
}
```

### Génération d'embeddings par lots

```javascript
async indexArticles(agentId, articles) {
  const feedId = await this.newQuestFeed();
  const agent = await new AiAgent(this).create(agentId, feedId);

  const articleIds = Object.keys(articles);
  const texts = Object.values(articles);

  const vectorsBatch = await agent.embedInBatch(texts);

  for (let i = 0; i < articleIds.length; i++) {
    const articleId = articleIds[i];
    const vectors = vectorsBatch[i];
    const text = texts[i];
    // Insérer dans une base vectorielle...
  }
}
```

### Agent ReAct autonome

```javascript
async runReactAgent(agentId, contextId, question) {
  const feedId = await this.newQuestFeed();
  const agent = await new AiAgent(this).create(agentId, feedId);

  const reactPrompt = `Tu es un agent autonome. Raisonne étape par étape et agis.`;
  const result = await agent.react(reactPrompt, contextId, question);
  // result : { agentId, action, result, observation }
  return result;
}
```

## Interactions avec d'autres modules

- **[xcraft-core-goblin]** : Fournit l'infrastructure Elf/Archetype pour la création et la persistance des acteurs
- **[xcraft-core-stones]** : Utilisé pour la définition et la validation des types de données (shapes)
- **[xcraft-core-utils]** : Utilisé pour les appels API REST (`RestAPI`), la gestion des verrous (`getMutex`, `Semaphore`)
- **[xcraft-core-etc]** : Utilisé pour charger la configuration du module (version des agents)

Le module peut interagir avec n'importe quel autre acteur Goblin/Elf via le système d'appels d'outils : l'agent envoie des commandes sur le bus Xcraft vers le `toolServiceId` configuré, permettant aux agents IA d'effectuer des actions concrètes dans l'application.

## Configuration avancée

| Option    | Description        | Type   | Valeur par défaut |
| --------- | ------------------ | ------ | ----------------- |
| `version` | Version des agents | Number | `2`               |

## Détails des sources

### `aiAgent.js`

Point d'entrée du module. Exporte les commandes Xcraft pour l'acteur `AiAgent` via `Elf.birth()`, ce qui enregistre l'acteur sur le bus Xcraft au démarrage du serveur.

### `lib/llm/aiAgent.js`

Cœur du module. Contient la définition complète de l'acteur `AiAgent`.

#### État et modèle de données

L'état de l'agent est défini par `AiAgentShape` :

| Propriété       | Type                                                       | Description                                             |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `id`            | `id('aiAgent')`                                            | Identifiant unique de l'agent                           |
| `version`       | `number`                                                   | Version de l'agent (protection contre les régressions)  |
| `name`          | `string`                                                   | Nom de l'agent                                          |
| `role`          | `string`                                                   | Rôle de l'agent (ex : `'assistant'`)                    |
| `prompt`        | `string`                                                   | Prompt système par défaut                               |
| `provider`      | `'ollama' \| 'open-ai'`                                    | Fournisseur LLM                                         |
| `model`         | `string`                                                   | Modèle LLM principal                                    |
| `otherModels`   | `array(string)`                                            | Modèles alternatifs (rotation possible)                 |
| `host`          | `string`                                                   | URL du serveur LLM (défaut : `http://127.0.0.1:11434`)  |
| `headers`       | `record(string, string)`                                   | En-têtes HTTP pour les requêtes API (authentification…) |
| `messages`      | `record(string, array(MessageShape))`                      | Historique des messages indexé par `contextId`          |
| `options`       | `option(OptionsShape)`                                     | Options de configuration du modèle LLM                  |
| `format`        | `option(object)`                                           | Format de sortie JSON attendu                           |
| `tools`         | `option(array(object))`                                    | Définitions des outils externes disponibles             |
| `toolServiceId` | `option(string)`                                           | ID de l'acteur exposant les quêtes outils               |
| `usability`     | `'disabled' \| 'experimental' \| 'stable' \| 'deprecated'` | État d'utilisabilité de l'agent                         |
| `reasoning`     | `option(boolean)`                                          | Active le mode raisonnement (think tags)                |
| `vectorQuality` | `option('f32' \| 'int8')`                                  | Qualité des vecteurs pour les embeddings                |
| `meta`          | `MetaShape`                                                | Métadonnées (statut : `'published'` ou `'trashed'`)     |

**`MessageShape`** décrit chaque message de l'historique :

- `role` : `'assistant' | 'user' | 'tool'`
- `content` : contenu textuel du message
- `images` : liste optionnelle d'images base64
- `tool_calls` : appels d'outils optionnels
- `tool_call_id` / `tool_name` : référence à un appel d'outil (messages de type `tool`)

**`OptionsShape`** expose tous les paramètres de fine-tuning des modèles Ollama : `temperature`, `num_ctx`, `num_gpu`, `top_k`, `top_p`, `repeat_penalty`, `seed`, `stop`, `mirostat`, etc. Chaque option est facultative (`option(...)`).

#### Cycle de vie de l'acteur

`AiAgent` est un **Elf.Archetype** persisté dans la base `agents` avec un index sur `role`.

1. **Création** : `create(id, desktopId, agentState?)` — initialise l'agent, applique les valeurs par défaut, persiste.
2. **Mise à jour** : `patch(agentState)` — met à jour les paramètres et persiste.
3. **Migration de version** : `upgrade(version, agentState)` — applique une mise à niveau uniquement si la version est supérieure à la version actuelle.
4. **Utilisation** : méthodes de conversation, génération, embeddings.
5. **Persistance manuelle** : `save()` — persiste l'état courant.
6. **Suppression logique** : `trash()` — passe le statut meta à `'trashed'`.
7. **Suppression physique** : `delete()` — méthode présente (vide, gérée par le framework).

#### Méthodes publiques

- **`create(id, desktopId, agentState?)`** — Crée et persiste un nouvel agent. `agentState` permet d'initialiser les propriétés dès la création.
- **`patch(agentState)`** — Met à jour les paramètres de l'agent (provider, model, tools, options, etc.) et persiste.
- **`upgrade(version, agentState)`** — Migre l'agent vers une nouvelle version si `version > state.version`.
- **`useOtherModel(model)`** — Permute le modèle actif avec un modèle de `otherModels`. Retourne `false` si le modèle n'est pas dans la liste.
- **`getModelList()`** — Retourne la liste complète des modèles disponibles (`[model, ...otherModels]`).
- **`gen(prompt, contextId='default')`** — Génère une réponse à partir d'un prompt sans historique conversationnel. Journalise l'échange.
- **`reset(contextId, save=false)`** — Réinitialise l'historique d'un contexte. Sans `contextId`, réinitialise tous les contextes.
- **`readPDFpages(pdfPath, pages)`** — Extrait le texte des pages spécifiées d'un PDF via OCR multimodal. Retourne un tableau de descriptions par page.
- **`vision(context, image)`** — Analyse une image base64 avec un contexte textuel. Retourne la description générée par le modèle.
- **`embed(rawText)`** — Génère un embedding vectoriel pour un texte. Retourne une chaîne hex SQL (float32 ou int8 selon `vectorQuality`).
- **`embedInBatch(rawTexts=[])`** — Génère des embeddings pour plusieurs textes en une requête. Retourne un tableau de chaînes hex SQL.
- **`set(contextId, messages)`** — Remplace directement l'historique d'un contexte par une liste de messages.
- **`chat(contextId, question, userDesktopId)`** — Conversation avec historique. Gère automatiquement les appels d'outils si configurés. Retourne la réponse texte ou `true` si un second tour d'outils est nécessaire.
- **`callTools(contextId, message, userDesktopId)`** — Exécute les appels d'outils demandés par le modèle, envoie les commandes sur le bus Xcraft et enregistre les résultats dans l'historique.
- **`addToolMessage(contextId, toolId, toolName, answer)`** — Ajoute un message de résultat d'outil dans l'historique d'un contexte.
- **`ask(contextId, question, questionId)`** — Pose une question avec streaming (Ollama uniquement). Émet des événements `<questionId>` pour chaque fragment de réponse.
- **`resumeExchange(resumePrompt, contextId)`** — Reprend un échange existant avec un nouveau prompt système pour générer un résumé ou une synthèse de la conversation.
- **`react(reactPrompt, contextId, question)`** — Paradigme ReAct : le modèle produit une observation, une pensée, une action et un résultat structurés (JSON). Peut déléguer à un autre agent via `callAgent`.
- **`callAgent(contextId, agentId, action, feedId)`** — Instancie et interroge un autre agent `AiAgent` pour une action dans un workflow multi-agents.
- **`addAssistantMessage(contextId, message)`** — Ajoute directement un message assistant dans l'historique d'un contexte.
- **`save()`** — Persiste l'état courant sur le disque.
- **`change(path, newValue)`** — Modifie une propriété de l'état par chemin (ex : `'options.temperature'`). Convertit automatiquement les types pour `temperature` (float) et `num_ctx` (int).
- **`getUserChatContextHistory(contextId, filterTool=true)`** — Retourne l'historique utilisateur d'un contexte, en filtrant optionnellement les messages d'outils.
- **`getToolChatContextHistory(contextId)`** — Retourne uniquement les messages de type `tool` de l'historique d'un contexte.
- **`getBaseSettings()`** — Retourne les paramètres de base : `{provider, host, headers, model, otherModels}`.
- **`trash()`** — Marque l'agent comme supprimé (`meta.status = 'trashed'`) et persiste.
- **`publish()`** — Marque l'agent comme publié (`meta.status = 'published'`) et persiste.

### `lib/llm/providers.js`

Registre des fournisseurs LLM. La classe `LLMProviders` expose une méthode statique `get(name)` qui retourne la classe du provider correspondant (`OllamaProvider` par défaut, `OpenAIProvider` pour `'open-ai'`).

### `lib/llm/providers/provider.js`

Classe abstraite `LLMProvider` définissant l'interface commune :

- `chat(chatRequest)` : conversation avec le modèle
- `gen(genRequest)` : génération de texte
- `embed(embedRequest)` : embedding d'un texte
- `embedInBatch(embedRequest)` : embedding par lots

Ne peut pas être instanciée directement.

### `lib/llm/providers/ollama.js`

Implémentation concrète pour **Ollama** (serveur local) :

- Utilise la bibliothèque `ollama` pour communiquer avec le serveur
- Implémente un **sémaphore** (`Semaphore(4)`) pour limiter à 4 requêtes d'embedding simultanées
- Supporte le mode `stream` et le mode raisonnement (`think: reasoning`)
- Parse automatiquement les réponses JSON structurées (`format`)

### `lib/llm/providers/opanAi.js`

Implémentation concrète pour **OpenAI** et services compatibles (OpenRouter, etc.) :

- Utilise `RestAPI` de [xcraft-core-utils] pour les appels HTTP avec retry sur POST
- Adapte le format des requêtes : les `options` Ollama sont mergées à la racine de la requête
- Gère les schémas JSON structurés via `response_format` avec `json_schema`
- La méthode `gen` est implémentée via `chat` (conversion prompt → message user)
- Le mode `reasoning` n'est pas encore supporté (supprimé de la requête)

### `lib/logger.js`

Système de journalisation HTML des échanges IA. Chaque session de logging est identifiée par un `id` (typiquement le `contextId`).

**Fonctionnement :**

- `Logger.get(id, quest)` : récupère ou crée un logger pour l'id donné. Enregistre automatiquement un `defer` sur la quête pour appeler `dispose()` à la fin.
- `push(step, payload)` : enregistre un message horodaté avec une étape nommée et un payload clé/valeur.
- `dispose()` : génère un rapport HTML dans `<xcraftRoot>/var/log/ai/` (fichier nommé `<id>_<timestamp>Z.html`) et nettoie le logger du registre. Le logger `'default'` ne génère pas de rapport.

Les rapports HTML sont construits à partir de templates dans `lib/report/` et peuvent servir à l'audit ou au débogage des conversations IA.

### `lib/llm/utils.js`

Ensemble complet d'utilitaires pour le traitement de texte, HTML et documents.

**Traitement de documents PDF :**

- **`getPDFImages(pdfPath, pages)`** — Convertit les pages spécifiées d'un PDF en images base64 (PNG). Nécessite `pdf-to-png-converter` comme dépendance explicite du projet consommateur.
- **`OCR_SYSTEM_PROMPT`** — Prompt système spécialisé pour guider les modèles multimodaux dans l'extraction fidèle de texte depuis des images.

**Traitement HTML :**

- **`cleanHtmlContent(html)`** — Supprime toutes les balises HTML et normalise les espaces blancs.
- **`simplifyHtml(html)`** — Nettoie le HTML en ne gardant que les éléments sûrs via `sanitize-html`.
- **`extractTitlesAndContent(html)`** — Extrait titres (`h1`–`h6`) et paragraphes en préservant la structure, avec découpage des segments longs.
- **`html2chunks(html, chunkSize=300, chunkOverlap=0, minChunkLength=10)`** — Découpe un document HTML en chunks via `RecursiveCharacterTextSplitter` de LangChain.

**Gestion des tokens et découpage :**

- **`estimateTokenCount(text)`** — Estime le nombre de tokens (mots × 1.33).
- **`splitLongText(text, maxLength, baseId)`** — Découpe un texte en segments mot-à-mot avec IDs incrémentaux.
- **`sliceText(text, chunkSize)`** — Découpe par phrases en respectant `chunkSize`.
- **`groupSentences(text, maxSize)`** — Groupe des phrases en blocs de taille optimale, avec fallback mot-à-mot pour les phrases très longues.

**Traitement par lots et embeddings :**

- **`chunkArray(array, size)`** — Divise un tableau en sous-tableaux de taille fixe.
- **`embedChunksInBatch(agent, allChunks, batchSize=50, prefix='passage: ')`** — Traite les embeddings par lots et retourne une map `{ [contentId]: { [key]: { chunk, embedding } } }`.
- **`buildPromptFromArticlesMulti(articles, format='text', maxTotalTokens, dbg)`** — Construit un prompt multi-articles optimisé en respectant une limite de tokens (avec buffer de 16 000 tokens pour l'instruction et la réponse).

**Utilitaires divers :**

- **`splitThinkTags(input)`** — Extrait et sépare le contenu des balises `<think>...</think>` (raisonnement interne) du texte propre. Retourne `{ thinks, cleanText }`.
- **`vectorToSqlLiteral(vec)`** — Convertit un vecteur Float32Array en chaîne hex SQL (float32).
- **`vectorToSqlLiteralInt8(vec)`** — Convertit un vecteur normalisé [-1,1] en int8 quantifié, puis en chaîne hex SQL (plus compact, moins précis).

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

---

_Ce contenu a été généré par IA_

[xcraft-core-goblin]: https://github.com/Xcraft-Inc/xcraft-core-goblin
[xcraft-core-stones]: https://github.com/Xcraft-Inc/xcraft-core-stones
[xcraft-core-utils]: https://github.com/Xcraft-Inc/xcraft-core-utils
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
