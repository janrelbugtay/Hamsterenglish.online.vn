import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import multer from "multer";

const getAiClient = () => new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "missing-api-key",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});
const ai = getAiClient();

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Persistent Server-Side Platform Cache (Games, Registered Users, Activities, Page Visits, Homework)
  const PLATFORM_CACHE_FILE = path.resolve("./.platform-cache.json");
  let memoryCache: any = null;
  let writeQueue: Promise<void> = Promise.resolve();

  const HULA_DANCING_QUESTIONS = [
    { id: "hula-1", text: "The dancers moved gracefully to the drums that were played to ______ their traditional Hula dance.", options: ["discourage", "accompany", "evoke", "preserve"], answerIndex: 1 },
    { id: "hula-2", text: "Traditional Hula dancing is an ancient Hawaiian art form that ______ stories of nature and history.", options: ["tells", "forgets", "hides", "avoids"], answerIndex: 0 },
    { id: "hula-3", text: "Each hand movement in Hula is carefully practiced to ______ a specific meaning such as waves, wind, or trees.", options: ["ignore", "represent", "confuse", "destroy"], answerIndex: 1 },
    { id: "hula-4", text: "In ancient Hawaii, Hula was performed to honor gods, chiefs, and special ______.", options: ["occasions", "mistakes", "machines", "traffic"], answerIndex: 0 },
    { id: "hula-5", text: "Dancers often wear leis made of fresh flowers and green leaves around their necks and ______.", options: ["pockets", "wrists", "shoes", "glasses"], answerIndex: 1 },
    { id: "hula-6", text: "A traditional Hula school is called a 'halau', and the master teacher is known as the ______.", options: ["kumu", "pilot", "referee", "captain"], answerIndex: 0 },
    { id: "hula-7", text: "Before entering the Hula classroom, students chant to ask for permission and show ______.", options: ["anger", "respect", "hurry", "doubt"], answerIndex: 1 },
    { id: "hula-8", text: "There are two main styles of Hula: 'Hula Kahiko' (ancient style) and 'Hula Auana' (______ style).", options: ["modern", "frozen", "silent", "accidental"], answerIndex: 0 },
    { id: "hula-9", text: "Hula Kahiko is performed with dramatic chants and traditional percussion ______ like gourd drums.", options: ["instruments", "vehicles", "computers", "furniture"], answerIndex: 0 },
    { id: "hula-10", text: "Hula Auana developed in the 19th and 20th centuries and uses stringed instruments like the ______.", options: ["ukulele", "trumpet", "saxophone", "bagpipe"], answerIndex: 0 },
    { id: "hula-11", text: "The swaying motion of the hips in Hula imitates the gentle movement of ocean ______.", options: ["waves", "rocks", "buildings", "bridges"], answerIndex: 0 },
    { id: "hula-12", text: "When dancers raise their hands toward the sky, they may be describing the sun, stars, or ______.", options: ["rainbows", "subways", "basements", "tunnels"], answerIndex: 0 },
    { id: "hula-13", text: "To keep a steady rhythm, the teacher beats a double gourd drum called an ______.", options: ["ipu", "violin", "flute", "piano"], answerIndex: 0 },
    { id: "hula-14", text: "During nineteenth-century missionary arrivals, public Hula performances were temporarily ______.", options: ["discouraged", "invented", "broadcast", "automated"], answerIndex: 0 },
    { id: "hula-15", text: "King David Kalakaua helped ______ Hula in the late 1800s so Hawaiian culture would thrive again.", options: ["revive", "erase", "abandon", "forbid"], answerIndex: 0 },
    { id: "hula-16", text: "King Kalakaua was known as the 'Merrie Monarch' because he loved music, dance, and cultural ______.", options: ["celebrations", "arguments", "penalties", "closures"], answerIndex: 0 },
    { id: "hula-17", text: "Every spring in Hilo, Hawaii, the Merrie Monarch Festival ______ the finest Hula groups from around the world.", options: ["gathers", "separates", "cancels", "ignores"], answerIndex: 0 },
    { id: "hula-18", text: "Dancers spend months gathering plants from the forest to ______ their own traditional costumes.", options: ["prepare", "borrow", "discard", "damage"], answerIndex: 0 },
    { id: "hula-19", text: "The 'pa'u' is a traditional skirt worn by Hula dancers, often made from beaten tree bark or ______.", options: ["ti leaves", "plastic bags", "metal wire", "newspaper"], answerIndex: 0 },
    { id: "hula-20", text: "Facial expressions are just as important as hand gestures because they ______ the emotion of the song.", options: ["convey", "conceal", "prevent", "interrupt"], answerIndex: 0 },
    { id: "hula-21", text: "A graceful Hula performance can ______ warm memories of Hawaii's tropical islands.", options: ["evoke", "dismiss", "postpone", "restrict"], answerIndex: 0 },
    { id: "hula-22", text: "Both men and women ______ Hula, learning strength, balance, and storytelling.", options: ["practice", "refuse", "forget", "avoid"], answerIndex: 0 },
    { id: "hula-23", text: "Keeping the knees bent while dancing helps Hula performers glide ______ across the stage.", options: ["smoothly", "noisily", "clumsily", "harshly"], answerIndex: 0 },
    { id: "hula-24", text: "Feathered rattles called 'uli uli' add bright color and crisp ______ to energetic dances.", options: ["sounds", "flavors", "shadows", "scents"], answerIndex: 0 },
    { id: "hula-25", text: "Smooth volcanic pebbles called 'ili ili' are clicked together in the dancer's hands like ______.", options: ["castanets", "umbrellas", "paintbrushes", "mirrors"], answerIndex: 0 },
    { id: "hula-26", text: "Split bamboo sticks called 'pu ili' create a soft rustling sound that reminds listeners of ______ in the trees.", options: ["wind", "thunder", "engines", "sirens"], answerIndex: 0 },
    { id: "hula-27", text: "Before Hawaii had a written language, Hula chants served as a living ______ of family history.", options: ["record", "secret", "obstacle", "mystery"], answerIndex: 0 },
    { id: "hula-28", text: "Dancers must listen ______ to the chant so their movements stay in complete harmony with the group.", options: ["attentively", "carelessly", "rarely", "reluctantly"], answerIndex: 0 },
    { id: "hula-29", text: "After a performance, the flowers from the leis are respectfully returned to ______ rather than thrown in the trash.", options: ["nature", "factories", "traffic", "lockers"], answerIndex: 0 },
    { id: "hula-30", text: "Learning Hula teaches young students patience, discipline, and deep ______ for the environment.", options: ["appreciation", "indifference", "complaint", "hostility"], answerIndex: 0 },
    { id: "hula-31", text: "Visitors to Hawaii are encouraged to watch authentic Hula shows to ______ the true spirit of Aloha.", options: ["experience", "overlook", "criticize", "disturb"], answerIndex: 0 },
    { id: "hula-32", text: "The word 'Aloha' means more than hello and goodbye; it represents love, peace, and ______.", options: ["compassion", "competition", "confusion", "isolation"], answerIndex: 0 },
    { id: "hula-33", text: "When a soloist performs at the Merrie Monarch Festival, judges evaluate posture, precision, and ______.", options: ["authenticity", "speed", "volume", "height"], answerIndex: 0 },
    { id: "hula-34", text: "Many Hula songs praise famous Hawaiian mountains, waterfalls, and sacred ______.", options: ["valleys", "highways", "airports", "warehouses"], answerIndex: 0 },
    { id: "hula-35", text: "A good Hula dancer keeps their upper body steady while their feet and hips follow the ______.", options: ["beat", "crowd", "weather", "curtain"], answerIndex: 0 },
    { id: "hula-36", text: "Chanting in the Hawaiian language helps young generations ______ their native vocabulary.", options: ["preserve", "neglect", "replace", "weaken"], answerIndex: 0 },
    { id: "hula-37", text: "The gentle melody of the steel guitar often ______ modern Hula Auana performances.", options: ["accompanies", "interrupts", "silences", "delays"], answerIndex: 0 },
    { id: "hula-38", text: "Even when a dance is fast and powerful, the dancers' hand gestures remain fluid and ______.", options: ["expressive", "rigid", "mechanical", "awkward"], answerIndex: 0 },
    { id: "hula-39", text: "Costume colors are chosen to ______ the specific island or volcano honored in the chant.", options: ["symbolize", "disguise", "contradict", "measure"], answerIndex: 0 },
    { id: "hula-40", text: "For instance, the color red is traditionally worn to honor Pele, the Hawaiian goddess of ______.", options: ["volcanoes", "glaciers", "deserts", "factories"], answerIndex: 0 },
    { id: "hula-41", text: "Practicing together every week builds a strong bond of 'ohana', which means ______ in Hawaiian.", options: ["family", "stranger", "schedule", "distance"], answerIndex: 0 },
    { id: "hula-42", text: "At the end of the dance, the performers hold their final pose until the last drumbeat ______.", options: ["fades", "explodes", "hurries", "argues"], answerIndex: 0 },
    { id: "hula-43", text: "Today, Hula is celebrated worldwide as a timeless symbol of Hawaiian identity and artistic ______.", options: ["heritage", "machinery", "commerce", "industry"], answerIndex: 0 }
  ];

  async function readPlatformCache(): Promise<any> {
    if (memoryCache) return memoryCache;
    try {
      const fs = await import("fs/promises");
      const raw = await fs.readFile(PLATFORM_CACHE_FILE, "utf-8").catch(() => "{}");
      let parsed: any = {};
      try {
        parsed = JSON.parse(raw || "{}");
      } catch {
        // Recover if trailing bytes exist
        const lastBrace = raw.lastIndexOf("}");
        if (lastBrace > 0) {
          for (let pos = lastBrace; pos > Math.max(0, lastBrace - 50000); pos--) {
            if (raw[pos] === "}") {
              try {
                parsed = JSON.parse(raw.slice(0, pos + 1));
                break;
              } catch {}
            }
          }
        }
      }
      if (!parsed || typeof parsed !== "object") parsed = {};
      if (!Array.isArray(parsed.games)) parsed.games = [];
      if (!Array.isArray(parsed.users)) parsed.users = [];
      if (!Array.isArray(parsed.activities)) parsed.activities = [];
      if (!Array.isArray(parsed.homeworkAssignments)) parsed.homeworkAssignments = [];
      if (!Array.isArray(parsed.homeworkTrash)) parsed.homeworkTrash = [];
      if (!parsed.deletedHomeworkKeys || typeof parsed.deletedHomeworkKeys !== "object") {
        parsed.deletedHomeworkKeys = {};
      }
      if (!Array.isArray(parsed.homeworkSubmissions)) parsed.homeworkSubmissions = [];

      // Ensure the 3 known homework assignments from teacher wnxUHR2dywQqrTmD6LE5LPamkQI2 exist so their PINs (764273, 333169, 978021) always resolve
      const teacherUid = "wnxUHR2dywQqrTmD6LE5LPamkQI2";
      const simplePastGame = parsed.games.find((g: any) => g && g.id === "ykBLO9m76dim1HUqTD0Y");
      const simplePastQuestions = (simplePastGame?.customQuestions || simplePastGame?.questions || []).map((q: any, idx: number) => ({
        id: q.id || `sp-${idx + 1}`,
        text: q.text || q.question || `Question ${idx + 1}`,
        question: q.text || q.question || `Question ${idx + 1}`,
        options: Array.isArray(q.options) && q.options.length === 2 && idx === 0
          ? ["have visited", "visited", "went"]
          : (Array.isArray(q.options) ? q.options : ["Option A", "Option B"]),
        answerIndex: typeof q.answerIndex === "number" ? q.answerIndex : 0,
        correctAnswer: Array.isArray(q.options) ? q.options[typeof q.answerIndex === "number" ? q.answerIndex : 0] : ""
      }));

      const seedHomeworks = [
        {
          id: "hw-seed-764273",
          userId: teacherUid,
          createdByUid: teacherUid,
          createdByEmail: "janrelbugtay03@gmail.com",
          gameId: "hula-dancing-43",
          gameTitle: "Hula dancing",
          topic: "Hula dancing",
          gameType: "study-mode",
          classLevel: "Starters",
          targetClass: "Starters",
          dueDate: "2026-11-15",
          durationMinutes: 15,
          passingScore: 70,
          maxAttempts: 3,
          instructions: "Study and answer all 43 questions on \"Hula dancing\" to achieve the passing score before the deadline!",
          pinCode: "764273",
          questions: HULA_DANCING_QUESTIONS,
          createdAt: 1794037500000,
          status: "active",
          submissionsCount: 0,
          isDeleted: false
        },
        {
          id: "hw-seed-333169",
          userId: teacherUid,
          createdByUid: teacherUid,
          createdByEmail: "janrelbugtay03@gmail.com",
          gameId: "ykBLO9m76dim1HUqTD0Y",
          gameTitle: "Simple past and Present perfect",
          topic: "Simple past and Present perfect",
          gameType: "study-mode",
          classLevel: "Flyers",
          targetClass: "Flyers",
          dueDate: "2026-11-15",
          durationMinutes: 15,
          passingScore: 70,
          maxAttempts: 3,
          instructions: "Study and answer all 40 questions on \"Simple past and Present perfect\" to achieve the passing score before the deadline!",
          pinCode: "333169",
          questions: simplePastQuestions,
          createdAt: 1794037400000,
          status: "active",
          submissionsCount: 0,
          isDeleted: false
        },
        {
          id: "hw-seed-978021",
          userId: teacherUid,
          createdByUid: teacherUid,
          createdByEmail: "janrelbugtay03@gmail.com",
          gameId: "ykBLO9m76dim1HUqTD0Y",
          gameTitle: "Simple past and Present perfect",
          topic: "Simple past and Present perfect",
          gameType: "study-mode",
          classLevel: "Flyers",
          targetClass: "Flyers",
          dueDate: "2026-11-15",
          durationMinutes: 15,
          passingScore: 70,
          maxAttempts: 3,
          instructions: "Study and answer all 40 questions on \"Simple past and Present perfect\" to achieve the passing score before the deadline!",
          pinCode: "978021",
          questions: simplePastQuestions,
          createdAt: 1794037300000,
          status: "active",
          submissionsCount: 0,
          isDeleted: false
        }
      ];

      const existingPins = new Set([
        ...parsed.homeworkAssignments.map((a: any) => String(a?.pinCode || "")),
        ...parsed.homeworkTrash.map((a: any) => String(a?.pinCode || ""))
      ]);
      const userDeletedSet = new Set<string>(
        Array.isArray(parsed.deletedHomeworkKeys[teacherUid]) ? parsed.deletedHomeworkKeys[teacherUid] : []
      );

      let seededAny = false;
      for (const seed of seedHomeworks) {
        if (!existingPins.has(seed.pinCode) && !userDeletedSet.has(`perm_${seed.pinCode}`)) {
          parsed.homeworkAssignments.push(seed);
          seededAny = true;
        }
      }

      memoryCache = parsed;
      if (seededAny) {
        await writePlatformCache(parsed);
      }
      return memoryCache;
    } catch (err) {
      return {
        games: [],
        users: [],
        activities: [],
        homeworkAssignments: [],
        homeworkTrash: [],
        deletedHomeworkKeys: {},
        homeworkSubmissions: [],
        pageVisits: 558
      };
    }
  }

  async function writePlatformCache(data: any): Promise<void> {
    memoryCache = data;
    writeQueue = writeQueue.then(async () => {
      try {
        const fs = await import("fs/promises");
        const tmpFile = `${PLATFORM_CACHE_FILE}.tmp`;
        await fs.writeFile(tmpFile, JSON.stringify(data), "utf-8");
        await fs.rename(tmpFile, PLATFORM_CACHE_FILE);
      } catch (e) {
        console.error("Failed to write platform cache:", e);
      }
    });
    return writeQueue;
  }

  app.get("/api/platform-cache", async (_req, res) => {
    try {
      const data = await readPlatformCache();
      res.json(data);
    } catch (err: any) {
      res.json({});
    }
  });

  app.post("/api/platform-cache", async (req, res) => {
    try {
      const existing = await readPlatformCache();
      const incoming = req.body || {};

      // Merge games by id
      const gamesMap = new Map<string, any>();
      if (Array.isArray(existing.games)) {
        existing.games.forEach((g: any) => {
          if (g && g.id) gamesMap.set(String(g.id), g);
        });
      }
      if (Array.isArray(incoming.games)) {
        incoming.games.forEach((g: any) => {
          if (g && g.id) gamesMap.set(String(g.id), { ...(gamesMap.get(String(g.id)) || {}), ...g });
        });
      }

      // Merge users by uid/id/email
      const usersMap = new Map<string, any>();
      if (Array.isArray(existing.users)) {
        existing.users.forEach((u: any) => {
          const key = String(u?.uid || u?.id || u?.email || "");
          if (key) usersMap.set(key, u);
        });
      }
      if (Array.isArray(incoming.users)) {
        incoming.users.forEach((u: any) => {
          const key = String(u?.uid || u?.id || u?.email || "");
          if (key) usersMap.set(key, { ...(usersMap.get(key) || {}), ...u });
        });
      }

      // Merge activities by id
      const actsMap = new Map<string, any>();
      if (Array.isArray(existing.activities)) {
        existing.activities.forEach((a: any) => {
          if (a && a.id) actsMap.set(String(a.id), a);
        });
      }
      if (Array.isArray(incoming.activities)) {
        incoming.activities.forEach((a: any) => {
          if (a && a.id) actsMap.set(String(a.id), a);
        });
      }

      const merged = {
        ...existing,
        games: Array.from(gamesMap.values()),
        users: Array.from(usersMap.values()),
        activities: Array.from(actsMap.values()).slice(0, 300),
        pageVisits: Math.max(
          Number(existing.pageVisits) || 0,
          Number(incoming.pageVisits) || 0,
          558
        ),
        updatedAt: Date.now(),
      };

      await writePlatformCache(merged);
      res.json({
        success: true,
        gamesCount: merged.games.length,
        usersCount: merged.users.length,
        pageVisits: merged.pageVisits,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Cache error" });
    }
  });

  // ============================================================================
  // SERVER-SIDE HOMEWORK PERSISTENCE & PIN LOOKUP ENDPOINTS
  // Guarantees homework counts, trash bin, student PIN links, & leaderboards work
  // reliably across all devices even when Firestore quota is exhausted.
  // ============================================================================

  // Helper to populate questions from cached games if an assignment has empty questions
  function enrichHomeworkQuestionsFromCache(hw: any, cache: any): any {
    if (!hw) return hw;
    if (Array.isArray(hw.questions) && hw.questions.length > 0) return hw;
    if (String(hw.pinCode) === "764273" || String(hw.gameTitle || "").toLowerCase().includes("hula")) {
      return { ...hw, questions: HULA_DANCING_QUESTIONS };
    }
    const matchedGame = (cache.games || []).find(
      (g: any) =>
        g &&
        (String(g.id) === String(hw.gameId) ||
          String(g.topic || g.name || g.title || "").toLowerCase() ===
            String(hw.gameTitle || "").toLowerCase())
    );
    if (matchedGame) {
      const rawQ = matchedGame.customQuestions || matchedGame.questions || [];
      if (Array.isArray(rawQ) && rawQ.length > 0) {
        return { ...hw, questions: rawQ };
      }
    }
    return hw;
  }

  // GET /api/homework?userId=... -> fetch teacher's active assignments, trashed assignments, deleted keys, and submissions
  app.get("/api/homework", async (req, res) => {
    try {
      const userId = String(req.query.userId || "").trim();
      const cache = await readPlatformCache();
      if (!userId) {
        return res.json({ assignments: [], trash: [], deletedKeys: [], submissions: [] });
      }
      const deletedKeys: string[] = Array.isArray(cache.deletedHomeworkKeys?.[userId])
        ? cache.deletedHomeworkKeys[userId]
        : [];
      const deletedSet = new Set(deletedKeys);

      const assignments = (cache.homeworkAssignments || [])
        .filter((a: any) => {
          if (!a) return false;
          const owner = a.userId || a.createdByUid;
          if (owner && owner !== userId) return false;
          if (a.isDeleted) return false;
          if (deletedSet.has(String(a.id)) || (a.pinCode && deletedSet.has(String(a.pinCode)))) {
            return false;
          }
          return true;
        })
        .map((a: any) => enrichHomeworkQuestionsFromCache(a, cache));

      const trash = (cache.homeworkTrash || [])
        .filter((t: any) => {
          if (!t) return false;
          const owner = t.userId || t.createdByUid;
          if (owner && owner !== userId) return false;
          if (t.pinCode && deletedSet.has(`perm_${t.pinCode}`)) return false;
          return true;
        })
        .map((t: any) => enrichHomeworkQuestionsFromCache(t, cache));

      const userPins = new Set([
        ...assignments.map((a: any) => String(a.pinCode || "")),
        ...trash.map((t: any) => String(t.pinCode || ""))
      ]);
      const submissions = (cache.homeworkSubmissions || []).filter(
        (s: any) => s && (s.teacherUid === userId || (s.pinCode && userPins.has(String(s.pinCode))))
      );

      res.json({ assignments, trash, deletedKeys, submissions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load homework" });
    }
  });

  // POST /api/homework/sync -> bidirectional sync of teacher's local homework state with server
  app.post("/api/homework/sync", async (req, res) => {
    try {
      const { userId, assignments: clientActive, trash: clientTrash, deletedKeys: clientDeletedKeys, submissions: clientSubs } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId is required" });

      const cache = await readPlatformCache();
      const serverDeleted: string[] = Array.isArray(cache.deletedHomeworkKeys?.[userId])
        ? cache.deletedHomeworkKeys[userId]
        : [];
      const mergedDeletedSet = new Set<string>([
        ...serverDeleted,
        ...(Array.isArray(clientDeletedKeys) ? clientDeletedKeys.map(String) : [])
      ]);

      // Track permanently deleted pins
      const permDeletedPins = new Set<string>();
      mergedDeletedSet.forEach((k) => {
        if (k.startsWith("perm_")) permDeletedPins.add(k.replace(/^perm_/, ""));
      });

      // Map all trash items for this user by pinCode
      const trashByPin = new Map<string, any>();
      (cache.homeworkTrash || []).forEach((t: any) => {
        if (!t) return;
        const owner = t.userId || t.createdByUid;
        if (owner === userId) {
          const pin = String(t.pinCode || t.id);
          if (!permDeletedPins.has(pin)) trashByPin.set(pin, enrichHomeworkQuestionsFromCache(t, cache));
        }
      });
      if (Array.isArray(clientTrash)) {
        clientTrash.forEach((t: any) => {
          if (!t) return;
          const pin = String(t.pinCode || t.id);
          if (permDeletedPins.has(pin)) return;
          const existing = trashByPin.get(pin);
          if (!existing || (t.deletedAt || 0) >= (existing.deletedAt || 0)) {
            trashByPin.set(pin, enrichHomeworkQuestionsFromCache({ ...t, userId, createdByUid: userId, isDeleted: true }, cache));
          }
        });
      }

      // Map all active items for this user by pinCode
      const activeByPin = new Map<string, any>();
      (cache.homeworkAssignments || []).forEach((a: any) => {
        if (!a) return;
        const owner = a.userId || a.createdByUid;
        if (owner === userId && !a.isDeleted) {
          const pin = String(a.pinCode || a.id);
          if (!permDeletedPins.has(pin)) activeByPin.set(pin, enrichHomeworkQuestionsFromCache(a, cache));
        }
      });
      if (Array.isArray(clientActive)) {
        clientActive.forEach((a: any) => {
          if (!a || a.isDeleted) return;
          const pin = String(a.pinCode || a.id);
          if (permDeletedPins.has(pin)) return;
          const existing = activeByPin.get(pin);
          if (!existing || (a.updatedAt || a.createdAt || 0) >= (existing.updatedAt || existing.createdAt || 0)) {
            activeByPin.set(pin, enrichHomeworkQuestionsFromCache({ ...a, userId, createdByUid: userId, isDeleted: false }, cache));
          }
        });
      }

      // Reconcile items that appear in both activeByPin and trashByPin or mergedDeletedSet
      for (const [pin, activeItem] of Array.from(activeByPin.entries())) {
        const trashItem = trashByPin.get(pin);
        const isMarkedDeleted =
          mergedDeletedSet.has(pin) ||
          mergedDeletedSet.has(String(activeItem.id)) ||
          mergedDeletedSet.has(`hw_${pin}`);

        if (trashItem) {
          const trashTime = Number(trashItem.deletedAt || 0);
          const restoreTime = Number(activeItem.restoredAt || activeItem.updatedAt || 0);
          if (restoreTime > trashTime && !isMarkedDeleted) {
            // Item was more recently restored than trashed
            trashByPin.delete(pin);
          } else {
            // Item is in trash
            activeByPin.delete(pin);
            mergedDeletedSet.add(pin);
            mergedDeletedSet.add(String(activeItem.id));
          }
        } else if (isMarkedDeleted) {
          // Move from active to trash so it's never lost and count matches
          activeByPin.delete(pin);
          trashByPin.set(pin, {
            ...activeItem,
            isDeleted: true,
            deletedAt: Date.now()
          });
        }
      }

      // Preserve other users' assignments & trash
      const otherUsersActive = (cache.homeworkAssignments || []).filter((a: any) => {
        const owner = a?.userId || a?.createdByUid;
        return owner && owner !== userId;
      });
      const otherUsersTrash = (cache.homeworkTrash || []).filter((t: any) => {
        const owner = t?.userId || t?.createdByUid;
        return owner && owner !== userId;
      });

      const finalUserActive = Array.from(activeByPin.values()).sort(
        (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      const finalUserTrash = Array.from(trashByPin.values()).sort(
        (a: any, b: any) => (b.deletedAt || b.createdAt || 0) - (a.deletedAt || a.createdAt || 0)
      );

      // Merge submissions
      const subsById = new Map<string, any>();
      (cache.homeworkSubmissions || []).forEach((s: any) => {
        if (s && s.id) subsById.set(String(s.id), s);
      });
      if (Array.isArray(clientSubs)) {
        clientSubs.forEach((s: any) => {
          if (s && s.id) subsById.set(String(s.id), s);
        });
      }

      cache.homeworkAssignments = [...otherUsersActive, ...finalUserActive];
      cache.homeworkTrash = [...otherUsersTrash, ...finalUserTrash];
      cache.deletedHomeworkKeys[userId] = Array.from(mergedDeletedSet);
      cache.homeworkSubmissions = Array.from(subsById.values());

      await writePlatformCache(cache);

      const userPins = new Set([
        ...finalUserActive.map((a: any) => String(a.pinCode || "")),
        ...finalUserTrash.map((t: any) => String(t.pinCode || ""))
      ]);
      const finalUserSubs = cache.homeworkSubmissions.filter(
        (s: any) => s && (s.teacherUid === userId || (s.pinCode && userPins.has(String(s.pinCode))))
      );

      res.json({
        assignments: finalUserActive,
        trash: finalUserTrash,
        deletedKeys: cache.deletedHomeworkKeys[userId],
        submissions: finalUserSubs
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Sync failed" });
    }
  });

  // POST /api/homework/save -> save or update a homework assignment
  app.post("/api/homework/save", async (req, res) => {
    try {
      const { assignment, userId } = req.body || {};
      if (!assignment || !assignment.pinCode) {
        return res.status(400).json({ error: "Valid assignment with pinCode required" });
      }
      const cache = await readPlatformCache();
      const ownerUid = userId || assignment.userId || assignment.createdByUid || "wnxUHR2dywQqrTmD6LE5LPamkQI2";
      const pin = String(assignment.pinCode).trim();
      const enriched = enrichHomeworkQuestionsFromCache(
        {
          ...assignment,
          userId: ownerUid,
          createdByUid: ownerUid,
          isDeleted: false,
          updatedAt: Date.now()
        },
        cache
      );

      // Remove from active with same pin/id, then prepend
      cache.homeworkAssignments = [
        enriched,
        ...(cache.homeworkAssignments || []).filter(
          (a: any) => a && String(a.pinCode) !== pin && String(a.id) !== String(enriched.id)
        )
      ];

      // Remove from trash
      cache.homeworkTrash = (cache.homeworkTrash || []).filter(
        (t: any) => t && String(t.pinCode) !== pin && String(t.id) !== String(enriched.id)
      );

      // Remove from deletedHomeworkKeys
      if (Array.isArray(cache.deletedHomeworkKeys?.[ownerUid])) {
        const toRemove = new Set([pin, String(enriched.id), `hw_${pin}`, `hw-${pin}`, `perm_${pin}`]);
        cache.deletedHomeworkKeys[ownerUid] = cache.deletedHomeworkKeys[ownerUid].filter(
          (k: string) => !toRemove.has(String(k))
        );
      }

      await writePlatformCache(cache);
      res.json({ success: true, assignment: enriched });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save homework" });
    }
  });

  // POST /api/homework/delete -> move to trash or permanently delete
  app.post("/api/homework/delete", async (req, res) => {
    try {
      const { assignmentId, pinCode, userId, assignment, permanent } = req.body || {};
      const cache = await readPlatformCache();
      const pin = String(pinCode || assignment?.pinCode || "").trim();
      const id = String(assignmentId || assignment?.id || "").trim();

      const target =
        assignment ||
        (cache.homeworkAssignments || []).find(
          (a: any) => a && ((id && String(a.id) === id) || (pin && String(a.pinCode) === pin))
        ) ||
        (cache.homeworkTrash || []).find(
          (t: any) => t && ((id && String(t.id) === id) || (pin && String(t.pinCode) === pin))
        );

      const ownerUid = userId || target?.userId || target?.createdByUid || "wnxUHR2dywQqrTmD6LE5LPamkQI2";
      const effectivePin = pin || String(target?.pinCode || "");
      const effectiveId = id || String(target?.id || "");

      // Remove from active assignments
      cache.homeworkAssignments = (cache.homeworkAssignments || []).filter(
        (a: any) =>
          a &&
          (!effectiveId || String(a.id) !== effectiveId) &&
          (!effectivePin || String(a.pinCode) !== effectivePin)
      );

      if (!Array.isArray(cache.deletedHomeworkKeys[ownerUid])) {
        cache.deletedHomeworkKeys[ownerUid] = [];
      }
      const delSet = new Set<string>(cache.deletedHomeworkKeys[ownerUid]);
      if (effectiveId) delSet.add(effectiveId);
      if (effectivePin) {
        delSet.add(effectivePin);
        delSet.add(`hw_${effectivePin}`);
      }

      if (permanent) {
        if (effectivePin) delSet.add(`perm_${effectivePin}`);
        cache.homeworkTrash = (cache.homeworkTrash || []).filter(
          (t: any) =>
            t &&
            (!effectiveId || String(t.id) !== effectiveId) &&
            (!effectivePin || String(t.pinCode) !== effectivePin)
        );
      } else if (target) {
        const trashedItem = enrichHomeworkQuestionsFromCache(
          {
            ...target,
            userId: ownerUid,
            createdByUid: ownerUid,
            isDeleted: true,
            deletedAt: Date.now()
          },
          cache
        );
        cache.homeworkTrash = [
          trashedItem,
          ...(cache.homeworkTrash || []).filter(
            (t: any) =>
              t &&
              (!effectiveId || String(t.id) !== effectiveId) &&
              (!effectivePin || String(t.pinCode) !== effectivePin)
          )
        ];
      }

      cache.deletedHomeworkKeys[ownerUid] = Array.from(delSet);
      await writePlatformCache(cache);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete homework" });
    }
  });

  // POST /api/homework/restore -> recover from trash back to active
  app.post("/api/homework/restore", async (req, res) => {
    try {
      const { assignment, userId } = req.body || {};
      if (!assignment) return res.status(400).json({ error: "Assignment is required" });
      const cache = await readPlatformCache();
      const ownerUid = userId || assignment.userId || assignment.createdByUid || "wnxUHR2dywQqrTmD6LE5LPamkQI2";
      const pin = String(assignment.pinCode || "").trim();
      const id = String(assignment.id || "").trim();

      cache.homeworkTrash = (cache.homeworkTrash || []).filter(
        (t: any) => t && (!id || String(t.id) !== id) && (!pin || String(t.pinCode) !== pin)
      );

      if (Array.isArray(cache.deletedHomeworkKeys?.[ownerUid])) {
        const toRemove = new Set([id, pin, `hw_${pin}`, `hw-${pin}`, `perm_${pin}`]);
        cache.deletedHomeworkKeys[ownerUid] = cache.deletedHomeworkKeys[ownerUid].filter(
          (k: string) => !toRemove.has(String(k))
        );
      }

      const restored = enrichHomeworkQuestionsFromCache(
        {
          ...assignment,
          userId: ownerUid,
          createdByUid: ownerUid,
          isDeleted: false,
          deletedAt: undefined,
          restoredAt: Date.now(),
          updatedAt: Date.now(),
          status: "active"
        },
        cache
      );

      cache.homeworkAssignments = [
        restored,
        ...(cache.homeworkAssignments || []).filter(
          (a: any) => a && (!id || String(a.id) !== id) && (!pin || String(a.pinCode) !== pin)
        )
      ];

      await writePlatformCache(cache);
      res.json({ success: true, assignment: restored });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to restore homework" });
    }
  });

  // GET /api/homework/pin/:pin -> resolve any 6-digit homework PIN for students on any device
  app.get("/api/homework/pin/:pin", async (req, res) => {
    try {
      const cleanPin = String(req.params.pin || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/^hw[_-]/i, "")
        .replace(/\D/g, "")
        .slice(0, 6);
      if (!cleanPin) return res.status(404).json({ error: "Invalid PIN" });

      const cache = await readPlatformCache();

      // 1. Check active homeworkAssignments
      let found = (cache.homeworkAssignments || []).find(
        (a: any) => a && (String(a.pinCode) === cleanPin || String(a.id) === cleanPin)
      );

      // 2. Also check homeworkTrash in case teacher shared a link before moving to trash
      if (!found) {
        found = (cache.homeworkTrash || []).find(
          (t: any) => t && (String(t.pinCode) === cleanPin || String(t.id) === cleanPin)
        );
      }

      if (found) {
        const enriched = enrichHomeworkQuestionsFromCache(
          { ...found, isDeleted: false, status: "active" },
          cache
        );
        return res.json({ assignment: enriched });
      }

      return res.status(404).json({ error: "No active homework found for this PIN" });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Lookup error" });
    }
  });

  // POST /api/homework/submission -> record a student's completed homework submission
  app.post("/api/homework/submission", async (req, res) => {
    try {
      const { submission } = req.body || {};
      if (!submission || !submission.id) {
        return res.status(400).json({ error: "Valid submission is required" });
      }
      const cache = await readPlatformCache();
      cache.homeworkSubmissions = [
        submission,
        ...(cache.homeworkSubmissions || []).filter((s: any) => s && String(s.id) !== String(submission.id))
      ];

      // Update submissionsCount on matching assignment
      const aIdx = (cache.homeworkAssignments || []).findIndex(
        (a: any) =>
          a &&
          (String(a.id) === String(submission.assignmentId) ||
            (submission.pinCode && String(a.pinCode) === String(submission.pinCode)))
      );
      if (aIdx >= 0) {
        const pin = cache.homeworkAssignments[aIdx].pinCode;
        const count = cache.homeworkSubmissions.filter(
          (s: any) =>
            s &&
            (String(s.assignmentId) === String(cache.homeworkAssignments[aIdx].id) ||
              (pin && String(s.pinCode) === String(pin)))
        ).length;
        cache.homeworkAssignments[aIdx].submissionsCount = count;
      }

      await writePlatformCache(cache);
      res.json({ success: true, submission });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save submission" });
    }
  });

  // GET /api/homework/leaderboard/:pin -> get all submissions for a homework PIN
  app.get("/api/homework/leaderboard/:pin", async (req, res) => {
    try {
      const cleanPin = String(req.params.pin || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/^hw[_-]/i, "")
        .replace(/\D/g, "")
        .slice(0, 6);
      const cache = await readPlatformCache();
      const subs = (cache.homeworkSubmissions || []).filter(
        (s: any) => s && String(s.pinCode) === cleanPin
      );
      res.json({ submissions: subs });
    } catch (err: any) {
      res.json({ submissions: [] });
    }
  });

  // POST /api/homework/remove-player -> remove a student or submission from homework leaderboard
  app.post("/api/homework/remove-player", async (req, res) => {
    try {
      const { submissionId, pinCode, studentName } = req.body || {};
      const cache = await readPlatformCache();
      const targetPin = String(pinCode || "").trim();
      const targetStudent = String(studentName || "").trim().toLowerCase();

      cache.homeworkSubmissions = (cache.homeworkSubmissions || []).filter((s: any) => {
        if (!s) return false;
        if (submissionId && String(s.id) === String(submissionId)) return false;
        if (
          targetPin &&
          targetStudent &&
          String(s.pinCode) === targetPin &&
          String(s.studentName || "").trim().toLowerCase() === targetStudent
        ) {
          return false;
        }
        return true;
      });

      await writePlatformCache(cache);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to remove player" });
    }
  });

  // Emoji Generation Endpoint (gemini-3.1-flash)
  app.post("/api/generate-emoji", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `You are an emoji generator. Reply with EXACTLY ONE emoji that best represents the following text, and nothing else. Text: "${prompt}"`,
      });
      
      const emoji = response.text?.trim();
      res.json({ emoji });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Image Generation Endpoint (gemini-3-pro-image-preview)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, size } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        },
      });
      
      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      
      if (imageUrl) {
        res.json({ imageUrl });
      } else {
        res.status(500).json({ error: "Failed to generate image" });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Sprite Sheet Upload Endpoint for 50 Cute Hamsters in Squid Game Style
  app.post("/api/upload-spritesheet", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });
      const fs = await import("fs/promises");
      const targetDir = path.resolve("./public/images");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, "50_cute_hamsters_squid_game.png"), req.file.buffer);
      res.json({ success: true, url: "/images/50_cute_hamsters_squid_game.png" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Individual Student Avatar Upload Endpoint (e.g. Student #001)
  app.post("/api/upload-student-avatar", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });
      const studentNum = req.body.studentNumber || "1";
      const fs = await import("fs/promises");
      const targetDir = path.resolve("./public/images");
      await fs.mkdir(targetDir, { recursive: true });
      const fileName = `student_${String(studentNum).padStart(3, '0')}.png`;
      await fs.writeFile(path.join(targetDir, fileName), req.file.buffer);
      res.json({ success: true, url: `/images/${fileName}` });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Video Generation Start Endpoint (veo-3.1-fast-generate-preview)
  app.post("/api/generate-video", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });
      const aspectRatio = req.body.aspectRatio || "16:9";

      // Note: Model requested by user is veo-3.1-fast-generate-preview, 
      // but according to the docs we can just pass the string.
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        image: {
          imageBytes: req.file.buffer.toString('base64'),
          mimeType: req.file.mimetype,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio
        }
      });

      res.json({ operationName: operation.name });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Video Polling Endpoint
  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      res.json({ done: updated.done });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Video Download Endpoint
  app.get("/api/video-download", async (req, res) => {
    try {
      const operationName = req.query.operationName as string;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) return res.status(404).json({ error: "Video not ready or not found" });

      const videoRes = await fetch(uri, {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      });
      
      res.setHeader('Content-Type', 'video/mp4');
      if (videoRes.body) {
        // We use Node's readable web streams
        const nodeStream = require('stream').Readable.fromWeb(videoRes.body);
        nodeStream.pipe(res);
      } else {
        res.status(500).json({ error: "Empty response body from video URL" });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Image Analysis Endpoint (gemini-3.1-pro-preview)
  app.post("/api/analyze-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype,
              }
            },
            {
              text: "Analyze this image and describe what you see in detail. If it contains text, summarize it. If it contains objects or characters, identify them."
            }
          ]
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mystery Box Questions Generation Endpoint
  app.post("/api/generate-mystery-box-questions", async (req, res) => {
    try {
      const { topic, level, type, count } = req.body;
      if (!topic || !level || !type) return res.status(400).json({ error: "Topic, level, and type are required" });

      const targetCount = Math.min(30, Math.max(5, count || 30));

      const prompt = `Generate exactly ${targetCount} questions for an ESL game about "${topic}". The English proficiency level is Cambridge ${level}. 
      The question type should be ${type === 'mcq' ? 'Multiple Choice' : type === 'fib' ? 'Fill in the Blanks' : 'a mix of Multiple Choice and Fill in the Blanks'}.

      Respond ONLY with a valid JSON array of exactly ${targetCount} objects. Do not wrap in markdown tags like \`\`\`json.
      
      If the type is Multiple Choice (mcq), use this format:
      {
        "type": "mcq",
        "question": "The question text?",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "correctOptionIndex": 0 // index of the correct option (0-3)
      }
      
      If the type is Fill in the Blanks (fib), use this format:
      {
        "type": "fib",
        "question": "The sentence with a ____ blank.",
        "answer": "correct word"
      }
      
      Ensure the English is natural, accurate, and perfectly matches the Cambridge ${level} level. 
      The JSON array MUST have exactly ${targetCount} objects.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      let text = response.text?.trim() || "";
      let questions = JSON.parse(text);
      
      // Ensure exactly targetCount questions and limit to 30
      if (Array.isArray(questions)) {
        if (questions.length > targetCount) {
          questions = questions.slice(0, targetCount);
        } else while (questions.length < targetCount && questions.length < 30) {
          questions.push({...questions[questions.length - 1]});
        }
      }

      res.json({ questions: questions.slice(0, 30) });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  
  app.post("/api/generate-hamster-questions", async (req, res) => {
    try {
      const { topic, level, types, freq, videoUrl } = req.body;
      if (!topic || !level || !types) return res.status(400).json({ error: "Missing parameters" });

      const prompt = `You are an expert ESL teacher creating an interactive pop quiz for a video.
Topic: "${topic}"
Proficiency Level: Cambridge ${level}
Video URL: ${videoUrl || "Unknown"}
Requested Question Types: ${types.join(', ')}
Frequency: ${freq}

Generate exactly 4 engaging quiz questions based on the topic "${topic}". 
Make the questions relevant to a hypothetical video about this topic.
Spread the timeTrigger (in seconds) out reasonably between 10 and 120 seconds. 

Respond ONLY with a valid JSON array of exactly 4 objects. Do not wrap in markdown tags.
Format each object like this based on its type:

For 'Multiple Choice':
{
  "id": 1,
  "timeTrigger": 15,
  "type": "Multiple Choice",
  "xp": 100,
  "question": "Question text here?",
  "options": [
    { "text": "Correct Option", "isCorrect": true },
    { "text": "Wrong Option 1", "isCorrect": false },
    { "text": "Wrong Option 2", "isCorrect": false },
    { "text": "Wrong Option 3", "isCorrect": false }
  ],
  "explanation": "Brief explanation of why it is correct."
}

For 'Vocabulary Meaning':
{
  "id": 2,
  "timeTrigger": 30,
  "type": "Vocabulary Meaning",
  "xp": 150,
  "word": "VOCABWORD",
  "pronunciation": "/vocab/",
  "question": "What does 'VOCABWORD' mean here?",
  "options": [
    { "text": "Correct meaning", "isCorrect": true },
    { "text": "Wrong meaning 1", "isCorrect": false },
    { "text": "Wrong meaning 2", "isCorrect": false },
    { "text": "Wrong meaning 3", "isCorrect": false }
  ],
  "explanation": "Brief explanation."
}

For 'Grammar Choice':
{
  "id": 3,
  "timeTrigger": 45,
  "type": "Grammar Choice",
  "xp": 100,
  "question": "Which sentence is grammatically correct?",
  "options": [
    { "text": "Correct sentence", "isCorrect": true },
    { "text": "Wrong sentence 1", "isCorrect": false },
    { "text": "Wrong sentence 2", "isCorrect": false },
    { "text": "Wrong sentence 3", "isCorrect": false }
  ],
  "explanation": "Brief explanation."
}

Ensure the array contains a mix of the requested types: ${types.join(', ')}.
Return exactly a JSON array of 4 objects.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      let text = response.text?.trim() || "";
      let questions = JSON.parse(text);

      res.json({ questions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Multi-Source Giphy & Tenor & Commons GIF Search Endpoint (Zero Rate-Limit Failures)
  app.get("/api/giphy-search", async (req, res) => {
    try {
      const query = ((req.query.q as string) || "").trim();
      if (!query) return res.status(400).json({ error: "Query is required" });

      const combinedGifs: any[] = [];
      const seenUrls = new Set<string>();
      const pushGif = (id: string, title: string, fullUrl: string, smallUrl?: string) => {
        if (!fullUrl || seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);
        combinedGifs.push({
          id,
          title: title || query,
          images: {
            fixed_height: { url: fullUrl },
            fixed_height_small: { url: smallUrl || fullUrl },
          },
        });
      };

      const tasks: Promise<void>[] = [];

      // Source 1: Tenor GIF API (High volume, reliable animated GIFs)
      tasks.push(
        (async () => {
          try {
            const tenorKey = process.env.TENOR_API_KEY || "LIVDSRZULELA";
            const tenorRes = await fetch(
              `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${tenorKey}&limit=28`
            );
            if (tenorRes.ok) {
              const tenorData: any = await tenorRes.json();
              if (Array.isArray(tenorData?.results)) {
                tenorData.results.forEach((item: any) => {
                  const media = item.media?.[0];
                  const full = media?.gif?.url || media?.mediumgif?.url || media?.tinygif?.url;
                  const small = media?.tinygif?.url || media?.nanogif?.url || full;
                  if (full) {
                    pushGif(`tenor-${item.id}`, item.content_description || item.title || query, full, small);
                  }
                });
              }
            }
          } catch (e) {
            // Continue with other sources
          }
        })()
      );

      // Source 2: Giphy API (if custom key or public key succeeds)
      tasks.push(
        (async () => {
          try {
            const apiKey = process.env.GIPHY_API_KEY || "dc6zaTOxFJmzC";
            const response = await fetch(
              `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
            );
            if (response.ok) {
              const data: any = await response.json();
              if (Array.isArray(data?.data)) {
                data.data.forEach((g: any) => {
                  const full = g?.images?.fixed_height?.url || g?.images?.original?.url;
                  const small = g?.images?.fixed_height_small?.url || full;
                  if (full) pushGif(`giphy-${g.id}`, g.title || query, full, small);
                });
              }
            }
          } catch (e) {
            // Continue with other sources
          }
        })()
      );

      // Source 3: Wikimedia Commons Animated GIFs
      tasks.push(
        (async () => {
          try {
            const wikiRes = await fetch(
              `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                `filetype:bitmap mime:image/gif ${query}`
              )}&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url&format=json`,
              { headers: { "User-Agent": "ESLGameStudio/1.0 (Educational Game App)" } }
            );
            if (wikiRes.ok) {
              const wikiData: any = await wikiRes.json();
              const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
              (pages as any[]).forEach((p: any) => {
                const url = p?.imageinfo?.[0]?.url;
                if (url && url.toLowerCase().endsWith(".gif")) {
                  pushGif(`wiki-gif-${p.pageid}`, (p.title || query).replace(/^File:/i, ""), url, url);
                }
              });
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      // Source 4: ARASAAC Cartoon PNG Stickers as bonus visual fallback if GIFs are sparse
      tasks.push(
        (async () => {
          try {
            const araRes = await fetch(
              `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(query)}`
            );
            if (araRes.ok) {
              const araData: any = await araRes.json();
              if (Array.isArray(araData)) {
                araData.slice(0, 8).forEach((item: any, idx: number) => {
                  if (item?._id) {
                    const url = `https://static.arasaac.org/pictograms/${item._id}/${item._id}_500.png`;
                    pushGif(`arasaac-sticker-${item._id}-${idx}`, `${query} Cartoon Sticker`, url, url);
                  }
                });
              }
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      await Promise.allSettled(tasks);
      res.json({ data: combinedGifs });
    } catch (err: any) {
      console.error("Giphy search error:", err);
      res.json({ data: [] });
    }
  });

  // Multi-Source Photo Search Endpoint (Prioritizes Cartoon PNGs via ARASAAC + Wikimedia Cartoon PNGs + Openverse)
  app.get("/api/photo-search", async (req, res) => {
    try {
      const query = ((req.query.q as string) || "").trim();
      const prioritizeCartoon = req.query.cartoon !== "0";
      if (!query) return res.status(400).json({ error: "Query is required" });

      const combinedPhotos: any[] = [];
      const seenUrls = new Set<string>();
      const pushPhoto = (
        id: string,
        title: string,
        regular: string,
        small?: string,
        isCartoonPng: boolean = false,
        source: string = "Photo"
      ) => {
        if (!regular || seenUrls.has(regular)) return;
        seenUrls.add(regular);
        combinedPhotos.push({
          id,
          alt_description: title || query,
          isCartoonPng,
          source,
          urls: {
            regular,
            small: small || regular,
          },
        });
      };

      const tasks: Promise<void>[] = [];

      // Source 1: ARASAAC Educational Cartoon Pictograms (500px Transparent Cartoon PNGs — Priority #1!)
      tasks.push(
        (async () => {
          try {
            const araRes = await fetch(
              `https://api.arasaac.org/v1/pictograms/en/search/${encodeURIComponent(query)}`
            );
            if (araRes.ok) {
              const araData: any = await araRes.json();
              if (Array.isArray(araData)) {
                araData.slice(0, 16).forEach((item: any, idx: number) => {
                  if (item?._id) {
                    const pngUrl = `https://static.arasaac.org/pictograms/${item._id}/${item._id}_500.png`;
                    const kw = item.keywords?.[0]?.keyword || query;
                    pushPhoto(
                      `arasaac-${item._id}-${idx}`,
                      `${kw} (Cartoon PNG)`,
                      pngUrl,
                      pngUrl,
                      true,
                      "ARASAAC Cartoon PNG"
                    );
                  }
                });
              }
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      // Source 2: Wikimedia Commons Cartoon PNGs, Clipart & Vector Illustrations (rendered as PNG)
      tasks.push(
        (async () => {
          try {
            const gsr = prioritizeCartoon
              ? `filetype:bitmap|drawing ${query} cartoon OR clipart OR illustration OR icon`
              : `filetype:bitmap ${query}`;
            const wikiRes = await fetch(
              `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                gsr
              )}&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url|mime&iiurlwidth=500&format=json`,
              { headers: { "User-Agent": "ESLGameStudio/1.0 (Educational Game App)" } }
            );
            if (wikiRes.ok) {
              const wikiData: any = await wikiRes.json();
              const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
              (pages as any[]).forEach((p: any) => {
                const info = p?.imageinfo?.[0];
                const thumb = info?.thumburl || info?.url;
                if (thumb) {
                  const isPng =
                    thumb.toLowerCase().endsWith(".png") ||
                    (info?.mime && (info.mime.includes("png") || info.mime.includes("svg")));
                  pushPhoto(
                    `wiki-cartoon-${p.pageid}`,
                    (p.title || query).replace(/^File:/i, ""),
                    thumb,
                    thumb,
                    Boolean(isPng),
                    isPng ? "Cartoon PNG" : "Wikimedia Commons"
                  );
                }
              });
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      // Source 3: Openverse API (with User-Agent header & PNG extension priority)
      tasks.push(
        (async () => {
          try {
            const ovUrl = prioritizeCartoon
              ? `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&extension=png&page_size=20`
              : `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20`;
            const response = await fetch(ovUrl, {
              headers: {
                "User-Agent": "ESLGameStudio/1.0 (Educational Classroom Platform)",
                Accept: "application/json",
              },
            });
            if (response.ok) {
              const data: any = await response.json();
              if (Array.isArray(data?.results)) {
                data.results.forEach((img: any) => {
                  if (img?.url) {
                    const isPng = img.url.toLowerCase().endsWith(".png") || img.filetype === "png";
                    pushPhoto(
                      `ov-${img.id}`,
                      img.title || query,
                      img.url,
                      img.thumbnail || img.url,
                      isPng,
                      isPng ? "Openverse PNG" : "Openverse Photo"
                    );
                  }
                });
              }
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      // Source 4: Wikimedia Commons General High-Res Photos
      tasks.push(
        (async () => {
          try {
            const wikiPhotoRes = await fetch(
              `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                `filetype:bitmap ${query}`
              )}&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url|mime&iiurlwidth=500&format=json`,
              { headers: { "User-Agent": "ESLGameStudio/1.0 (Educational Game App)" } }
            );
            if (wikiPhotoRes.ok) {
              const wikiData: any = await wikiPhotoRes.json();
              const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
              (pages as any[]).forEach((p: any) => {
                const info = p?.imageinfo?.[0];
                const thumb = info?.thumburl || info?.url;
                if (thumb) {
                  const isPng = thumb.toLowerCase().endsWith(".png");
                  pushPhoto(
                    `wiki-gen-${p.pageid}`,
                    (p.title || query).replace(/^File:/i, ""),
                    thumb,
                    thumb,
                    isPng,
                    isPng ? "PNG Photo" : "Commons Photo"
                  );
                }
              });
            }
          } catch (e) {
            // Continue
          }
        })()
      );

      await Promise.allSettled(tasks);

      if (prioritizeCartoon) {
        combinedPhotos.sort((a, b) => (b.isCartoonPng ? 1 : 0) - (a.isCartoonPng ? 1 : 0));
      }

      res.json({ results: combinedPhotos });
    } catch (err: any) {
      console.error("Photo search error:", err);
      res.json({ results: [] });
    }
  });

  // ============================================================================
  // REAL-TIME HAMSTER PAINTBALL MULTIPLAYER ROOM ENGINE (Server-Authoritative)
  // Guarantees Host & Students see each other immediately across all devices/tabs
  // even when Firebase Firestore hits daily free-tier quota limits.
  // ============================================================================
  const paintballRoomsMemory = new Map<
    string,
    {
      room: Record<string, any>;
      players: Map<string, Record<string, any>>;
    }
  >();

  function getOrCreatePaintballRoom(rawCode: string) {
    const cleanCode = String(rawCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .slice(0, 6);
    if (!cleanCode) return null;
    let entry = paintballRoomsMemory.get(cleanCode);
    if (!entry) {
      entry = {
        room: {
          roomCode: cleanCode,
          website: "www.hamsterenglish.online",
          hostName: "Teacher Jan",
          matchMode: "teams",
          matchStatus: "lobby",
          configuredDurationSec: 180,
          ballsPerQuestion: 10,
          isUninitialized: true,
          updatedAt: Date.now()
        },
        players: new Map()
      };
      paintballRoomsMemory.set(cleanCode, entry);
    }
    return entry;
  }

  function serializePaintballRoom(entry: {
    room: Record<string, any>;
    players: Map<string, Record<string, any>>;
  }) {
    const now = Date.now();
    // Prune stale disconnected players who haven't updated in > 60 seconds
    entry.players.forEach((p, id) => {
      if (p.kicked && now - (p.updatedAt || 0) > 5000) {
        entry.players.delete(id);
      } else if (now - (p.updatedAt || 0) > 65000) {
        entry.players.delete(id);
      }
    });
    return {
      room: entry.room,
      players: Array.from(entry.players.values())
    };
  }

  // GET /api/paintball/room/:code -> Fetch room configuration & all joined players
  app.get("/api/paintball/room/:code", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });
    res.json(serializePaintballRoom(entry));
  });

  // POST /api/paintball/room/:code/room -> Host updates room settings, status, timer, or bulk player spawn positions
  app.post("/api/paintball/room/:code/room", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });

    const { room: roomPatch, players: playersPatch } = req.body || {};
    if (roomPatch && typeof roomPatch === "object") {
      entry.room = {
        ...entry.room,
        ...roomPatch,
        roomCode: entry.room.roomCode,
        isUninitialized: false,
        updatedAt: Date.now()
      };
    }

    if (Array.isArray(playersPatch)) {
      const now = Date.now();
      playersPatch.forEach((pPatch: any) => {
        if (!pPatch || !pPatch.id) return;
        const existing = entry.players.get(pPatch.id) || {};
        entry.players.set(pPatch.id, {
          ...existing,
          ...pPatch,
          hostOverrideAt: now,
          updatedAt: now
        });
      });
    }

    res.json(serializePaintballRoom(entry));
  });

  // POST /api/paintball/room/:code/player -> Student joins/heartbeats state OR Host updates/moves/kicks a player
  app.post("/api/paintball/room/:code/player", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });

    const body = req.body || {};
    const playerData = body.player || body;
    const playerId = String(playerData.id || "").trim();
    if (!playerId) {
      return res.status(400).json({ error: "Player id is required" });
    }

    const now = Date.now();
    const existing = entry.players.get(playerId) || {};
    const isHostAction = Boolean(body.isHostAction);

    // If Host moved this player's team or kicked them recently, preserve Host's team/kicked state
    const hostOverrideAt = isHostAction
      ? now
      : typeof existing.hostOverrideAt === "number"
      ? existing.hostOverrideAt
      : 0;

    const clientAckOverrideAt =
      typeof body.ackHostOverrideAt === "number" ? body.ackHostOverrideAt : 0;

    const preserveHostTeam =
      !isHostAction &&
      hostOverrideAt > clientAckOverrideAt &&
      existing.team &&
      now - hostOverrideAt < 8000;

    // Student coordinates (x, z, rotY) are always authoritative when !isHostAction so moving players never freeze at spawn!
    const mergedPlayer: Record<string, any> = {
      ...existing,
      ...playerData,
      id: playerId,
      team: preserveHostTeam ? existing.team : playerData.team || existing.team || "red",
      kicked: isHostAction
        ? Boolean(playerData.kicked)
        : Boolean(existing.kicked || playerData.kicked),
      hostOverrideAt,
      updatedAt: now
    };

    entry.players.set(playerId, mergedPlayer);

    // If a client reports active room state (e.g. from Firestore across domains) into an uninitialized memory room, adopt it
    if (body.roomState && typeof body.roomState === "object") {
      const rs = body.roomState;
      if (
        entry.room.isUninitialized ||
        (rs.matchStatus === "playing" &&
          typeof rs.startedAt === "number" &&
          rs.startedAt > (entry.room.startedAt || 0))
      ) {
        entry.room = {
          ...entry.room,
          ...rs,
          roomCode: entry.room.roomCode,
          isUninitialized: false,
          updatedAt: now
        };
      }
    }

    if (body.latestEvent && body.latestEvent.id) {
      entry.room.latestEvent = body.latestEvent;
    }

    res.json(serializePaintballRoom(entry));
  });

  // DELETE /api/paintball/room/:code/player/:playerId -> Student leaves or Host deletes player
  app.delete("/api/paintball/room/:code/player/:playerId", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });
    const playerId = String(req.params.playerId || "").trim();
    if (playerId) {
      entry.players.delete(playerId);
    }
    res.json(serializePaintballRoom(entry));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
