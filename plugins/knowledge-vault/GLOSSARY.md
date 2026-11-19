# Knowledge Vault

A skill that keeps one Obsidian vault per product as its knowledge base, stored in its own git repository and brought up to date whenever the product's functionality changes. It exists so that people and agents can learn how a product works now, and how it got there, without reading its code or its commit history.

## Language

### The vault and what it describes

**Product**:
The thing a vault describes, which may span several code repositories.
_Avoid_: Project, app, system

**Vault**:
The Obsidian knowledge base of one product, kept in its own vault repository.
_Avoid_: Wiki, docs, knowledge base, notes folder

**Code repository**:
A git repository that holds part of a product's code.
_Avoid_: Repo (unqualified), project repository, source

**Vault repository**:
The git repository that holds a vault and nothing else.
_Avoid_: Repo (unqualified), docs repository, remote

### What changes and how it is caught

**Functionality change**:
A commit that reaches the main branch of a code repository.
_Avoid_: Update, release, feature, change (unqualified)

**Described commit**:
For each code repository, the latest commit whose functionality changes the vault already reflects.
_Avoid_: Sync point, last sync, checkpoint, cursor

**Documentation pass**:
The work in which an agent reads the functionality changes after the described commit and updates the vault to match them.
_Avoid_: Sync, update, refresh, regeneration

**Bootstrap pass**:
The one bounded documentation pass that fills a new vault from a product's existing code.
_Avoid_: Import, initial sync, full scan

**Vault sync**:
The mechanical exchange of commits between a local vault and its vault repository, done without an agent.
_Avoid_: Documentation pass, pull, update

### What the vault holds

**Agent note**:
A note the agent created and keeps up to date, marked as such in its properties, which may be regenerated from the code at any time.
_Avoid_: Generated note, auto note, machine note

**Owner note**:
A note written by a person, which the agent never rewrites.
_Avoid_: Manual note, human note, user note

**Current-state note**:
An agent note that says how part of the product works now, rewritten whenever that stops being true.
_Avoid_: Spec, reference page, living doc

**Change log entry**:
An agent note written once per documentation pass that records which functionality changes it covered and which notes it changed.
_Avoid_: Changelog, journal, release note, history
