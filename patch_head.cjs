const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = `        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), matSkin);
        head.position.y = 2.6; head.castShadow = true; group.add(head);`;

const replacement = `        const headGroup = new THREE.Group();
        headGroup.position.y = 2.6;
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), matSkin);
        head.castShadow = true;
        headGroup.add(head);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), eyeMat);
        eyeL.position.set(-0.25, 0.1, 0.61);
        const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), eyeMat);
        eyeR.position.set(0.25, 0.1, 0.61);
        headGroup.add(eyeL, eyeR);

        const noseTone = skinTone.clone().multiplyScalar(0.9);
        const noseMat = new THREE.MeshStandardMaterial({ color: noseTone, roughness: 0.8 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), noseMat);
        nose.position.set(0, -0.1, 0.62);
        headGroup.add(nose);

        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x221111 });
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.1), mouthMat);
        mouth.position.set(0, -0.3, 0.61);
        headGroup.add(mouth);

        group.add(headGroup);`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
