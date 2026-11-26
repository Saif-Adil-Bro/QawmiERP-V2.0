export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.DISABLE_IN_APP_SCHEDULER !== "true" &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    !process.env.VERCEL && !process.env.NETLIFY &&
    (!process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT_NAME === "production") &&
    !process.env.RAILWAY_PR_NUMBER &&
    process.env.CAPACITOR_STATIC_BUILD !== "true"
  ) {
    const { startInAppAutomationScheduler } = await import(
      "@/lib/automation/in-app-scheduler"
    );
    startInAppAutomationScheduler();
  }
}
