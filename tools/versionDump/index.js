const { execSync } = require('child_process');

const fs = require('fs');

const package = require(process.cwd() + '/package.json');
const target = process.cwd() + '/version.json';

const { version } = package;
const hash = execSync('git rev-parse HEAD').toString().trim();

const obj = {
  version,
  hash
}

fs.writeFileSync(target, JSON.stringify(obj,  null, 2));