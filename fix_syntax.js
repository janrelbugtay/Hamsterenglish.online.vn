import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Find where I put the Toast block
    const errorBlockStart = `      {/* Toast */}`;
    const modalEnd = `      )}
  );`;
    
    // Wait, the previous replacement did:
    // content.substring(0, lastParenIdx) + bulkPasteModal + '\n' + content.substring(lastParenIdx);
    // lastParenIdx was where `  );` is, which closes the `renderSetupScreen = () => (...)`
    // And what does the end of renderSetupScreen look like before that?
    // It's `</div>` followed by `  );`
    // So by inserting the modal code before `  );`, I inserted it right after the outermost `</div>`.
    // In JSX, you can't have `<div>...</div> {modal}` returning multiple root elements.
    // Let's fix this by wrapping the whole return in Fragments: `<> ... </>`
    
    content = content.replace(
      `<div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col items-center overflow-y-auto w-full">`,
      `<>\n    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col items-center overflow-y-auto w-full">`
    );
    
    // Since we added the modal right before `  );`, we just need to add `</>` right before `  );`
    content = content.replace(
      `      )}\n  );`,
      `      )}\n    </>\n  );`
    );
    
    fs.writeFileSync(filePath, content);
};
patchFile('src/views/FamilyFeud.tsx');
