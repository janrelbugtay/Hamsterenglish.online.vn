const fs = require('fs');
const content = fs.readFileSync('src/views/Home.tsx', 'utf8');

const newGame = `
    {
      id: "squid-game-picker",
      title: "Squid Game Picker",
      description: "Pick students randomly or play a survival game using a Squid Game theme.",
      difficulty: "Medium",
      players: "Classroom",
      time: "5m",
      subject: "Classroom Management",
      grade: "All",
      imageUrl: "https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1000&auto=format&fit=crop",
      isAI: false,
      color: "from-rose-600 to-rose-400",
      icon: "🦑",
    },
    {
      id: "tic-tac-toe",`;

const updated = content.replace(/\{\s*id:\s*"tic-tac-toe",/g, newGame);
fs.writeFileSync('src/views/Home.tsx', updated);
