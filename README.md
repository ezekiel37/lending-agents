# lending-agents

Prototype of AI agents that help a digital lender **sell loans faster** and **collect repayments better**, built around a typed decisioning model (JEV).

Mock data only. Not connected to any production system.

## Run it

Requires Node 20+.

```bash
npm install
npm test          # run all tests
npm run typecheck # strict TypeScript check
```

## Layout

```
core/       business logic, no framework or cloud imports (portable)
  jev/      JEV contract: schemas, reason codes, interface, validation wrapper
tests/      unit tests and fixtures
docs/journal/  one write-up per build step
```

## Build journal
- [Step 1a: JEV schemas and interface](docs/journal/01a-jev-schemas.md)
