const fs = require('fs');
const path = require('path');

const shimPaths = [
  path.join(__dirname, '..', 'node_modules', 'tsconfig.packages.base.json'),
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-firebase',
    'tsconfig.packages.base.json',
  ),
];
const firebaseTsconfigs = [
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-firebase',
    'app',
    'tsconfig.json',
  ),
  path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-firebase',
    'messaging',
    'tsconfig.json',
  ),
];

const shim = {
  extends: '@react-native/typescript-config/tsconfig.json',
};

function ensureShim() {
  for (const shimPath of shimPaths) {
    const dir = path.dirname(shimPath);
    if (!fs.existsSync(dir)) {
      continue;
    }

    try {
      fs.writeFileSync(shimPath, `${JSON.stringify(shim, null, 2)}\n`, 'utf8');
      console.log(
        `[postinstall] ensured ${path.relative(
          path.join(__dirname, '..'),
          shimPath,
        )}`,
      );
    } catch (error) {
      console.warn('[postinstall] unable to create tsconfig shim', error);
    }
  }
}

function patchFirebaseExtends() {
  for (const tsconfigPath of firebaseTsconfigs) {
    if (!fs.existsSync(tsconfigPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(tsconfigPath, 'utf8');
      const next = content.replace(
        '"extends": "../../tsconfig.packages.base.json"',
        '"extends": "../../@react-native/typescript-config/tsconfig.json"',
      );

      if (next !== content) {
        fs.writeFileSync(tsconfigPath, next, 'utf8');
        console.log(
          `[postinstall] patched ${path.relative(
            path.join(__dirname, '..'),
            tsconfigPath,
          )}`,
        );
      }
    } catch (error) {
      console.warn(`[postinstall] unable to patch ${tsconfigPath}`, error);
    }
  }
}

ensureShim();
patchFirebaseExtends();
