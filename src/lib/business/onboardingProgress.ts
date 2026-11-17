/** Where to resume onboarding from the furthest step completed. */
export function onboardingPath(stepDone: number | null | undefined): string {
  switch (stepDone ?? 0) {
    case 0: return "/onboarding/business";
    case 1: return "/onboarding/questions";
    case 2: return "/onboarding/google";
    case 3: return "/onboarding/search-console";
    default: return "/dashboard";
  }
}
