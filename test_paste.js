const parsePastedQuiz = (rawText) => {
  if (!rawText || !rawText.trim()) return [];
  const items = [];
  
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length > 0) {
        items.push({
          text: parts[0],
          options: [
            parts[1] || "",
            parts[2] || "",
            parts[3] || "",
            parts[4] || ""
          ],
          answerIndex: 0
        });
      }
    });
    if (items.length > 0) {
      items.forEach(q => {
         if (q.options) {
            while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
                q.options.pop();
            }
         }
      });
      return items;
    }
  }
}

const pasted = `1. You ____ feed the fish every day.\tmust\tmustn't
2. You ____ put the fish on the floor.\tmust\tmustn't`;
console.log(JSON.stringify(parsePastedQuiz(pasted), null, 2));
