import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');
content = content.replace(
  'import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon } from "lucide-react";',
  'import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, Info, ClipboardList, Copy } from "lucide-react";'
);
fs.writeFileSync('src/views/Sumo.tsx', content);
