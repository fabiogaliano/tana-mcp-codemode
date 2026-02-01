# Benchmark Results: tana-codemode vs tana-local

**Date**: 2026-02-01
**Scenarios**: 20 per benchmark

## Results

| Benchmark      | Cost  | Time | Input | Output | Cache Write | Cache Read | Passed |
| -------------- | ----- | ---- | ----- | ------ | ----------- | ---------- | ------ |
| haiku-codemode | $0.36 | 168s | 318   | 12,771 | 141,749     | 1,174,328  | 20/20  |
| haiku-local    | $0.60 | 123s | 298   | 8,113  | 326,692     | 1,507,149  | 20/20  |
| opus-codemode  | $2.05 | 417s | 124   | 15,743 | 143,833     | 1,510,861  | 20/20  |
| opus-local     | $3.02 | 295s | 105   | 9,865  | 320,323     | 1,545,339  | 20/20  |

## Tool Definition Overhead

| Server    | Tokens  |
| --------- | ------- |
| codemode  | ~1,200  |
| tana-local| ~10,400 |

Codemode uses **8.7x fewer tokens** for tool definitions in context.

## Comparison

| Model | Codemode | tana-local | Cost Savings | Speed |
| ----- | -------- | ---------- | ------------ | ----- |
| Haiku | $0.36    | $0.60      | **40% cheaper** | 37% slower |
| Opus  | $2.05    | $3.02      | **32% cheaper** | 42% slower |

## Key Findings

- **Codemode wins on cost** (32-40% cheaper across both models)
- **tana-local wins on speed** (27-42% faster)
- **Both achieve 100% success rate** on all scenarios
- **Cache write is ~2x lower** for codemode (smaller tool definitions)

## Trade-off

| Priority           | Best Choice |
| ------------------ | ----------- |
| Cost / batch ops   | Codemode    |
| Latency            | tana-local  |

## Folders

```
benchmark-results/
├── haiku-codemode/
├── haiku-local/
├── opus-codemode/
└── opus-local/
```
