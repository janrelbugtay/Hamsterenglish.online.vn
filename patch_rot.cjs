const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

content = content.replace(/x: -Math\.PI \/ 2\.5/g, 'x: Math.PI / 2.5');
content = content.replace(/x: -Math\.PI \/ 2\.2/g, 'x: Math.PI / 2.2');
content = content.replace(/x: -Math\.PI \/ 2,/g, 'x: Math.PI / 2,');

fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
console.log("Success rot");
