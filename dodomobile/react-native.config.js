const path = require('path');

const monorepoRoot = path.resolve(__dirname, '..');
const rootDependency = packageName => ({
  root: path.join(monorepoRoot, 'node_modules', ...packageName.split('/')),
});

module.exports = {
  assets: ['./assets/fonts'],
  project: {
    android: {
      sourceDir: './android',
    },
  },
  dependencies: {
    'react-native-config': rootDependency('react-native-config'),
    '@react-native-async-storage/async-storage': rootDependency('@react-native-async-storage/async-storage'),
    'react-native-safe-area-context': rootDependency('react-native-safe-area-context'),
    'react-native-screens': rootDependency('react-native-screens'),
    'react-native-quick-sqlite': rootDependency('react-native-quick-sqlite'),
    '@react-native-vector-icons/lucide': rootDependency('@react-native-vector-icons/lucide'),
    '@react-native-vector-icons/common': rootDependency('@react-native-vector-icons/common'),
  },
};
