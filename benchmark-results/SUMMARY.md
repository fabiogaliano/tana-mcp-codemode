# Benchmark Results: tana-codemode vs tana-local

**Date**: 2026-02-01
**Scenarios**: 20 per benchmark

## Results

| Benchmark      | Cost  | Time | Tokens Out | Passed |
| -------------- | ----- | ---- | ---------- | ------ |
| haiku-codemode | $0.36 | 168s | 12,771     | 20/20  |
| haiku-local    | $0.60 | 122s | 8,113      | 20/20  |
| opus-codemode  | $2.05 | 417s | 15,743     | 20/20  |
| opus-local     | $3.02 | 294s | 9,865      | 20/20  |

## Comparison

| Model | Codemode Cost | Local Cost | Savings         | Speed      |
| ----- | ------------- | ---------- | --------------- | ---------- |
| Haiku | $0.36         | $0.60      | **40% cheaper** | 37% slower |
| Opus  | $2.05         | $3.02      | **32% cheaper** | 42% slower |

## Key Findings

- **Codemode wins on cost** (32-40% cheaper across both models)
- **tana-local wins on speed** (27-42% faster)
- **Both achieve 100% success rate** on all scenarios

## Trade-off

| Priority                        | Best Choice |
| ------------------------------- | ----------- |
| Cost-sensitive / batch ops      | Codemode    |
| Latency-sensitive / interactive | tana-local  |

## Folders

```
benchmark-results/
├── haiku-codemode/
├── haiku-local/
├── opus-codemode/
└── opus-local/
```
