import { describe, expect, it, vi } from "vitest";
import { type Jev, JevContractError, withValidation } from "../core/jev/jev";
import type { Applicant, CollectionsLoan, TopUpCustomer } from "../core/jev/schemas";
import * as fx from "./fixtures/jev";

/** A fake JEV that returns whatever we tell it to, valid or not. */
function fakeJev(overrides: Partial<Record<keyof Jev, unknown>> = {}): Jev {
  return {
    decideOrigination: vi.fn(async () => overrides.decideOrigination ?? fx.approvedDecision()),
    decideTopUp: vi.fn(async () => overrides.decideTopUp ?? fx.topUpEligible()),
    scoreCollections: vi.fn(async () => overrides.scoreCollections ?? fx.collectionsScore()),
    allowedRestructures: vi.fn(async () => overrides.allowedRestructures ?? fx.restructureDecision()),
  } as unknown as Jev;
}

// Fixtures hold plain numbers; the wrapper's whole job is to accept unknown-shaped data and check it.
const applicant = () => fx.cashApplicant() as unknown as Applicant;
const loan = () => fx.collectionsLoan() as unknown as CollectionsLoan;
const customer = () => fx.topUpCustomer() as unknown as TopUpCustomer;

describe("withValidation", () => {
  it("passes valid input through and returns valid output", async () => {
    const jev = withValidation(fakeJev());
    const out = await jev.decideOrigination(applicant());
    expect(out.outcome).toBe("approved");
  });

  it("rejects bad input BEFORE calling the model", async () => {
    const inner = fakeJev();
    const jev = withValidation(inner);
    const bad = { ...applicant(), requestedAmount: -5 } as unknown as Applicant;

    await expect(jev.decideOrigination(bad)).rejects.toMatchObject({
      name: "JevContractError",
      stage: "input",
    });
    expect(inner.decideOrigination).not.toHaveBeenCalled();
  });

  it("rejects model output that breaks the schema", async () => {
    const jev = withValidation(fakeJev({ decideOrigination: { ...fx.declinedDecision(), amount: 50_000_000 } }));

    const err = await jev.decideOrigination(applicant()).catch((e) => e);
    expect(err).toBeInstanceOf(JevContractError);
    expect(err.stage).toBe("output");
    expect(err.method).toBe("decideOrigination");
  });

  it("rejects a decision about a different applicant", async () => {
    const jev = withValidation(fakeJev({ decideOrigination: { ...fx.approvedDecision(), applicantId: "app_999" } }));
    await expect(jev.decideOrigination(applicant())).rejects.toThrow(/applicantId does not match/);
  });

  it("rejects a top-up decision about a different customer", async () => {
    const jev = withValidation(fakeJev({ decideTopUp: { ...fx.topUpEligible(), customerId: "cus_999" } }));
    await expect(jev.decideTopUp(customer())).rejects.toThrow(/customerId does not match/);
  });

  it("rejects expected recovery larger than what the borrower owes", async () => {
    const jev = withValidation(
      fakeJev({ scoreCollections: { ...fx.collectionsScore(), expectedRecovery: 999_000_000 } }),
    );
    await expect(jev.scoreCollections(loan())).rejects.toThrow(/expectedRecovery exceeds/);
  });

  it("rejects restructure options for a different loan", async () => {
    const jev = withValidation(
      fakeJev({ allowedRestructures: { ...fx.restructureDecision(), loanId: "loan_999" } }),
    );
    await expect(jev.allowedRestructures(loan())).rejects.toThrow(/loanId does not match/);
  });

  it("rejects an LLM-style response that invents a discount option", async () => {
    const invented = fx.restructureDecision();
    (invented.options as unknown[]).push({ type: "discount", optionId: "rs_half_off", requiresHumanApproval: false });
    const jev = withValidation(fakeJev({ allowedRestructures: invented }));
    await expect(jev.allowedRestructures(loan())).rejects.toBeInstanceOf(JevContractError);
  });
});
