// Retired: the old all-schools upsert used global IDs and separate writes for
// bills, payments and allocations. Do not even load deployment credentials.
console.error('Fee import is disabled. Use preflight:finance on an authorized staging clone and reconcile historical rows. See docs/finance-integrity-rollout.bn.md.');
process.exitCode = 1;
