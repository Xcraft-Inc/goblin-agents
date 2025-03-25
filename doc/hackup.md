# Hackup du 26 mars 2025 / Samuel Loup

## 🎯 Objectifs du jour

Démystifier les LLMs : comprendre sans se perdre dans la complexité.

Se concentrer sur les bases avant d’utiliser des frameworks.

Acquérir les concepts et le vocabulaire essentiels.

Montrer comment les agents peuvent simplifier l’orchestration des LLMs (use-case dans le logiciel Yeti).

# La théorie

## 🚀 Un LLM, ce n’est pas de la magie, c’est juste des maths

🔹 Un LLM est une grosse calculatrice statistique qui prédit le mot suivant en fonction d’un contexte donné.

## 🧠 Les LLMs ne comprennent rien, ils imitent des patterns

🔹 Un LLM ne comprend pas ce qu’il dit, il imite statistiquement ce qu’il a appris.

## L'oiseau bleu

```
Quand je dis l'oiseau, vous dite bleu...
```

## 🔍 Local vs Cloud – Où tourne un LLM ?

🔹 Un LLM peut être hébergé sur un serveur distant (OpenAI, Claude, Gemini) ou tourné en local sur un PC.

🔑 LLM ≠ API, il y a plusieurs façons de les faire tourner.

# 🤗 Hugginface

Hugging Face est la plateforme centrale pour les LLMs, agissant comme un GitHub dédié aux modèles de langage et autres technologies d’intelligence artificielle. Il permet de partager, tester, fine-tuner, et déployer des modèles tout en offrant un environnement de collaboration et d’innovation continue pour les chercheurs, les entreprises et la communauté open-source.

C'est un lieu incontournable pour travailler avec des modèles pré-entrainés et rester à jour avec les dernières avancées dans le domaine des LLMs.

# 🧬 Nomenclature des Modèles LLM

Nom de base : Désigne l'architecture ou le type de modèle (GPT, Llama, Mistral).

Taille : Indique le nombre de paramètres, par exemple, 7B pour 7 milliards de paramètres.

Optimisation : Des termes comme quantized, flash ou turbo désignent des versions optimisées.

Spécificité : Des ajouts comme **embed**, **instruct** ou **multilingual** indiquent des spécifications

## 🍆 C'est pas la taille qui compte

### small

Exemple : **mistral-small** (22 millions de paramètres)

Utilisé pour des tâches légères avec des ressources limitées, mais avec des performances acceptables sur des tâches simples.

### base

Exemple : **llama-7B** (7 milliards de paramètres)

Modèles adaptés aux serveurs ou aux déploiements avec une puissance de calcul plus conséquente. Bonne performance sur une large gamme de tâches, tout en restant relativement léger.

### large

Exemple : **gpt-3** (175 milliards de paramètres), llama-30B (30 milliards de paramètres).

Ces modèles nécessitent une grande quantité de mémoire GPU pour être exécutés efficacement. Ils offrent des performances exceptionnelles sur des tâches complexes et offrent un excellent traitement contextuel.

### mega-large

Exemple : **gpt-4** (100+ milliards de paramètres).

Ces modèles sont utilisés pour des applications de pointe mais nécessitent une infrastructure matérielle robuste (clusters de serveurs, GPU haut de gamme, etc.).

## Quantization

La quantization est un processus qui réduit la taille des modèles en réduisant la précision des poids et des activations (par exemple, passer de 32 bits à 16 bits ou 8 bits), permettant des performances plus rapides tout en réduisant l'empreinte mémoire.

### Impact de la Quantization

Un modèle quantized consomme moins de mémoire (par exemple, 8 GB au lieu de 16 GB) et **s'exécute plus vite**, surtout sur des GPU ou des processeurs spécialisés dans les calculs à faible précision (comme les Tensor Cores des GPUs NVIDIA).

La perte de précision est souvent négligeable dans des tâches pratiques, mais peut affecter des tâches plus spécifiques où la précision est cruciale.

## Spécificités

Les modèles **instruct** sont conçus pour suivre des instructions spécifiques, et sont entraînés avec des exemples où l'objectif est de générer des réponses précises et utiles en fonction de ce qui est demandé. Les modèles génératifs classiques, quant à eux, se concentrent plus sur la fluidité de la génération de texte sans forcément respecter des consignes précises.

# Problématique de la taille du contexte et du nombre de tokens

Un token est une unité de texte (mot, morceau de mot ou caractère).

La taille du contexte d’un modèle LLM correspond au nombre maximal de tokens qu’il peut traiter en une seule requête.

Limite de mémoire : Plus le contexte est long, plus il faut de mémoire GPU/CPU pour l'inférence.

Perte d’information : Si le contexte dépasse la limite, l’excès de tokens est tronqué (en général à gauche).

Dégradation des performances : Certains modèles gèrent mal les contextes longs et oublient des infos en début de texte.

# Le format GGUF

Le format GGUF est souvent utilisé pour stockage et échange de modèles de machine learning, en particulier dans des scénarios où plusieurs composants doivent interagir, comme les réseaux de neurones et les moteurs d'inférence.

Il permet d'optimiser la performances computationnelles tout en facilitant le stockage, l'échange, et le déploiement de modèles. Grâce à son approche basée sur des graphes et à sa compatibilité avec divers environnements matériels, GGUF est une solution clé pour la gestion des modèles modernes dans le domaine de l'IA.

