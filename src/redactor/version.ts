export const ENGINE_VERSION = "1.5.25";

export const ENGINE_VERSION_DATE = "2026-06-21";

export const GENERAL_RULES_VERSION = 20;

export const CHINESE_RULES_VERSION = 10;

export const ENGINE_VERSION_LABEL = `NoAI redaction engine ${ENGINE_VERSION} (general r${GENERAL_RULES_VERSION}, chinese r${CHINESE_RULES_VERSION})`;

export const ENGINE_VERSION_INFO = {
  engine: ENGINE_VERSION,
  label: ENGINE_VERSION_LABEL,
  rulesets: {
    general: GENERAL_RULES_VERSION,
    chinese: CHINESE_RULES_VERSION,
  },
} as const;
