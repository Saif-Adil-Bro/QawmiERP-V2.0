const fs = require('fs');

function fixKeysInFile(path) {
  if (!fs.existsSync(path)) return;
  let code = fs.readFileSync(path, 'utf8');
  // Just a simple check, this is not a full parser
  // This warning is usually not breaking the build, but it's annoying
}
