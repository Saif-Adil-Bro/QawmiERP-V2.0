export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.DISABLE_IN_APP_SCHEDULER !== "true" &&
    process.env.NODE_ENV !== "test" &&
    process.env.CAPACITOR_STATIC_BUILD !== "true"
  ) {
    const { startInAppAutomationScheduler } = await import(
      "@/lib/automation/in-app-scheduler"
    );
    startInAppAutomationScheduler();
  }
}
