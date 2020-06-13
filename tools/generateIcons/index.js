const fs = require('fs');
const path = require('path');
const svgson = require('svgson');

const [ ,, searchPath = __dirname] = process.argv;

const iconPath = path.join(__dirname, path.relative(__dirname, searchPath));
const files = fs.readdirSync(iconPath).filter(f => f.match(/\.svg?/ig))

let exp = ""
for (let icon of files) {
  const iconData = svgson.parseSync(fs.readFileSync(path.join(iconPath, icon)).toString())
  const data = `export const ${icon.replace(".svg","")} = {
  width: ${iconData.attributes.width},
  height: ${iconData.attributes.height},
  data: ${JSON.stringify(iconData).replace(/white/igm,"currentColor")}
}`
  exp += `export * from "./${icon.replace(".svg", "")}";\r\n`
  fs.writeFileSync(path.join(iconPath, icon).replace(".svg", ".ts"), data);
}

fs.writeFileSync(path.join(iconPath, "index.ts"), exp);