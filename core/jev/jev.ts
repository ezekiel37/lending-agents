import type { z } from "zod";
import {
  Applicant,
  CollectionsLoan,
  CollectionsScore,
  OriginationDecision,
  RestructureDecision,
  TopUpCustomer,
  TopUpDecision,
} from "./schemas";

/**
 * The decisioning model. MockJev, LlmJev and the real JEV all implement this,
 * so the rest of the system never knows (or cares) which one it is talking to.
 *
 * Methods are async because real implementations call a model or a service.
 */
export interface Jev {
  decideOrigination(applicant: Applicant): Promise<OriginationDecision>;
  decideTopUp(customer: TopUpCustomer): Promise<TopUpDecision>;
  scoreCollections(loan: CollectionsLoan): Promise<CollectionsScore>;
  /** The ONLY restructure options anyone may offer this borrower. */
  allowedRestructures(loan: CollectionsLoan): Promise<RestructureDecision>;
}

export type JevMethod = keyof Jev;

/** Thrown when a JEV call receives bad input or returns output that breaks the contract. */
export class JevContractError extends Error {
  constructor(
    readonly method: JevMethod,
    readonly stage: "input" | "output",
    readonly issues: string[],
  ) {
    super(`JEV ${method}: invalid ${stage}: ${issues.join("; ")}`);
    this.name = "JevContractError";
  }
}

function check<S extends z.ZodType>(
  schema: S,
  value: unknown,
  method: JevMethod,
  stage: "input" | "output",
): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new JevContractError(method, stage, issues);
  }
  return result.data;
}

function requireThat(ok: boolean, method: JevMethod, issue: string): void {
  if (!ok) throw new JevContractError(method, "output", [issue]);
}

/**
 * Wraps any JEV so every input and every output is validated at the boundary.
 *
 * Even a "typesafe" model is only typesafe if something checks. TypeScript
 * types disappear at runtime; an LLM or a remote service can return anything.
 * This wrapper is that check, plus a few rules that compare output to input
 * (which a schema alone can't express), e.g. the decision is about the same
 * loan that was asked about.
 *
 * Product limits (min/max amounts, rate bands) are NOT checked here; they
 * are policy, not contract, and live in the policy envelope (step 1b).
 */
export function withValidation(inner: Jev): Jev {
  return {
    async decideOrigination(applicant) {
      const input = check(Applicant, applicant, "decideOrigination", "input");
      const out = check(OriginationDecision, await inner.decideOrigination(input), "decideOrigination", "output");
      requireThat(out.applicantId === input.applicantId, "decideOrigination", "applicantId does not match input");
      return out;
    },

    async decideTopUp(customer) {
      const input = check(TopUpCustomer, customer, "decideTopUp", "input");
      const out = check(TopUpDecision, await inner.decideTopUp(input), "decideTopUp", "output");
      requireThat(out.customerId === input.customerId, "decideTopUp", "customerId does not match input");
      return out;
    },

    async scoreCollections(loan) {
      const input = check(CollectionsLoan, loan, "scoreCollections", "input");
      const out = check(CollectionsScore, await inner.scoreCollections(input), "scoreCollections", "output");
      requireThat(out.loanId === input.loanId, "scoreCollections", "loanId does not match input");
      requireThat(
        out.expectedRecovery <= input.outstandingBalance,
        "scoreCollections",
        "expectedRecovery exceeds outstandingBalance",
      );
      return out;
    },

    async allowedRestructures(loan) {
      const input = check(CollectionsLoan, loan, "allowedRestructures", "input");
      const out = check(RestructureDecision, await inner.allowedRestructures(input), "allowedRestructures", "output");
      requireThat(out.loanId === input.loanId, "allowedRestructures", "loanId does not match input");
      return out;
    },
  };
}
