# Developer documentation

Use this index to find the design or behavior guide for the change. The code and tests remain the source of truth for current implementation details.

## Architecture

- [Architecture and ownership](architecture.md)

## Interface design

- [Web interface design](ui-design.md)

## Behavior guides

- [Video and audio playback](playback.md)

## Shared contracts

- The [Orchestrator repository](https://github.com/Loco-CTO/zenstream-orchestrator) owns the public API implementation and canonical OpenAPI/fixture contract under `contracts/`.
- This repository consumes those APIs through the client code in `lib/` and its contract tests.

## Contributing and triage

- [Contributing](../CONTRIBUTING.md)
- [Issue and pull request triage](triage.md)
