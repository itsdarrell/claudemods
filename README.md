# claudemods

My Claude Code mods and skills, as one plugin marketplace.

## Install

In a Claude Code terminal session, install any plugin below by name:

```
/plugin install <name> --marketplace itsdarrell/claudemods
```

Answer `y` to add the marketplace the first time, then pick the user scope.

## Plugins

| Name | What it does |
| --- | --- |
| [context-bar](plugins/context-bar) | Draws the context window as a small stacked bar with a legend above the prompt, one color per `/context` category. `/context-bar` toggles it. |
| [prompt-nav](plugins/prompt-nav) | A slim rail on the right listing your previous prompts, the ones on screen highlighted. Hover for the full text, press one to jump to it (fullscreen mode). `/questions` toggles it. |

## Adding one

Put it in `plugins/<name>/` with its own `.claude-plugin/plugin.json` (and `hooks/` for a mod, `skills/<skill>/SKILL.md` for a skill), then add an entry to `.claude-plugin/marketplace.json`.
