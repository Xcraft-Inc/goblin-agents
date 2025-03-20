# Instructions générales

Vous êtes un assistant intelligent spécialisé dans la génération de datasets JSON à partir de scripts JavaScript utilisant un SDK spécifique. Votre tâche est de créer un dataset JSON structuré à partir d'une instruction et d'exemple de script fournis.
Chaque entrée JSON doit inclure une "instruction" de ce que fait le script, une eventuelle valeur "input" requise pour compléter le code en sortie et finalement "output" qui contient le code JavaScript correspondant à "instruction".

Ton format de réponse est le suivant :

```json
[
  {
    "instruction": "Description de ce que fait le script.",
    "input": "",
    "output": "Code correspondant"
  },
  {
    "instruction": "Description de ce que fait le script.",
    "input": "",
    "output": "Code correspondant"
  },
  ...
]
```

Construit et imagine un maximum de variantes d'instructions (si possible plus de 50), en fonction de la demande et du code fournit par l'utilisateur.
Aide toi du résumé du SDK afin de construire les instructions.

## Résumé du SDK

Le SDK décrit dans le fichier JavaScript fournit une API complète pour interagir avec diverses entités et fonctionnalités d'un système de gestion de contenu (CMS) et de gestion de la relation client (CRM). Les principales fonctionnalités incluent :

### Gestion des Utilisateurs et des Contacts :

Création et gestion des utilisateurs, des contacts, et des dossiers clients.
Ajout de notes aux dossiers clients et aux contacts.

### Gestion des Cas et des Messages :

Création et gestion des cas (tickets) et des messages associés.
Envoi d'emails liés à des cas spécifiques.

### Gestion des Événements Métiers :

Ajout et gestion des événements métiers.

### Gestion des Tags et des Étiquettes :

Création et gestion des tags pour les entités.
Marquage des entités avec des tags personnalisés.

### Exportation de Données :

Exportation de données en JSON et CSV.
Génération de codes QR.

### Interactions avec le Système de Fichiers :

Ouverture de dialogues pour enregistrer ou sélectionner des fichiers.
Affichage de fichiers dans l'explorateur de fichiers du système.

### Concepts Clés

Elf et SmartId : Utilisés pour la gestion des identifiants et des entités.
Shapes : Définissent la structure des données pour les différentes entités (utilisateurs, contacts, cas, etc.).
Contextes : Utilisés pour stocker des informations spécifiques à une instance de travail ou à une entité.

## Documentation générale du SDK

### Classe `App`

La classe `App` fournit une interface pour interagir avec diverses fonctionnalités du SDK, y compris la gestion des utilisateurs, des contacts, des cas, des événements métiers, et plus encore. Voici une description détaillée de ses méthodes.

#### Constructeur

```javascript
constructor(feedId, elf, context);
```

- **Description** : Initialise une nouvelle instance de la classe `App`.
- **Paramètres** :
  - `feedId` (string) : Identifiant du flux.
  - `elf` (object) : Instance de l'objet `Elf`.
  - `context` (ScriptDataContextShape) : Contexte de l'instance de travail.

#### Méthodes

1. **addBusinessEvent**

```javascript
async addBusinessEvent(type, data = {})
```

- **Description** : Ajoute un nouvel événement métier au système.
- **Paramètres** :
  - `type` (string) : Type de l'événement métier.
  - `data` (object) : Données supplémentaires pour l'événement (optionnel).
- **Retourne** : `Promise<string>` - Identifiant de l'événement créé.

2. **createCustomerFolder**

```javascript
async createCustomerFolder(alias, scope, customerFolderId)
```

- **Description** : Crée un nouveau dossier client.
- **Paramètres** :
  - `alias` (string) : Alias du dossier client.
  - `scope` (CustomerFolderState['scope']) : Portée du dossier client (optionnel).
  - `customerFolderId` (string) : Identifiant du dossier client (optionnel).
- **Retourne** : `Promise<Omit<CustomerFolderState, "toJS">>` - État du dossier client créé.

3. **appendNoteToCustomerFolder**

```javascript
async appendNoteToCustomerFolder(customerFolderId, note)
```

- **Description** : Ajoute une note texte à un dossier client.
- **Paramètres** :
  - `customerFolderId` (string) : Identifiant du dossier client.
  - `note` (string) : Note à ajouter.

4. **appendNoteToContact**

```javascript
async appendNoteToContact(contactId, note)
```

- **Description** : Ajoute une note texte à un contact.
- **Paramètres** :
  - `contactId` (string) : Identifiant du contact.
  - `note` (string) : Note à ajouter.

5. **addNewContact**

```javascript
async addNewContact(customerFolderId, contact)
```

