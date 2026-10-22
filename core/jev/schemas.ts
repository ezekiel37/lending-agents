import { z } from "zod";
import { Kobo, PositiveKobo } from "../money";
import { ReasonCode } from "./reason-codes";
import { Requirement } from "./requirements";

/*
 * JEV's contract: every input it accepts and every output it may return.
 *
 * Two rules run through this file:
 * 1. Objects are strict: unknown fields are rejected, not silently dropped.
 *    An LLM-backed JEV can't sneak in an extra "note" or "discount" field.
 * 2. No raw PII. JEV gets facts *about* identity (is the BVN verified? does
 *    the name match?), never the BVN, account number or name itself.
 */

// ---------- Shared building blocks ----------

export const RiskBand = z.enum(["A", "B", "C", "D"]);
export type RiskBand = z.infer<typeof RiskBand>;

export const Product = z.enum(["cash", "sme"]);
export type Product = z.infer<typeof Product>;

/** Calendar date, e.g. "2026-10-22". */
const IsoDate = z.iso.date();
/** Timestamp with timezone, e.g. "2026-10-22T09:30:00+01:00". */
const IsoDateTime = z.iso.datetime({ offset: true });

const Probability = z.number().min(0).max(1);
const Count = z.number().int().nonnegative();

function noDuplicates<T>(items: T[]): boolean {
  return new Set(items).size === items.length;
}

const ReasonCodes = z
  .array(ReasonCode)
  .refine(noDuplicates, { message: "Duplicate reason codes" });

/**
 * Every JEV output carries these so the audit log can tie a later outcome
 * (paid, defaulted) back to the exact decision and model that produced it.
 */
const DecisionMeta = {
  decisionId: z.uuid(),
  modelVersion: z.string().min(1),
  decidedAt: IsoDateTime,
};

// ---------- Inputs ----------

/** Features extracted from a bank statement (see sales/statement extraction). */
export const CashFlowFeatures = z
  .strictObject({
    monthsCovered: z.number().int().min(1).max(24),
    avgMonthlyInflow: Kobo,
    /** 1 = identical inflow every month, 0 = completely erratic. */
    inflowRegularity: Probability,
    avgDaysAtZeroBalancePerMonth: z.number().min(0).max(31),
    salaryDetected: z.boolean(),
    salaryDayOfMonth: z.number().int().min(1).max(31).nullable(),
  })
  .refine((f) => f.salaryDetected || f.salaryDayOfMonth === null, {
    message: "salaryDayOfMonth must be null when no salary is detected",
    path: ["salaryDayOfMonth"],
  });
export type CashFlowFeatures = z.infer<typeof CashFlowFeatures>;

/** Summary from the (mock) credit bureau. */
export const BureauSummary = z.strictObject({
  hasCreditHistory: z.boolean(),
  activeLoans: Count,
  activeDelinquency: z.boolean(),
  pastDefaults: Count,
});
export type BureauSummary = z.infer<typeof BureauSummary>;

const ApplicantBase = {
  applicantId: z.string().min(1),
  /** The date JEV should treat as "today". Passed in, never read from the clock, so decisions are reproducible. */
  asOf: IsoDate,
  requestedAmount: PositiveKobo,
  requestedTenorMonths: z.number().int().min(1).max(24),
  /** null = consent not yet captured; JEV must not decide without it. */
  consentCapturedAt: IsoDateTime.nullable(),
  bvnVerified: z.boolean(),
  bvnNameMatch: z.boolean(),
  providedDocuments: z.array(Requirement),
  bureau: BureauSummary,
  cashFlow: CashFlowFeatures.nullable(),
};

export const CashApplicant = z.strictObject({
  ...ApplicantBase,
  product: z.literal("cash"),
  monthlyNetSalary: Kobo,
  /** Repayments already owed to other lenders each month. */
  existingMonthlyRepayments: Kobo,
});

