const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

// 1. Put face on -Z
content = content.replace(/eyeL\.position\.set\(-0\.25, 0\.1, 0\.61\);/g, 'eyeL.position.set(-0.25, 0.1, -0.61);');
content = content.replace(/eyeR\.position\.set\(0\.25, 0\.1, 0\.61\);/g, 'eyeR.position.set(0.25, 0.1, -0.61);');
content = content.replace(/nose\.position\.set\(0, -0\.1, 0\.62\);/g, 'nose.position.set(0, -0.1, -0.62);');
content = content.replace(/mouth\.position\.set\(0, -0\.3, 0\.61\);/g, 'mouth.position.set(0, -0.3, -0.61);');

// 2. Put Torso texture on -Z (front). matTorso was at index 4 (front/+Z). 
// BoxGeometry materials: 0:right(+X), 1:left(-X), 2:top(+Y), 3:bottom(-Y), 4:front(+Z), 5:back(-Z).
// We want the number to be on -Z. So index 5.
content = content.replace(/matUniform, matUniform, matUniform, matUniform, matTorso, matUniform/g, 'matUniform, matUniform, matUniform, matUniform, matUniform, matTorso');

// 3. Set Crawl, Fall, Eliminate pitch to POSITIVE (pitches them forward towards -Z, putting -Z facing down)
// Actually wait. Let's trace +X rotation.
// +X rotation rotates +Y to +Z, +Z to -Y, -Y to -Z, -Z to +Y.
// Wait! Right hand rule for X axis:
// Point thumb in +X (Right).
// Fingers point +Y (Up).
// Curl fingers: they go towards +Z (Back).
// So +Y goes to +Z.
// +Z goes to -Y.
// -Y goes to -Z.
// -Z goes to +Y.
// So if the face is on -Z, and we do positive X rotation, -Z (face) goes to +Y (UP).
// So they would be crawling on their backs (face up)!
// We want them to crawl face DOWN. So -Z must go to -Y.
// Which means we need NEGATIVE X rotation!
// Let's re-verify: thumb to +X, -Y is down, -Z is forward. 
// If we rotate negatively (thumb to -X, which is left), fingers point +Y, curl towards -Z.
// So +Y goes to -Z.
// -Z goes to -Y (DOWN)!
// YES! Negative X rotation pitches the character forward (face down)!
// Let's make sure it's set to -Math.PI / 2.5
content = content.replace(/x: Math\.PI \/ 2\.5/g, 'x: -Math.PI / 2.5');
content = content.replace(/x: Math\.PI \/ 2\.2/g, 'x: -Math.PI / 2.2');
content = content.replace(/x: Math\.PI \/ 2,/g, 'x: -Math.PI / 2,');

fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
console.log("Success fix all");
