const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = 'const playerImage = `https://api.dicebear.com/7.x/notionists/svg?seed=${name}`;';

const replacement = `                                const canvas = document.createElement('canvas');
                                canvas.width = 256; canvas.height = 256;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    ctx.fillStyle = '#2d6a4f';
                                    ctx.fillRect(0, 0, 256, 256);
                                    ctx.fillStyle = '#ffffff';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.font = 'bold 80px Arial';
                                    ctx.fillText(playerNum, 128, 128);
                                }
                                const playerImage = canvas.toDataURL();`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
