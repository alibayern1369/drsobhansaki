export const PATIENT_TEST_CODE = "123456";

export function resolvePatientTestMode(
  setting: unknown,
  smsConfigured: boolean,
) {
  if (setting === undefined) return !smsConfigured;
  return (
    !!setting &&
    typeof setting === "object" &&
    "enabled" in setting &&
    setting.enabled === true
  );
}

// Bind challenges to their mode so switching modes invalidates outstanding codes.
export function patientChallengeValue(code: string, testMode: boolean) {
  return testMode ? `patient-test:${code}` : code;
}

export function patientTestAccountAllowed(
  user?: { role: string; disabled: boolean } | null,
) {
  return !user || (user.role === "patient" && !user.disabled);
}
