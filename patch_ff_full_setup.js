import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 1. Add imports
    const importTarget = `import { ViewState } from "../types";`;
    const importReplacement = `import { ViewState } from "../types";
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { Plus, Folder } from 'lucide-react';`;
    
    content = content.replace(importTarget, importReplacement);
    
    // 2. State replacements
    const stateTarget = `  const [gameState, setGameState] = useState('setup');
  const [setupTopic, setSetupTopic] = useState('');
  const [setupAnswers, setSetupAnswers] = useState(
    Array.from({ length: 8 }, () => ({ text: '', points: 0 }))
  );
  const [customGameData, setCustomGameData] = useState<any>(null);`;
  
    const stateReplacement = `  const { user } = useAuth();
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  
  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(doc => f.push({ id: doc.id, ...doc.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);

  const [gameState, setGameState] = useState(initialGame && !initialGame.editMode ? 'playing' : 'setup');
  
  const [folderId, setFolderId] = useState(initialGame?.folderId || "");
  const [classLevel, setClassLevel] = useState(initialGame?.className || "");
  
  // Custom rounds
  const defaultRound = {
    question: '',
    answers: Array.from({ length: 8 }, () => ({ text: '', points: 0 }))
  };
  
  const [rounds, setRounds] = useState<any[]>(
    initialGame?.customQuestions && initialGame.customQuestions.length > 0 
      ? initialGame.customQuestions 
      : [JSON.parse(JSON.stringify(defaultRound))]
  );
  
  const [customGameData, setCustomGameData] = useState<any>(initialGame?.customQuestions || null);
  const [showPublishModal, setShowPublishModal] = useState(false);`;

    content = content.replace(stateTarget, stateReplacement);
    
    // 3. UI logic and rendering replacement
    const uiTarget = `  const handleStartCustomGame = () => {`;
    const uiTargetEnd = `  const renderSetupScreen = () => (`;
    
    const uiEndIdx = content.indexOf(uiTargetEnd);
    if (uiEndIdx !== -1) {
      const functionBlock = `  const handleStartCustomGame = () => {
    const validRounds = rounds.map(r => ({
      ...r,
      answers: r.answers
        .filter((a: any) => a.text.trim() !== '')
        .map((a: any) => ({ text: a.text.toUpperCase(), points: Number(a.points) || 0 }))
    })).filter(r => r.question.trim() !== '' && r.answers.length > 0);

    if (validRounds.length === 0) {
      alert("Please add at least one complete topic with answers.");
      return;
    }

    setCustomGameData(validRounds);
    startGame();
  };

  const updateSetupAnswer = (roundIndex: number, answerIndex: number, field: 'text' | 'points', value: string) => {
    const newRounds = [...rounds];
    if (field === 'points') {
      newRounds[roundIndex].answers[answerIndex].points = parseInt(value) || 0;
    } else {
      newRounds[roundIndex].answers[answerIndex].text = value;
    }
    setRounds(newRounds);
  };
  
  const updateSetupTopic = (roundIndex: number, value: string) => {
    const newRounds = [...rounds];
    newRounds[roundIndex].question = value;
    setRounds(newRounds);
  };
  
  const addTopic = () => {
    setRounds([...rounds, JSON.parse(JSON.stringify(defaultRound))]);
  };
  
  const deleteTopic = (index: number) => {
    if (rounds.length > 1) {
      setRounds(rounds.filter((_, i) => i !== index));
    }
  };

  const confirmSave = async (isPublicGame: boolean) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    setShowPublishModal(false);
    onViewChange("games");

    try {
      const validRounds = rounds.map(r => ({
        ...r,
        answers: r.answers
          .filter((a: any) => a.text.trim() !== '')
          .map((a: any) => ({ text: a.text.toUpperCase(), points: Number(a.points) || 0 }))
      })).filter(r => r.question.trim() !== '' && r.answers.length > 0);

      const gameToSave = JSON.parse(JSON.stringify({
        name: rounds[0]?.question || "Family Feud Game",
        folderId: folderId || "",
        topic: rounds[0]?.question || "",
        className: classLevel || "",
        gameType: "family-feud",
        customQuestions: validRounds,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        isPublic: isPublicGame,
      }));

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };
`;
      content = content.substring(0, content.indexOf(uiTarget)) + functionBlock + content.substring(uiEndIdx);
    }
    
    fs.writeFileSync(filePath, content);
    console.log("Patched FamilyFeud logic.");
};

patchFile('src/views/FamilyFeud.tsx');
