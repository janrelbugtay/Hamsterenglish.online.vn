const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = '<div className="w-24 h-24 shrink-0 rounded-xl bg-slate-800 border-2 border-rose-500 overflow-hidden flex items-center justify-center">';

const replacement = '<div className={`w-24 h-24 shrink-0 rounded-xl bg-slate-800 border-2 overflow-hidden flex items-center justify-center ${gameMode === "picker" ? "border-rose-500" : "border-emerald-500"}`}>';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
