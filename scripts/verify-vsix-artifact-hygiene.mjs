import { collectVsixArtifactHygieneViolations } from './vsix-artifact-hygiene.mjs';

try {
  const violations = collectVsixArtifactHygieneViolations();
  if (violations.length > 0) {
    console.error('VSIX artifact hygiene verification failed:');
    for (const violation of violations) console.error(violation);
    process.exit(1);
  }

  console.log('VSIX artifact hygiene verification passed.');
} catch (error) {
  console.error('VSIX artifact hygiene verification failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
