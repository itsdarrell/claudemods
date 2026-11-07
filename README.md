# claudemods

My Claude Code mods and skills, as one plugin marketplace.

## Install

In a Claude Code terminal session, install any plugin below by name:

```
/plugin install <name> --marketplace itsdarrell/claudemods
```

Answer `y` to add the marketplace the first time, then pick the user scope.

## Update

To get the latest versions:

```
/plugin marketplace update
/plugin update <name>
```

## Plugins

| Name | What it does |
| --- | --- |
| [context-bar](plugins/context-bar) | Draws the context window as a small stacked bar with a legend above the prompt, one color per `/context` category. `/context-bar` toggles it. |
| [prompt-nav](plugins/prompt-nav) | A slim rail on the right listing your previous prompts, the ones on screen highlighted. Hover for the full text, press one to jump to it (fullscreen mode). `/questions` toggles it. |
| [usage-bar](plugins/usage-bar) | Your plan usage beside the context bar: 5-hour and weekly meters with the percent used and when each resets. `/usage-bar` toggles it. |

## Contributing

Found a bug or have an idea? [Open an issue](../../issues). Want to fix or improve something? Fork the repo, make your change on a branch, and open a pull request. [CONTRIBUTING.md](CONTRIBUTING.md) has the details, including how to add a plugin of your own.

## License

[MIT](LICENSE)