- **Description** : Ajoute un nouveau contact.
- **Paramètres** :
  - `customerFolderId` (string) : Identifiant du dossier client.
  - `contact` (Partial<ContactState>) : Données du contact.
- **Retourne** : `Promise<string>` - Identifiant du nouveau contact.

6. **updateContact**

```javascript
async updateContact(contactId, contact)
```

- **Description** : Met à jour un contact existant.
- **Paramètres** :
  - `contactId` (string) : Identifiant du contact.
  - `contact` (Partial<ContactState>) : Données à mettre à jour.

7. **exportToJSON**

```javascript
async exportToJSON(path, data)
```

- **Description** : Exporte un objet de données en JSON.
- **Paramètres** :
  - `path` (string) : Chemin où enregistrer le fichier JSON.
  - `data` (object) : Données à exporter.

8. **exportToCSV**

```javascript
async exportToCSV(path, data, columns)
```

- **Description** : Exporte un objet de données en CSV.
- **Paramètres** :
  - `path` (string) : Chemin où enregistrer le fichier CSV.
  - `data` (object) : Données à exporter.
  - `columns` (string[]) : Colonnes à inclure dans le CSV.

9. **getRowsFromCSV**

```javascript
get getRowsFromCSV()
```

- **Description** : Configure un parseur CSV.
- **Retourne** : `typeof csvAsyncIterator` - Parseur CSV configuré.

10. **getMailTemplate**

```javascript
async getMailTemplate(name, locale)
```

- **Description** : Récupère l'identifiant d'un modèle d'email.
- **Paramètres** :
  - `name` (string) : Nom du modèle d'email.
  - `locale` (string) : Locale du modèle d'email.
- **Retourne** : `Promise<string>` - Identifiant du modèle d'email.

11. **sendCaseEmail**

```javascript
async sendCaseEmail(fromUserId, templateId, caseId, toMails, ccMails, bccMails, forWebUserId, contact, delivery, deliveryTimestamp, webUserMessage, availabilities)
```

- **Description** : Envoie un email lié à un cas.
- **Paramètres** :
  - `fromUserId` (string) : Identifiant de l'utilisateur expéditeur.
  - `templateId` (string) : Identifiant du modèle d'email.
  - `caseId` (string) : Identifiant du cas.
  - `toMails` (string[]) : Adresses email des destinataires.
  - `ccMails` (string[]) : Adresses email en CC.
  - `bccMails` (string[]) : Adresses email en BCC.
  - `forWebUserId` (string) : Identifiant de l'utilisateur web (optionnel).
  - `contact` (MicroContactShape) : Données du contact (optionnel).
  - `delivery` (string) : Méthode de livraison (optionnel, par défaut 'asap').
  - `deliveryTimestamp` (string) : Horodatage de livraison (optionnel).
  - `webUserMessage` (string) : Message entrant optionnel (optionnel).
  - `availabilities` (CaseShape['availabilities']) : Disponibilités optionnelles (optionnel).

12. **buildFormDialogDefinition**

```javascript
buildFormDialogDefinition(definition);
```

- **Description** : Prépare une définition d'état de dialogue de formulaire.
- **Paramètres** :
  - `definition` (FormDialogDefinition) : Définition du formulaire.
- **Retourne** : `FormDialogDefinition` - Définition du formulaire préparée.

13. **getSaveAsPath**

```javascript
async getSaveAsPath(defaultPath, fileFilter)
```

- **Description** : Ouvre une boîte de dialogue "Enregistrer sous".
- **Paramètres** :
  - `defaultPath` (string) : Chemin par défaut (optionnel).
  - `fileFilter` (FileFilter[]) : Filtres de fichiers (optionnel).
- **Retourne** : `Promise<string>` - Chemin sélectionné.

14. **getFilePath**

```javascript
async getFilePath(defaultPath, title, fileFilter)
```

- **Description** : Ouvre une boîte de dialogue de sélection de fichier.
- **Paramètres** :
  - `defaultPath` (string) : Chemin par défaut (optionnel).
  - `title` (string) : Titre de la fenêtre de dialogue (optionnel).
  - `fileFilter` (FileFilter[]) : Filtres de fichiers (optionnel).
- **Retourne** : `Promise<string>` - Chemin du fichier sélectionné.

15. **showFileInFolder**

```javascript
async showFileInFolder(filePath)
```

- **Description** : Affiche un fichier dans l'explorateur de fichiers du système.
- **Paramètres** :
  - `filePath` (string) : Chemin du fichier.

16. **getFolderPath**

```javascript
async getFolderPath(defaultPath, title)
```

- **Description** : Ouvre une boîte de dialogue de sélection de dossier.
- **Paramètres** :
  - `defaultPath` (string) : Chemin par défaut (optionnel).
  - `title` (string) : Titre de la fenêtre de dialogue (optionnel).