export const SmeApplicant = z.strictObject({
  ...ApplicantBase,
  product: z.literal("sme"),
  business: z.strictObject({
    cacRegistered: z.boolean(),
    /** null when there is no CAC record to compare against. */
    cacNameMatch: z.boolean().nullable(),
    yearsTrading: z.number().min(0),
    statementMonthsProvided: z.number().int().min(0).max(24),
    address: z.strictObject({
      stateValid: z.boolean(),
      lgaValid: z.boolean(),
      verified: z.boolean(),
    }),
    directorsOnCacReport: Count,
    directors: z.array(
      z.strictObject({
        bvnProvided: z.boolean(),
        contactProvided: z.boolean(),
      }),
    ),
  }),
});

/** `product` decides which shape applies; TypeScript narrows on it. */
export const Applicant = z.discriminatedUnion("product", [CashApplicant, SmeApplicant]);
export type Applicant = z.infer<typeof Applicant>;

export const TopUpCustomer = z
  .strictObject({
    customerId: z.string().min(1),
    asOf: IsoDate,
    product: Product,
    monthlyNetIncome: Kobo,
    existingMonthlyRepayments: Kobo,
    bureau: BureauSummary,
    currentLoan: z.strictObject({
      loanId: z.string().min(1),
      principal: PositiveKobo,
      outstandingBalance: Kobo,
      riskBandAtOrigination: RiskBand,
      instalmentsTotal: z.number().int().positive(),
      instalmentsPaid: Count,
      instalmentsPaidOnTime: Count,
      daysPastDue: Count,
    }),
  })
  .refine(
    ({ currentLoan: l }) =>
      l.instalmentsPaidOnTime <= l.instalmentsPaid && l.instalmentsPaid <= l.instalmentsTotal,
    { message: "Need instalmentsPaidOnTime <= instalmentsPaid <= instalmentsTotal", path: ["currentLoan"] },
  );
export type TopUpCustomer = z.infer<typeof TopUpCustomer>;

/** A live loan, as seen by collections scoring and restructure decisions. */
export const CollectionsLoan = z
  .strictObject({
    loanId: z.string().min(1),
    customerId: z.string().min(1),
    asOf: IsoDate,
    product: Product,
    riskBandAtOrigination: RiskBand,
    principal: PositiveKobo,
    outstandingBalance: Kobo,
    instalmentAmount: PositiveKobo,
    nextDueDate: IsoDate,
    instalmentsTotal: z.number().int().positive(),
    instalmentsRemaining: Count,
    instalmentsPaid: Count,
    instalmentsPaidOnTime: Count,
    instalmentsMissed: Count,
    daysPastDue: Count,
    promisesMade: Count,
    promisesKept: Count,
    lastPaymentDate: IsoDate.nullable(),
    salaryDayOfMonth: z.number().int().min(1).max(31).nullable(),
    salaryInflowStopped: z.boolean(),
  })
  .refine((l) => l.promisesKept <= l.promisesMade, {
    message: "promisesKept cannot exceed promisesMade",
    path: ["promisesKept"],
  })
  .refine((l) => l.instalmentsPaidOnTime <= l.instalmentsPaid, {
    message: "instalmentsPaidOnTime cannot exceed instalmentsPaid",
    path: ["instalmentsPaidOnTime"],
  });
export type CollectionsLoan = z.infer<typeof CollectionsLoan>;

// ---------- Outputs ----------

/*
 * Origination is a union of three outcomes instead of one object with an
 * `approved` boolean. With a boolean, `{ approved: false, amount: 500000 }`
 * is representable, and someone will eventually display that amount. Here an
 * amount only exists on an approval, and missing requirements only on
 * needs_more_info, so invalid combinations can't be built at all.
 */
