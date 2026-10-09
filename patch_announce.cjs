const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

content = content.replace(
`    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            speak();
        };
    } else {
        speak();
    }`,
`    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speak();
        };
    } else {
        speak();
    }`
);

fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