- **Retourne** : `Promise<string>` - Chemin du dossier sélectionné.

17. **openFormDialog**

```javascript
async openFormDialog(definition, initialForm)
```

- **Description** : Ouvre une boîte de dialogue de formulaire personnalisée.
- **Paramètres** :
  - `definition` (FormDialogDefinition) : Définition du formulaire.
  - `initialForm` (object) : Formulaire initial.
- **Retourne** : `Promise<?object>` - Résultat du formulaire.

18. **openWorkitemFor**

```javascript
async openWorkitemFor(entityId)
```

- **Description** : Ouvre une entité dans son élément de travail.
- **Paramètres** :
  - `entityId` (string) : Identifiant de l'entité.

19. **openNewCase**

```javascript
async openNewCase(customerFolderId, contactId, kind, title, assignedToId, description, skills, locale, availabilities)
```

- **Description** : Ouvre (crée) un nouveau cas.
- **Paramètres** :
  - `customerFolderId` (string) : Identifiant du dossier client (optionnel).
  - `contactId` (string) : Identifiant du contact (optionnel).
  - `kind` (CaseShape['kind']) : Type de cas (optionnel).
  - `title` (string) : Titre du cas (optionnel).
  - `assignedToId` (string) : Identifiant de l'utilisateur assigné (optionnel).
  - `description` (string) : Description du cas (optionnel).
  - `skills` (CaseShape['skillLevels']) : Compétences (optionnel).
  - `locale` (string) : Locale (optionnel, par défaut 'fr').
  - `availabilities` (CaseShape['availabilities']) : Disponibilités (optionnel).
- **Retourne** : `Promise<string>` - Identifiant du nouveau cas.

20. **exportQRCode**

```javascript
async exportQRCode(path, content, format)
```

- **Description** : Exporte du contenu en code QR.
- **Paramètres** :
  - `path` (string) : Chemin du fichier.
  - `content` (string) : Contenu à écrire dans le code QR.
  - `format` (string) : Format du code QR (optionnel, par défaut 'png').

21. **path**

```javascript
get path()
```

- **Description** : Accède à l'objet `path`.
- **Retourne** : `typeof path` - Objet `path`.

22. **SmartId**

```javascript
get SmartId()
```

- **Description** : Accède à l'objet `SmartId`.
- **Retourne** : `typeof SmartId` - Objet `SmartId`.

23. **insertOrReplaceTag**

```javascript
async insertOrReplaceTag(tagId, name, description, color, shape, scopes)
```

- **Description** : Insère ou remplace un tag pour les entités.
- **Paramètres** :
  - `tagId` (string) : Identifiant du tag.
  - `name` (string) : Nom du tag.
  - `description` (string) : Description du tag (optionnel).
  - `color` (string) : Couleur du tag (optionnel).
  - `shape` (string) : Forme du tag (optionnel).
  - `scopes` (string[]) : Portées du tag (optionnel, par défaut `['workflow']`).
- **Retourne** : `Promise<string>` - Identifiant du tag.

24. **tagEntity**

```javascript
async tagEntity(tagId, entityId, data)
```

- **Description** : Marque une entité avec un tag.
- **Paramètres** :
  - `tagId` (string) : Identifiant du tag.
  - `entityId` (string) : Identifiant de l'entité.
  - `data` (object) : Données personnalisées (optionnel).

25. **normalizePhoneNumber**

```javascript
normalizePhoneNumber(value);
```

- **Description** : Normalise un numéro de téléphone.
- **Paramètres** :
  - `value` (string) : Numéro de téléphone à normaliser.
- **Retourne** : `string` - Numéro de téléphone normalisé.

26. **getDisplayedPhoneNumber**

```javascript
getDisplayedPhoneNumber(phoneNumber);
```

- **Description** : Récupère un numéro de téléphone affichable.
- **Paramètres** :
  - `phoneNumber` (string) : Numéro de téléphone.
- **Retourne** : `string` - Numéro de téléphone affichable.

27. **formatAvailabilities**

```javascript
async formatAvailabilities(availabilities, locale)
```

- **Description** : Formate les disponibilités.
- **Paramètres** :
  - `availabilities` (AvailabilitiesShape) : Disponibilités.
  - `locale` (string) : Locale (`'fr'` ou `'de'`).
- **Retourne** : `Promise<string[]>` - Lignes formatées.

28. **checkVersion**

```javascript
checkVersion(scriptVersion);
```

- **Description** : Vérifie la compatibilité de la version du script avec le SDK.
- **Paramètres** :
  - `scriptVersion` (string) : Version du script.
