import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const targetPath = path.join(
  projectRoot,
  'node_modules',
  'expo-constants',
  'scripts',
  'get-app-config-ios.sh'
);

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

const original = fs.readFileSync(targetPath, 'utf8');
const search = 'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"\n';
const replacement =
  'if [ "$BUNDLE_FORMAT" == "shallow" ]; then\n' +
  '  RESOURCE_DEST="$DEST/$RESOURCE_BUNDLE_NAME"\n' +
  '  mkdir -p "$RESOURCE_DEST"\n';

if (original.includes(replacement)) {
  process.exit(0);
}

if (!original.includes(search)) {
  console.warn('[patch-expo-constants-ios] Expected script block not found.');
  process.exit(0);
}

fs.writeFileSync(targetPath, original.replace(search, replacement));
console.log('[patch-expo-constants-ios] Patched expo-constants iOS app-config script.');
