# Step 1a: JEV schemas and interface

## What we built
- `core/money.ts`: money as integer **kobo**, never floating-point naira.
- `core/jev/reason-codes.ts`, `requirements.ts`: closed lists of reasons and missing documents, each with a description (and a customer-safe "what would change this decision").
- `core/jev/schemas.ts`: Zod schemas for every JEV input and output.
- `core/jev/jev.ts`: the `Jev` interface and `withValidation()`, which checks every input and output at the boundary.
- 51 tests in `tests/`.

## Decisions, and why

**Outcome union instead of an `approved` boolean.** The brief had `{ approved, amount, ... }`. With a boolean, `{ approved: false, amount: 500000 }` is representable, and sooner or later a screen shows that amount. Now the decision is one of `approved | declined | needs_more_info`, and only an approval has an amount. Bad combinations can't be built at all.

**Strict objects.** Unknown fields are rejected, not silently dropped. If an LLM-backed JEV adds `"note": "we can waive the first instalment"`, validation fails.

**No raw PII in JEV inputs.** JEV gets `bvnVerified: true`, not the BVN. It gets `cacNameMatch`, not the business name. Less data reaching a model means less to leak or mask.

**`asOf` is an input.** JEV never reads the system clock, so the same input always gives the same decision. That makes tests and audits reproducible.

**Two probabilities on collections scores.** `pPayIfContacted` and `pPayIfNotContacted` let the call queue rank by *uplift*: how much a call changes the outcome. Ranking by likelihood to pay alone sends agents to people who would have paid anyway.

**Fee waivers always need a human.** `requiresHumanApproval: z.literal(true)` on fee waivers. It's a schema rule, so no caller can forget it.

**Every output carries `decisionId`, `modelVersion` and `decidedAt`.** Later outcomes (paid, defaulted) link back to the exact decision and model version. Without this, the feedback loop can't train on anything.

**The validation wrapper also compares output to input.** For example, the decision must be about the same loan that was asked about, and expected recovery can't exceed what's owed. A schema alone can't express those rules.

## Changes from the original brief
| Brief | Now | Why |
|---|---|---|
| `approved: boolean` | `outcome` union | Bad combinations can't be built |
| `scoreCollections` had no reason codes | Added `reasonCodes` | The pre-call brief needs to say *why* a loan is risky |
| `allowedRestructures` returns an array | Returns `{ decisionId, loanId, options }` | So offers can be audited back to a decision |
| Single repayment probability | `pPayIfContacted` + `pPayIfNotContacted` | Ranking by uplift |

## Not here yet (on purpose)
Product limits and rate bands (₦20k–₦2m, 4–7% a month) are **policy**, not contract. They go in `config/` and the policy envelope in step 1b. The schema only rejects things that are never valid, such as a 150% monthly rate or a negative amount.

## Gotchas
- `npm install vitest@4` failed with `Cannot read properties of null (reading 'edgesOut')`, an npm 10 bug in peer dependency resolution. Fix: `npm install -D vitest@4 --legacy-peer-deps` once. After that, a plain `npm install` works from the lockfile.

## Review questions
1. Why can't a declined decision accidentally show a loan amount?
2. An LLM-backed JEV returns a valid decision for applicant `app_002` when asked about `app_001`. What catches it, and where?
3. Why does JEV get `bvnVerified` instead of the BVN itself?
4. Why are amounts in kobo? What goes wrong with naira as floats?
5. Where would you add a rule like "maximum cash loan is ₦2m", and why not in `schemas.ts`?
