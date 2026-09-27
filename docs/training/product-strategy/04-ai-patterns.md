# 04 — AI Product Patterns

| Pattern | Use when | Avoid when |
|---|---|---|
| Copilot | Human stays in loop; suggest/edit | Full autonomy required but unsafe |
| Agent | Multi-step tools + decisions | Single transform would suffice |
| Automation | Repetitive deterministic-ish workflow | Needs rare human judgment every time |
| Recommendation | Large option space | Tiny catalog |
| Classification | Labels from messy input | Labels already structured |
| Prediction | Historical signal exists | No data in 24h |
| Generation | Draft artifacts (text/code/image) | Must be legally perfect first try |
| Extraction | Unstructured → fields | Already structured |
| Search / RAG | Private corpus answers | Public ChatGPT is enough |
| CV | Pixels → decisions | Text form would do |
| Voice | Hands-busy / accessibility | Quiet accuracy-critical setting without ASR budget |
| Multimodal | Cross-input (doc+image+voice) | Single modality solves it |
| Personalization | User history/context | Cold start & no profile |
| Workflow automation | Multi-system glue | Single-screen toy |
| Simulation | What-if / training | Needs physics fidelity you don't have |

**Rule:** pick the **smallest** pattern that creates the demo magic. Don't force an agent.
