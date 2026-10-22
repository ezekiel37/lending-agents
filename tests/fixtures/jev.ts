import type { z } from "zod";
import type {
  Applicant,
  CollectionsLoan,
  CollectionsScore,
  OriginationDecision,
  RestructureDecision,
  TopUpCustomer,
  TopUpDecision,
} from "../../core/jev/schemas";

/*
 * Known-good examples of every JEV input and output. Tests copy one and
 * break a single field, so each failing test points at exactly one rule.
 * Amounts are in kobo: 50_000_000 kobo = ₦500,000.
 */

const meta = {
  decisionId: "6f1c2a9e-3b4d-4c5e-8f60-718293a4b5c6",
  modelVersion: "mock-jev-0.1.0",
  decidedAt: "2026-10-22T09:30:00+01:00",
};

export const cashApplicant = (): z.input<typeof Applicant> => ({
  product: "cash",
  applicantId: "app_001",
  asOf: "2026-10-22",
  requestedAmount: 50_000_000,
  requestedTenorMonths: 6,
  consentCapturedAt: "2026-10-22T09:00:00+01:00",
  bvnVerified: true,
  bvnNameMatch: true,
  providedDocuments: ["BVN", "VALID_GOVERNMENT_ID", "SALARY_ACCOUNT_STATEMENT_3M", "BVN_LOOKUP_CONSENT"],
  bureau: { hasCreditHistory: true, activeLoans: 1, activeDelinquency: false, pastDefaults: 0 },
  cashFlow: {
    monthsCovered: 3,
    avgMonthlyInflow: 35_000_000,
    inflowRegularity: 0.92,
    avgDaysAtZeroBalancePerMonth: 1,
    salaryDetected: true,
    salaryDayOfMonth: 25,
  },
  monthlyNetSalary: 30_000_000,
  existingMonthlyRepayments: 2_000_000,
});

export const smeApplicant = (): z.input<typeof Applicant> => ({
  product: "sme",
  applicantId: "app_101",
  asOf: "2026-10-22",
  requestedAmount: 500_000_000,
  requestedTenorMonths: 12,
  consentCapturedAt: "2026-10-22T09:00:00+01:00",
  bvnVerified: true,
  bvnNameMatch: true,
  providedDocuments: ["BVN", "CAC_CERTIFICATE", "BUSINESS_BANK_STATEMENT_6M"],
  bureau: { hasCreditHistory: true, activeLoans: 0, activeDelinquency: false, pastDefaults: 0 },
  cashFlow: null,
  business: {
    cacRegistered: true,
    cacNameMatch: true,
    yearsTrading: 3,
    statementMonthsProvided: 6,
    address: { stateValid: true, lgaValid: true, verified: false },
    directorsOnCacReport: 2,
    directors: [
      { bvnProvided: true, contactProvided: true },
      { bvnProvided: false, contactProvided: true },
    ],
  },
});

export const topUpCustomer = (): z.input<typeof TopUpCustomer> => ({
  customerId: "cus_001",
  asOf: "2026-10-22",
  product: "cash",
  monthlyNetIncome: 30_000_000,
  existingMonthlyRepayments: 0,
  bureau: { hasCreditHistory: true, activeLoans: 1, activeDelinquency: false, pastDefaults: 0 },
  currentLoan: {
    loanId: "loan_001",
    principal: 20_000_000,
    outstandingBalance: 8_000_000,
    riskBandAtOrigination: "B",
    instalmentsTotal: 6,
    instalmentsPaid: 4,
    instalmentsPaidOnTime: 4,
    daysPastDue: 0,
  },
});

export const collectionsLoan = (): z.input<typeof CollectionsLoan> => ({
  loanId: "loan_001",
  customerId: "cus_001",
  asOf: "2026-10-22",
  product: "cash",
  riskBandAtOrigination: "B",
  principal: 20_000_000,
  outstandingBalance: 12_000_000,
  instalmentAmount: 4_000_000,
  nextDueDate: "2026-10-25",
  instalmentsTotal: 6,
  instalmentsRemaining: 3,
  instalmentsPaid: 3,
  instalmentsPaidOnTime: 2,
  instalmentsMissed: 0,
  daysPastDue: 0,
  promisesMade: 1,
  promisesKept: 1,
  lastPaymentDate: "2026-09-25",
  salaryDayOfMonth: 28,
  salaryInflowStopped: false,
});

export const approvedDecision = (): z.input<typeof OriginationDecision> => ({
  ...meta,
  applicantId: "app_001",
  outcome: "approved",
  amount: 50_000_000,
  tenorMonths: 6,
  monthlyRate: 0.055,
  riskBand: "B",
  reasonCodes: ["STABLE_SALARY"],
});

export const declinedDecision = (): z.input<typeof OriginationDecision> => ({
  ...meta,
  applicantId: "app_001",
  outcome: "declined",
  riskBand: "D",
  reasonCodes: ["ACTIVE_DELINQUENCY_ELSEWHERE"],
});

export const needsMoreInfoDecision = (): z.input<typeof OriginationDecision> => ({
  ...meta,
  applicantId: "app_101",
  outcome: "needs_more_info",
  missingRequirements: ["VERIFIED_BUSINESS_ADDRESS", "DIRECTOR_BVN"],
  reasonCodes: ["KYC_INCOMPLETE"],
});

export const topUpEligible = (): z.input<typeof TopUpDecision> => ({
  ...meta,
  customerId: "cus_001",
  eligible: true,
  maxAmount: 30_000_000,
  reasonCodes: ["GOOD_REPAYMENT_HISTORY"],
});

export const collectionsScore = (): z.input<typeof CollectionsScore> => ({
  ...meta,
  loanId: "loan_001",
  missProbability: 0.3,
  pPayIfContacted: 0.8,
  pPayIfNotContacted: 0.65,
  riskBand: "B",
  recommendedTreatment: "soft_reminder",
  expectedRecovery: 3_200_000,
  reasonCodes: ["DUE_DATE_BEFORE_PAYDAY"],
});

export const restructureDecision = (): z.input<typeof RestructureDecision> => ({
  ...meta,
  loanId: "loan_001",
  options: [
    {
      type: "tenor_extension",
      optionId: "rs_ext_2m",
      extraMonths: 2,
      newInstalmentAmount: 2_400_000,
      requiresHumanApproval: false,
    },
    {
      type: "payment_holiday",
      optionId: "rs_holiday_1m",
      months: 1,
      resumesOn: "2026-12-25",
      requiresHumanApproval: false,
    },
    {
      type: "fee_waiver",
      optionId: "rs_waive_late_fee",
      waiveAmount: 500_000,
      requiresHumanApproval: true,
    },
  ],
});
