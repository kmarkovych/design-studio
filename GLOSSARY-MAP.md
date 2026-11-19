# Glossary Map

## Contexts

- [Design Studio](./GLOSSARY.md): the design-studio plugin, which does the work of a UI/UX designer for browser-rendered interfaces
- [Knowledge Vault](./plugins/knowledge-vault/GLOSSARY.md): the knowledge-vault plugin, which keeps one Obsidian vault per product up to date with its code

## Relationships

- **Design Studio → Knowledge Vault**: none directly. A design-studio run writes its files into a target project's code repository; when they reach the main branch they are a functionality change like any other, and a documentation pass picks them up. Neither plugin requires the other.
- **Target project ↔ Product**: a design-studio target project is one code repository of a knowledge-vault product.
