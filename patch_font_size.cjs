const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = '<div className="text-5xl text-white font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase" style={{fontFamily: "\'Fredoka\', sans-serif"}}>';
const replacement = '<div className="text-4xl sm:text-5xl text-white font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase" style={{fontFamily: "\'Fredoka\', sans-serif"}}>';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
