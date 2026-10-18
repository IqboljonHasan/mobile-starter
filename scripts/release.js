const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

execSync('npx expo prebuild --platform android', { cwd: root, stdio: 'inherit' });
execSync(`"${gradlew}" assembleRelease`, { cwd: androidDir, stdio: 'inherit' });