export const OriginationApproved = z.strictObject({
  ...DecisionMeta,
  applicantId: z.string().min(1),
  outcome: z.literal("approved"),
  amount: PositiveKobo,
  tenorMonths: z.number().int().min(1).max(24),
  /** Monthly rate as a fraction: 0.055 = 5.5% per month. Product bands are enforced by the policy envelope. */
  monthlyRate: z.number().gt(0).lt(0.15),
  riskBand: RiskBand,
  reasonCodes: ReasonCodes.min(1),
});

export const OriginationDeclined = z.strictObject({
  ...DecisionMeta,
  applicantId: z.string().min(1),
  outcome: z.literal("declined"),
  riskBand: RiskBand,
  reasonCodes: ReasonCodes.min(1),
});

export const OriginationNeedsMoreInfo = z.strictObject({
  ...DecisionMeta,
  applicantId: z.string().min(1),
  outcome: z.literal("needs_more_info"),
  missingRequirements: z
    .array(Requirement)
    .min(1)
    .refine(noDuplicates, { message: "Duplicate requirements" }),
  reasonCodes: ReasonCodes.min(1),
});

export const OriginationDecision = z.discriminatedUnion("outcome", [
  OriginationApproved,
  OriginationDeclined,
  OriginationNeedsMoreInfo,
]);
export type OriginationDecision = z.infer<typeof OriginationDecision>;

export const TopUpDecision = z.discriminatedUnion("eligible", [
  z.strictObject({
    ...DecisionMeta,
    customerId: z.string().min(1),
    eligible: z.literal(true),
    maxAmount: PositiveKobo,
    reasonCodes: ReasonCodes,
  }),
  z.strictObject({
    ...DecisionMeta,
    customerId: z.string().min(1),
    eligible: z.literal(false),
    reasonCodes: ReasonCodes.min(1),
  }),
]);
export type TopUpDecision = z.infer<typeof TopUpDecision>;

export const Treatment = z.enum([
  "none",
  "soft_reminder",
  "whatsapp_bot",
  "call",
  "restructure_offer",
  "escalate",
]);
export type Treatment = z.infer<typeof Treatment>;

export const CollectionsScore = z.strictObject({
  ...DecisionMeta,
  loanId: z.string().min(1),
  missProbability: Probability,
  /*
   * Two probabilities instead of one so the call queue can rank by *uplift*
   * (how much a call changes the outcome), not just by who is likely to pay.
   * Calling someone who would pay anyway wastes an agent's time.
   */
  pPayIfContacted: Probability,
  pPayIfNotContacted: Probability,
  riskBand: RiskBand,
  recommendedTreatment: Treatment,
  expectedRecovery: Kobo,
  reasonCodes: ReasonCodes,
});
export type CollectionsScore = z.infer<typeof CollectionsScore>;

/*
 * The only restructures anyone (bot or human agent) may offer a borrower.
 * A fee waiver can never skip human approval: `z.literal(true)` makes that a
 * schema rule rather than something each caller has to remember.
 */
const OptionId = z.string().regex(/^rs_[a-z0-9_]+$/, "optionId must look like rs_xxx");

export const RestructureOption = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("tenor_extension"),
    optionId: OptionId,
    extraMonths: z.number().int().min(1).max(6),
    newInstalmentAmount: PositiveKobo,
    requiresHumanApproval: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("payment_holiday"),
    optionId: OptionId,
    months: z.number().int().min(1).max(3),
    resumesOn: IsoDate,
    requiresHumanApproval: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("fee_waiver"),
    optionId: OptionId,
    waiveAmount: PositiveKobo,
    requiresHumanApproval: z.literal(true),
  }),
]);
export type RestructureOption = z.infer<typeof RestructureOption>;

export const RestructureDecision = z.strictObject({
  ...DecisionMeta,
  loanId: z.string().min(1),
  options: z
    .array(RestructureOption)
    .refine((opts) => noDuplicates(opts.map((o) => o.optionId)), {
      message: "Duplicate optionId",
    }),
});
export type RestructureDecision = z.infer<typeof RestructureDecision>;
