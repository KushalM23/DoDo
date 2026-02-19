const path = require('path');

const monorepoRoot = path.resolve(__dirname, '..');

module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  dependencies: {
    'react-native-config': {
      root: path.join(monorepoRoot, 'node_modules', 'react-native-config'),
    },
    '@react-native-async-storage/async-storage': {
      root: path.join(monorepoRoot, 'node_modules', '@react-native-async-storage', 'async-storage'),
    },
    'react-native-safe-area-context': {
      root: path.join(monorepoRoot, 'node_modules', 'react-native-safe-area-context'),
    },
    'react-native-screens': {
      root: path.join(monorepoRoot, 'node_modules', 'react-native-screens'),
    },
  },
};
