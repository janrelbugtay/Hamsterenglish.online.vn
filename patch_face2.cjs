const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

content = content.replace(/eyeL\.position\.set\(-0\.25, 0\.1, -0\.61\);/g, 'eyeL.position.set(-0.25, 0.1, 0.61);');
content = content.replace(/eyeR\.position\.set\(0\.25, 0\.1, -0\.61\);/g, 'eyeR.position.set(0.25, 0.1, 0.61);');
content = content.replace(/nose\.position\.set\(0, -0\.1, -0\.62\);/g, 'nose.position.set(0, -0.1, 0.62);');
content = content.replace(/mouth\.position\.set\(0, -0\.3, -0\.61\);/g, 'mouth.position.set(0, -0.3, 0.61);');

fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
console.log("Success face");
