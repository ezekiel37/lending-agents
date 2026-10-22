import { z } from "zod";

/**
 * Every reason JEV can give for a decision. JEV may only return these codes:
 * never free text. That makes decisions auditable, countable ("how many
 * declines were for affordability last month?") and explainable without an
 * LLM making something up.
 */
export const REASON_CODES = [
  // Affordability
  "INCOME_BELOW_MINIMUM",
  "REPAYMENT_TOO_HIGH_FOR_INCOME",
  "AMOUNT_REDUCED_TO_AFFORDABLE",
  "INCOME_IRREGULAR",
  "SALARY_NOT_DETECTED",
  "FREQUENT_ZERO_BALANCE",
  // Identity and KYC
  "BVN_NOT_VERIFIED",
  "BVN_NAME_MISMATCH",
  "KYC_INCOMPLETE",
  // Credit history
  "ACTIVE_DELINQUENCY_ELSEWHERE",
  "PAST_DEFAULT_ON_RECORD",
  "THIN_CREDIT_FILE",
  "GOOD_REPAYMENT_HISTORY",
  "STABLE_SALARY",
  // Business (SME)
  "BUSINESS_TOO_YOUNG",
  "CAC_NAME_MISMATCH",
  "BUSINESS_REVENUE_TOO_LOW",
  // Top-up
  "TOPUP_TOO_FEW_ONTIME_PAYMENTS",
  "TOPUP_CURRENT_LOAN_OVERDUE",
  // Collections
  "RECENT_MISSED_PAYMENT",
  "BROKEN_PROMISE_TO_PAY",
  "DUE_DATE_BEFORE_PAYDAY",
  "SALARY_INFLOW_STOPPED",
  "FIRST_INSTALMENT",
  "CONSISTENT_ONTIME_PAYER",
] as const;

export const ReasonCode = z.enum(REASON_CODES);
export type ReasonCode = z.infer<typeof ReasonCode>;

export type ReasonCodeInfo = {
  /** Internal meaning, for staff and the audit log. */
  description: string;
  /**
   * Plain-English "what would change this decision", safe to show a customer
   * or field agent. Empty for positive codes, since there is nothing to change.
   */
  whatWouldChange: string;
};

/**
 * `Record<ReasonCode, ...>` forces a description for every code: add a code
 * above without describing it here and TypeScript refuses to compile.
 */
export const REASON_CODE_INFO: Record<ReasonCode, ReasonCodeInfo> = {
  INCOME_BELOW_MINIMUM: {
    description: "Verified monthly income is below the product minimum.",
    whatWouldChange: "A higher verified monthly income, shown on your bank statement.",
  },
  REPAYMENT_TOO_HIGH_FOR_INCOME: {
    description: "Monthly repayment would exceed the allowed share of income.",
    whatWouldChange: "Asking for a smaller amount or a longer tenor, or clearing other loans first.",
  },
  AMOUNT_REDUCED_TO_AFFORDABLE: {
    description: "Approved amount is lower than requested so repayments stay affordable.",
    whatWouldChange: "A higher verified income or fewer existing loan repayments.",
  },
  INCOME_IRREGULAR: {
    description: "Inflows vary too much month to month to rely on.",
    whatWouldChange: "Three or more months of regular inflows into this account.",
  },
  SALARY_NOT_DETECTED: {
    description: "No regular salary credit found in the statement.",
    whatWouldChange: "Providing the statement of the account your salary is paid into.",
  },
  FREQUENT_ZERO_BALANCE: {
    description: "Account is often at or near zero balance.",
    whatWouldChange: "Keeping a positive balance in the account for the next few months.",
  },
  BVN_NOT_VERIFIED: {
    description: "BVN could not be verified.",
    whatWouldChange: "Re-entering your BVN exactly as registered with your bank.",
  },
  BVN_NAME_MISMATCH: {
    description: "Name on the application does not match the name on the BVN record.",
    whatWouldChange: "Using your name exactly as it appears on your BVN record.",
  },
  KYC_INCOMPLETE: {
    description: "Required KYC documents or fields are missing.",
    whatWouldChange: "Submitting the missing documents listed in your application.",
  },
  ACTIVE_DELINQUENCY_ELSEWHERE: {
    description: "Applicant is currently overdue on a loan with another lender.",
    whatWouldChange: "Bringing your other loan(s) up to date.",
  },
  PAST_DEFAULT_ON_RECORD: {
    description: "Credit bureau shows a past default.",
    whatWouldChange: "A period of on-time repayments since the default.",
  },
  THIN_CREDIT_FILE: {
    description: "Too little credit history to assess; affects limits rather than eligibility.",
    whatWouldChange: "Repaying a smaller first loan on time to build history with us.",
  },
  GOOD_REPAYMENT_HISTORY: {
    description: "Strong record of on-time repayments.",
    whatWouldChange: "",
  },
  STABLE_SALARY: {
    description: "Regular salary credits detected on a consistent day of the month.",
    whatWouldChange: "",
  },
  BUSINESS_TOO_YOUNG: {
    description: "Business has operated for less than the product minimum.",
    whatWouldChange: "Applying again once the business meets the minimum trading period.",
  },
  CAC_NAME_MISMATCH: {
    description: "Registered CAC name does not match the business name on the application.",
    whatWouldChange: "Using the business name exactly as registered with CAC.",
  },
  BUSINESS_REVENUE_TOO_LOW: {
    description: "Business account inflows are too low for the requested amount.",
    whatWouldChange: "A smaller amount, or statements showing higher monthly revenue.",
  },
  TOPUP_TOO_FEW_ONTIME_PAYMENTS: {
    description: "Not enough on-time instalments on the current loan to qualify for a top-up.",
    whatWouldChange: "Making more on-time payments on your current loan.",
  },
  TOPUP_CURRENT_LOAN_OVERDUE: {
    description: "Current loan is overdue, so no top-up is possible.",
    whatWouldChange: "Bringing your current loan up to date.",
  },
  RECENT_MISSED_PAYMENT: {
    description: "Borrower missed or paid late on a recent instalment.",
    whatWouldChange: "",
  },
  BROKEN_PROMISE_TO_PAY: {
    description: "Borrower has broken at least one promise to pay.",
    whatWouldChange: "",
  },
  DUE_DATE_BEFORE_PAYDAY: {
    description: "Instalment falls due before the borrower's detected payday.",
    whatWouldChange: "",
  },
  SALARY_INFLOW_STOPPED: {
    description: "Expected salary credit has not arrived; possible job loss.",
    whatWouldChange: "",
  },
  FIRST_INSTALMENT: {
    description: "Upcoming payment is the borrower's first; no repayment history yet.",
    whatWouldChange: "",
  },
  CONSISTENT_ONTIME_PAYER: {
    description: "Borrower has paid every instalment on time.",
    whatWouldChange: "",
  },
};
