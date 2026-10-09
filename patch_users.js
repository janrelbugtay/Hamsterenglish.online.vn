import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace the specific lines
    const target1 = `  const registeredUsersList = users.filter((u: any) => u.isAnonymous !== true && u.email !== "User");`;
    const replacement1 = `  const registeredUsersList = users.filter((u: any) => u.isAnonymous !== true && u.email && u.email !== "User");`;
    
    const target2 = `  const guestUsersList = users.filter((u: any) => u.isAnonymous === true || u.email === "User");`;
    const replacement2 = `  const guestUsersList = users.filter((u: any) => u.isAnonymous === true || !u.email || u.email === "User");`;

    if (content.includes(target1)) {
        content = content.replace(target1, replacement1);
        content = content.replace(target2, replacement2);
        fs.writeFileSync(filePath, content);
        console.log(`Patched users filter in ${filePath}`);
    } else {
        console.log(`Could not find target in ${filePath}`);
    }
};

patchFile('src/views/AdminDashboard.tsx');
