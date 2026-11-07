# Contributing

Bug reports, ideas and pull requests are welcome.

## Reporting a bug or asking for a feature

Open an issue saying which plugin, what you expected, and what happened instead. Your Claude Code version (`claude --version`) and terminal help a lot.

## Making a change

1. Fork the repo and clone your fork.
2. Branch from `main`, named after the plugin and the change: `context-bar/narrow-legend`, `usage-bar/hide-weekly`.
3. Load your copy of the plugin while you work:

   ```
   claude --plugin-dir plugins/<name>
   ```

4. Check it before opening a pull request:

   ```
   claude plugin validate plugins/<name>
   claude plugin test plugins/<name>
   ```

5. Bump `version` in the plugin's `.claude-plugin/plugin.json` when the change is something people would notice.
6. Open a pull request against `main` and fill in the template.

Keep each pull request to one plugin and one change where you can; it makes review quick.

## Adding a new plugin

Put it in `plugins/<name>/` with its own `.claude-plugin/plugin.json` (and `hooks/` for a mod, `skills/<skill>/SKILL.md` for a skill), add an entry to `.claude-plugin/marketplace.json`, and add a row to the table in the README.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
