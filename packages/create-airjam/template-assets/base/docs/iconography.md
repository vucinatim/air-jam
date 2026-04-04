# Iconography

Use icons intentionally.

Do not use emojis as UI icons.

## Default Pack Split

Prefer:

1. `@tabler/icons-react` for general UI and system icons
2. `react-icons` `Gi*` exports for game-specific icons

## When To Use `Tabler`

Use `@tabler/icons-react` for:

1. navigation
2. menu items
3. settings
4. device and network status
5. close, back, play, pause, stop, confirm, and other general actions
6. shell and dashboard-like non-gameplay UI

## When To Use `Game Icons`

Use `react-icons` `Gi*` exports for:

1. abilities
2. status effects
3. pickups
4. damage or energy types
5. equipment-like gameplay concepts
6. game-specific verbs and entities that general UI packs do not express well

## Architecture Rule

Do not import icon packs randomly throughout the app.

Prefer local wrappers such as:

1. `src/ui/icons/` for general UI icons
2. `src/game/ui/icons/` for gameplay icons

That keeps:

1. icon usage consistent
2. future swaps possible
3. game icon curation easier

## Attribution Note

The `Gi*` icon set in `react-icons` comes from Game Icons and carries its own attribution expectations.

The project should note that when using those assets, but the template should not hard-enforce attribution behavior for every downstream team.
