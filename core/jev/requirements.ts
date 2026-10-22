import { z } from "zod";

/**
 * Documents or data an application can be missing. JEV returns these in
 * `missingRequirements` so the field agent knows exactly what to collect,
 * instead of a vague "KYC incomplete".
 */
export const REQUIREMENTS = [
  // Cash loans
  "BVN",
  "VALID_GOVERNMENT_ID",
  "SALARY_ACCOUNT_STATEMENT_3M",
  "BVN_LOOKUP_CONSENT",
  // Business loans
  "CAC_CERTIFICATE",
  "CAC_STATUS_REPORT",
  "BUSINESS_BANK_STATEMENT_6M",
  "VERIFIED_BUSINESS_ADDRESS",
  "DIRECTOR_DETAILS",
  "DIRECTOR_BVN",
] as const;

export const Requirement = z.enum(REQUIREMENTS);
export type Requirement = z.infer<typeof Requirement>;

export type RequirementInfo = {
  description: string;
  /** Instruction for the field agent. */
  howToFix: string;
};

export const REQUIREMENT_INFO: Record<Requirement, RequirementInfo> = {
  BVN: {
    description: "Bank Verification Number.",
    howToFix: "Collect the customer's 11-digit BVN.",
  },
  VALID_GOVERNMENT_ID: {
    description: "Valid government-issued ID (NIN slip, voter's card, driver's licence or passport).",
    howToFix: "Photograph a valid, unexpired ID; all four corners visible.",
  },
  SALARY_ACCOUNT_STATEMENT_3M: {
    description: "Last 3 months' statement of the account salary is paid into.",
    howToFix: "Request a 3-month statement (CSV or PDF) for the salary account.",
  },
  BVN_LOOKUP_CONSENT: {
    description: "Recorded customer consent to look up their BVN and credit data.",
    howToFix: "Have the customer accept the data consent screen before submitting.",
  },
  CAC_CERTIFICATE: {
    description: "CAC certificate of registration.",
    howToFix: "Upload the CAC certificate; check the name matches the application exactly.",
  },
  CAC_STATUS_REPORT: {
    description: "CAC status report listing current directors/proprietors.",
    howToFix: "Obtain a recent status report from the CAC portal.",
  },
  BUSINESS_BANK_STATEMENT_6M: {
    description: "Last 6 consecutive months of the business account statement.",
    howToFix: "Request a full 6-month statement; check no months are missing.",
  },
  VERIFIED_BUSINESS_ADDRESS: {
    description: "Business address with valid state and LGA, confirmed by a visit or utility bill.",
    howToFix: "Record the full address with state and LGA and attach a utility bill or visit report.",
  },
  DIRECTOR_DETAILS: {
    description: "Full names and contact details of all directors.",
    howToFix: "Add every director listed on the CAC status report.",
  },
  DIRECTOR_BVN: {
    description: "BVN for each director.",
    howToFix: "Collect the BVN of every director.",
  },
};
