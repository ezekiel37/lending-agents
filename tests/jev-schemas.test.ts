import { describe, expect, it } from "vitest";
import { REASON_CODES, REASON_CODE_INFO } from "../core/jev/reason-codes";
import { REQUIREMENTS, REQUIREMENT_INFO } from "../core/jev/requirements";
import {
  Applicant,
  CollectionsLoan,
  CollectionsScore,
  OriginationDecision,
  RestructureDecision,
  TopUpCustomer,
  TopUpDecision,
} from "../core/jev/schemas";
import * as fx from "./fixtures/jev";

/** Fixtures are typed as valid input; tests deliberately break them, so loosen the type. */
type Loose = Record<string, any>;
const loose = (x: unknown) => x as Loose;

describe("fixtures are valid (so every failure below is caused by the one change made)", () => {
  it.each([
    ["cash applicant", Applicant, fx.cashApplicant()],
    ["sme applicant", Applicant, fx.smeApplicant()],
    ["top-up customer", TopUpCustomer, fx.topUpCustomer()],
    ["collections loan", CollectionsLoan, fx.collectionsLoan()],
    ["approved", OriginationDecision, fx.approvedDecision()],
    ["declined", OriginationDecision, fx.declinedDecision()],
    ["needs more info", OriginationDecision, fx.needsMoreInfoDecision()],
    ["top-up eligible", TopUpDecision, fx.topUpEligible()],
    ["collections score", CollectionsScore, fx.collectionsScore()],
    ["restructures", RestructureDecision, fx.restructureDecision()],
  ] as const)("%s", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });
});

describe("reason codes and requirements", () => {
  it("every reason code has a description", () => {
    for (const code of REASON_CODES) {
      expect(REASON_CODE_INFO[code].description.length).toBeGreaterThan(0);
    }
  });

  it("every requirement has a description and a fix instruction", () => {
    for (const req of REQUIREMENTS) {
      expect(REQUIREMENT_INFO[req].description.length).toBeGreaterThan(0);
      expect(REQUIREMENT_INFO[req].howToFix.length).toBeGreaterThan(0);
    }
  });

  it("rejects free-text reasons", () => {
    const d = loose(fx.declinedDecision());
    d.reasonCodes = ["Customer seems risky"];
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects duplicate reason codes", () => {
    const d = loose(fx.declinedDecision());
    d.reasonCodes = ["PAST_DEFAULT_ON_RECORD", "PAST_DEFAULT_ON_RECORD"];
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });
});

describe("origination decision", () => {
  it("an approval must carry amount, tenor and rate", () => {
    const d = loose(fx.approvedDecision());
    delete d.amount;
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("a decline cannot carry an amount (no 'declined but here is ₦500k')", () => {
    const d = loose(fx.declinedDecision());
    d.amount = 50_000_000;
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("needs_more_info must list at least one missing requirement", () => {
    const d = loose(fx.needsMoreInfoDecision());
    d.missingRequirements = [];
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects an unknown outcome", () => {
    const d = loose(fx.approvedDecision());
    d.outcome = "maybe";
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects extra fields (e.g. an LLM adding its own 'note')", () => {
    const d = loose(fx.approvedDecision());
    d.note = "We can also waive the first instalment";
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects a rate given as a percentage instead of a fraction", () => {
    const d = loose(fx.approvedDecision());
    d.monthlyRate = 5.5;
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it.each([
    ["fractional kobo", 50_000_000.5],
    ["zero", 0],
    ["negative", -100],
    ["a string", "500000"],
  ])("rejects an amount that is %s", (_label, amount) => {
    const d = loose(fx.approvedDecision());
    d.amount = amount;
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects an invalid risk band", () => {
    const d = loose(fx.approvedDecision());
    d.riskBand = "E";
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });

  it("rejects a non-UUID decisionId", () => {
    const d = loose(fx.approvedDecision());
    d.decisionId = "decision-1";
    expect(OriginationDecision.safeParse(d).success).toBe(false);
  });
});

describe("inputs", () => {
  it("rejects raw PII fields such as a BVN (strict objects)", () => {
    const a = loose(fx.cashApplicant());
    a.bvn = "22212345678";
    expect(Applicant.safeParse(a).success).toBe(false);
  });

  it("a cash applicant cannot carry SME business fields", () => {
    const a = loose(fx.cashApplicant());
    a.business = loose(fx.smeApplicant()).business;
    expect(Applicant.safeParse(a).success).toBe(false);
  });

  it("salary day must be null when no salary is detected", () => {
    const a = loose(fx.cashApplicant());
    a.cashFlow.salaryDetected = false;
    expect(Applicant.safeParse(a).success).toBe(false);
  });

  it("rejects more promises kept than made", () => {
    const l = loose(fx.collectionsLoan());
    l.promisesKept = 3;
    expect(CollectionsLoan.safeParse(l).success).toBe(false);
  });

  it("rejects an impossible top-up history (more on-time payments than payments)", () => {
    const c = loose(fx.topUpCustomer());
    c.currentLoan.instalmentsPaidOnTime = 5;
    expect(TopUpCustomer.safeParse(c).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const l = loose(fx.collectionsLoan());
    l.nextDueDate = "25/10/2026";
    expect(CollectionsLoan.safeParse(l).success).toBe(false);
  });
});

describe("top-up decision", () => {
  it("an ineligible decision cannot carry a maxAmount", () => {
    const d = loose(fx.topUpEligible());
    d.eligible = false;
    expect(TopUpDecision.safeParse(d).success).toBe(false);
  });

  it("an ineligible decision must explain why", () => {
    const d = loose(fx.topUpEligible());
    d.eligible = false;
    delete d.maxAmount;
    d.reasonCodes = [];
    expect(TopUpDecision.safeParse(d).success).toBe(false);
  });
});

describe("collections score", () => {
  it.each(["missProbability", "pPayIfContacted", "pPayIfNotContacted"])(
    "%s must be between 0 and 1",
    (field) => {
      const s = loose(fx.collectionsScore());
      s[field] = 1.2;
      expect(CollectionsScore.safeParse(s).success).toBe(false);
    },
  );

  it("rejects an unknown treatment (e.g. 'visit_home')", () => {
    const s = loose(fx.collectionsScore());
    s.recommendedTreatment = "visit_home";
    expect(CollectionsScore.safeParse(s).success).toBe(false);
  });
});

describe("restructure options", () => {
  it("a fee waiver can never skip human approval", () => {
    const d = loose(fx.restructureDecision());
    d.options[2].requiresHumanApproval = false;
    expect(RestructureDecision.safeParse(d).success).toBe(false);
  });

  it("rejects an unknown restructure type (e.g. a discount)", () => {
    const d = loose(fx.restructureDecision());
    d.options.push({ type: "discount", optionId: "rs_discount", percent: 50, requiresHumanApproval: false });
    expect(RestructureDecision.safeParse(d).success).toBe(false);
  });

  it("rejects duplicate optionIds (the bot refers to options by id)", () => {
    const d = loose(fx.restructureDecision());
    d.options[1].optionId = d.options[0].optionId;
    expect(RestructureDecision.safeParse(d).success).toBe(false);
  });

  it("rejects a tenor extension beyond 6 months", () => {
    const d = loose(fx.restructureDecision());
    d.options[0].extraMonths = 12;
    expect(RestructureDecision.safeParse(d).success).toBe(false);
  });

  it("allows an empty list (JEV may allow no restructure at all)", () => {
    const d = loose(fx.restructureDecision());
    d.options = [];
    expect(RestructureDecision.safeParse(d).success).toBe(true);
  });
});