[https://huggingface.co/mradermacher](https://huggingface.co/mradermacher)

# Architectures

**Transformer** : Architecture de base pour tous les modèles modernes (GPT, BERT, T5, etc.).

**BERT** : Bidirectionnel, efficace pour la compréhension du langage et les tâches de classification.

**GPT** : Unidirectionnel, spécialisé dans la génération de texte.

**T5** : Architecture text-to-text, très flexible pour les tâches NLP.

**XLNet** : Mélange de BERT et GPT, avec une meilleure gestion des dépendances.

**BART** : Combiné de BERT et GPT, adapté pour des tâches de génération et de résumé.

**Turing-NLG** : Génération de texte de haute qualité et cohérent.

**Reformer** : Optimisation des Transformers pour les séquences longues.

**Albert** : Version légère de BERT, plus rapide et moins gourmande en ressources.

**Llama** : Optimisé pour des modèles plus petits avec des performances de haute qualité.

## Llama

Description : Llama est une architecture Transformer développée par Meta (anciennement Facebook). Elle est conçue pour offrir des performances compétitives tout en étant plus légère que les plus grands modèles de la série GPT-3 et GPT-4. Llama est une architecture open-source permettant une flexibilité d'usage.

Exemples de modèles : Llama-7B, Llama-13B, Llama-30B.

# Inférer un modèle

## Monter une infrastructure locale avec Ollama

[https://ollama.com/](https://ollama.com/)

```bash
ollama pull <model de votre choix>
```

```bash
ollama run mistral-nemo
```

### Ollama API

[api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "mistral-nemo",
  "prompt":"Salut Mistral !"
}'
```

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "mistral-nemo",
  "messages": [
    { "role": "user", "content": "Salut Mistral !" }
  ]
}'
```

```bash
curl http://localhost:11434/api/embed -d '{
  "model": "granite-embedding:278m",
  "input": "Salut Mistral !"
}'
```

## Utiliser le Cloud

### OpenAI API

[https://platform.openai.com/docs/api-reference/introduction](https://platform.openai.com/docs/api-reference/introduction)

### Openrouter.ai

[https://openrouter.ai/docs/quickstart](https://openrouter.ai/docs/quickstart)

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ]
}'

```

## Utiliser une lib

## Avec llama.cpp

[https://github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)

# Avec node-llama

[https://node-llama-cpp.withcat.ai/](https://node-llama-cpp.withcat.ai/)

```bash
npx --no node-llama-cpp inspect gpu
```

# Intégration de l'IA dans Yeti avec Xcraft

## Xcraft - Le framework maison

[📘 documentation](../../../doc/autogen/xcraft-core-goblin/readme.md)

## Agents - Les agents maison

[🧠 un agent](../../../lib/goblin-agents/lib/llm/yetiAgent.js)

[📘 documentation](../../../doc/autogen/goblin-agents/llm.md)

## Cryo - Le data-layer maison

[📘 documentation](../../../doc/autogen/xcraft-core-goblin/cryo.md)

### Embeddings

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS embeddings768 USING vec0(
    documentId TEXT,
    chunkId TEXT,
    chunk TEXT,
    embedding FLOAT[768] distance_metric=cosine
)


SELECT documentId, chunkId, chunk, distance
      FROM embeddings768
      WHERE embedding match $vectors
      ORDER BY distance LIMIT $limit
```

## Indexeur de contenu

```js
class ChunkShape {
  chunk = string;
  embedding = array;
}

class MetaShape {
  index = option(string); //FullTextSearch
  status = enumeration('published', 'trashed', 'archived');
  vectors = option(record(string, ChunkShape)); //SQLITE-VEC
}

class IndexedContentShape {
  id = id('indexedContent');
  kind = string;
  title = string;
  description = string;
  contextId = string;
  sourceId = string;
  relatedIds = array(string);
  weight = number;
  meta = MetaShape;
}
```

[🧪 indexeur de contenu](../../../lib/goblin-yennefer/lib/indexer.js)

## Articles wordpress

[📜 ragCresus](../../../lib/goblin-yennefer/lib/prompts/ragCresus.md)

[🧪 processus RAG dans wordpress](../../../lib/goblin-epsilon/lib/wordpress/wordpress.js)

[📘 documentation de la partie Wordpress](../../../doc/autogen/goblin-epsilon/wordpress.md)

## Agents de bases

[🧠 définition des agents de base](../../../lib/goblin-yennefer/lib/builtInAgents.js)

[📘 documentation de la partie LLM](../../../doc/autogen/goblin-yennefer/llm.md)

## Générer de la doc

[📜 codeAnalyser](../../../lib/goblin-yennefer/lib/prompts/codeAnalyser.md)

[🧪 générateur de doc](../../../lib/goblin-yennefer/lib/codeMiner.js)

## Générer un dataset

[📜 qaMinerDatasetBuilder](../../../lib/goblin-yennefer/lib/prompts/qaMinerDatasetBuilder.md)

[🧪 générateur de Question&Answer ](../../../lib/goblin-yennefer/lib/qaMiner.js)

## Génération de tâches et analyse de cas

[📜 tasksProposalAgent](../../../lib/goblin-yennefer/lib/prompts/tasksProposalAgent.md)

[📜 agentOrchestrator](../../../lib/goblin-yennefer/lib/prompts/agentOrchestrator.md)

[📜 promptGen](../../../lib/goblin-yennefer/lib/prompts/promptGen.md)

[🧪 analyse de cas](../../../lib/goblin-yeti/lib/widgets/case-workitem/service.js)

[📘 documentation du case-workitem](../../../doc/autogen/goblin-yeti/case-workitem.md)

## Dans le journal

[🧪 commander des agents](../../../lib/goblin-yeti/lib/widgets/journal/service.js)

[📘 documentation du journal](../../../doc/autogen/goblin-yeti/journal.md)

# Bonus : extraction et analyse de PDF

```js
//TODO
```
