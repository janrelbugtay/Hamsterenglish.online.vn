const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

content = content.replace(/eyeL\.position\.set\(-0\.25, 0\.1, 0\.61\);/g, 'eyeL.position.set(-0.25, 0.1, -0.61);');
content = content.replace(/eyeR\.position\.set\(0\.25, 0\.1, 0\.61\);/g, 'eyeR.position.set(0.25, 0.1, -0.61);');
content = content.replace(/nose\.position\.set\(0, -0\.1, 0\.62\);/g, 'nose.position.set(0, -0.1, -0.62);');
content = content.replace(/mouth\.position\.set\(0, -0\.3, 0\.61\);/g, 'mouth.position.set(0, -0.3, -0.61);');

content = content.replace(/char\.lookAt\(finalPos\); char\.rotateY\(Math\.PI\);/g, 'char.lookAt(finalPos);');

// Revert the X rotation for crawl to pitch forward (face down)
// If face is on -Z, and we want them to pitch forward (face down, +Y goes to -Z)
// Right hand rule on +X (right): +Y (up) rotates towards -Z (front).
// Wait, thumb right (+X). Fingers point up (+Y). Curling them forward goes to -Z.
// So positive X rotation pitches FORWARD (face down).
content = content.replace(/tl\.to\(char\.rotation, \{ x: -Math\.PI \/ 2\.5/g, 'tl.to(char.rotation, { x: Math.PI / 2.5');

// Wait, last time I changed it to Math.PI / 2.5. Let's make sure it's Math.PI / 2.5
// Actually, earlier I did: sed -i 's/x: -Math.PI \/ 2.5/x: Math.PI \/ 2.5/g'
// Let's ensure it's Math.PI / 2.5
// If X rotation is Math.PI / 2.5, they pitch forward.

fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
