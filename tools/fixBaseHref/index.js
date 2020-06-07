const lodash = require('lodash');
const fs = require('fs');
const workspace = require(process.cwd() + '/workspace.json');
const [ ,, trigger = "0"] = process.argv;

//console.log(process.cwd())
const baseHref = lodash.get(workspace, 'projects.frontend.architect.build.options.baseHref');
if (trigger == 0) {
  if (baseHref === "/") process.exit(0)
  const result = lodash.set(workspace, 'projects.frontend.architect.build.options.baseHref', "/")
  fs.writeFile('./workspace.json', JSON.stringify(result,  null, 2), () => {});
} else if (trigger == 1) {
  if (baseHref === "./") process.exit(0)
  const result = lodash.set(workspace, 'projects.frontend.architect.build.options.baseHref', "./")
  fs.writeFile('./workspace.json', JSON.stringify(result,  null, 2), () => {});
}