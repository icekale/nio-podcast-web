// 从 data/albums.json 生成 data/albums.js。
// 微信小程序编译器不会把 .json 打包为 require 模块，必须提供 JS 模块。
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const json = JSON.parse(fs.readFileSync(path.join(root, 'data', 'albums.json'), 'utf8'));
fs.writeFileSync(
  path.join(root, 'data', 'albums.js'),
  `// 由 scripts/gen-albums-js.js 从 data/albums.json 生成，请勿手工修改。\nmodule.exports = ${JSON.stringify(json)};\n`,
);
console.log('data/albums.js generated:', json.albums.length, 'albums');
