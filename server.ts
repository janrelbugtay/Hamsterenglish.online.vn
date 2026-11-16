import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel, GenerateVideosOperation } from "@google/genai";
import multer from "multer";

const getResolvedGeminiKey = () => {
  const raw = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  if (
    !raw ||
    raw === "missing-api-key" ||
    raw === "MY_GEMINI_API_KEY" ||
    raw === "YOUR_API_KEY" ||
    raw.includes("YOUR_")
  ) {
    return "";
  }
  return raw;
};

const hasValidGeminiKey = () => Boolean(getResolvedGeminiKey());

const getAiClient = () =>
  new GoogleGenAI({
    apiKey: getResolvedGeminiKey(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

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
      if (!Array.isArray(parsed.folders)) parsed.folders = [];
      if (!Array.isArray(parsed.deletedFolderIds)) parsed.deletedFolderIds = [];
      if (!parsed.classDataByUser || typeof parsed.classDataByUser !== "object") {
        parsed.classDataByUser = {};
      }
      if (!Array.isArray(parsed.users)) parsed.users = [];
      if (!Array.isArray(parsed.activities)) parsed.activities = [];
      if (!Array.isArray(parsed.homeworkAssignments)) parsed.homeworkAssignments = [];
      if (!Array.isArray(parsed.homeworkTrash)) parsed.homeworkTrash = [];
      if (!parsed.deletedHomeworkKeys || typeof parsed.deletedHomeworkKeys !== "object") {
        parsed.deletedHomeworkKeys = {};
      }
      if (!Array.isArray(parsed.homeworkSubmissions)) parsed.homeworkSubmissions = [];

      const deletedUserIdsSet = new Set<string>(
        Array.isArray(parsed.deletedUserIds) ? parsed.deletedUserIds.map(String) : []
      );

      const isSyntheticUserRecord = (u: any) => {
        if (!u) return true;
        const uid = String(u.uid || u.id || "").trim();
        return (
          uid === "admin-teacher-jan" ||
          uid === "user-dang-ngoc-bich" ||
          deletedUserIdsSet.has(uid)
        );
      };

      const deletedGameIdsSet = new Set<string>([
        "lbwoT7kdbBzxdxZF85nk",
        ...(Array.isArray(parsed.deletedGameIds) ? parsed.deletedGameIds.map(String) : []),
      ]);

      const isInvalidGameRecord = (g: any) => {
        if (!g || !g.id) return true;
        const id = String(g.id).trim();
        if (id.startsWith("comm-") || id.startsWith("sample-") || deletedGameIdsSet.has(id)) {
          return true;
        }
        return false;
      };

      const prevUserCount = parsed.users.length;
      const prevGameCount = parsed.games.length;
      parsed.users = parsed.users.filter((u: any) => !isSyntheticUserRecord(u));
      parsed.games = parsed.games.filter((g: any) => !isInvalidGameRecord(g));
      let cleanedAny = parsed.users.length !== prevUserCount || parsed.games.length !== prevGameCount;

      // Enrich games with creatorEmail and creatorName from matched users
      const userMapByUid = new Map<string, any>();
      parsed.users.forEach((u: any) => {
        const uid = String(u?.uid || u?.id || "").trim();
        if (uid) userMapByUid.set(uid, u);
      });
      parsed.games = parsed.games.map((g: any) => {
        if (!g) return g;
        const owner = g.userId ? userMapByUid.get(String(g.userId)) : null;
        if (owner) {
          return {
            ...g,
            creatorEmail: g.creatorEmail || owner.email || "",
            creatorName: g.creatorName || owner.displayName || "",
          };
        }
        return g;
      });

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

      parsed.deletedGameIds = Array.from(deletedGameIdsSet);
      memoryCache = parsed;
      if (seededAny || cleanedAny) {
        await writePlatformCache(parsed);
      }
      return memoryCache;
    } catch (err) {
      return {
        games: [],
        folders: [],
        deletedFolderIds: [],
        classDataByUser: {},
        users: [],
        activities: [],
        homeworkAssignments: [],
        homeworkTrash: [],
        deletedHomeworkKeys: {},
        homeworkSubmissions: [],
        deletedGameIds: ["lbwoT7kdbBzxdxZF85nk"],
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

  // Shared cross-tab Firestore quota circuit-breaker
  const QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
  const getPacificDayKey = () => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  };
  let firestoreQuotaState: { exhaustedAt: number; ptDay: string } | null = null;

  app.get("/api/firestore-quota-status", (_req, res) => {
    const now = Date.now();
    const todayPt = getPacificDayKey();
    if (
      firestoreQuotaState &&
      firestoreQuotaState.ptDay === todayPt &&
      now - firestoreQuotaState.exhaustedAt < QUOTA_COOLDOWN_MS
    ) {
      return res.json({
        exhausted: true,
        exhaustedAt: firestoreQuotaState.exhaustedAt,
        ptDay: firestoreQuotaState.ptDay,
      });
    }
    firestoreQuotaState = null;
    return res.json({ exhausted: false, ptDay: todayPt });
  });

  app.post("/api/firestore-quota-status", (req, res) => {
    const exhausted = req.body?.exhausted !== false;
    const todayPt = getPacificDayKey();
    if (exhausted) {
      firestoreQuotaState = { exhaustedAt: Date.now(), ptDay: todayPt };
    } else {
      firestoreQuotaState = null;
    }
    return res.json({
      exhausted: Boolean(firestoreQuotaState),
      ptDay: todayPt,
    });
  });

  app.post("/api/platform-cache/visit", async (_req, res) => {
    try {
      const existing = await readPlatformCache();
      const nextVisits = Math.max(Number(existing.pageVisits) || 558, 558) + 1;
      await writePlatformCache({
        ...existing,
        pageVisits: nextVisits,
        updatedAt: Date.now(),
      });
      res.json({ success: true, pageVisits: nextVisits });
    } catch (err: any) {
      res.json({ success: false, pageVisits: 558 });
    }
  });

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

      const deletedUserIds = new Set<string>([
        ...(Array.isArray(existing.deletedUserIds) ? existing.deletedUserIds.map(String) : []),
        ...(Array.isArray(incoming.deletedUserIds) ? incoming.deletedUserIds.map(String) : []),
      ]);

      const isSyntheticUserRecord = (u: any) => {
        if (!u) return true;
        const uid = String(u.uid || u.id || "").trim();
        return (
          uid === "admin-teacher-jan" ||
          uid === "user-dang-ngoc-bich" ||
          deletedUserIds.has(uid)
        );
      };

      const getTimeMs = (val: any): number => {
        if (!val) return 0;
        if (val.seconds) return val.seconds * 1000;
        if (typeof val === "number") return val;
        if (typeof val === "string") {
          const p = new Date(val).getTime();
          return isNaN(p) ? 0 : p;
        }
        return 0;
      };

      const deletedGameIds = new Set<string>([
        "lbwoT7kdbBzxdxZF85nk",
        ...(Array.isArray(existing.deletedGameIds) ? existing.deletedGameIds.map(String) : []),
        ...(Array.isArray(incoming.deletedGameIds) ? incoming.deletedGameIds.map(String) : []),
      ]);

      const isInvalidGameRecord = (g: any) => {
        if (!g || !g.id) return true;
        const id = String(g.id).trim();
        if (id.startsWith("comm-") || id.startsWith("sample-") || deletedGameIds.has(id)) {
          return true;
        }
        return false;
      };

      const isLocalOnlyGameId = (id: string) =>
        id.startsWith("local-") ||
        id.startsWith("game-") ||
        id.startsWith("slide-game-") ||
        id.startsWith("yoga-") ||
        id.startsWith("pq-");

      // Merge users by uid/id/email without ever overwriting a valid lastLoginAt or photoURL with null
      const usersMap = new Map<string, any>();
      if (Array.isArray(existing.users)) {
        existing.users.forEach((u: any) => {
          if (isSyntheticUserRecord(u)) return;
          const key = String(u?.uid || u?.id || u?.email || "");
          if (key && !deletedUserIds.has(key)) usersMap.set(key, u);
        });
      }
      if (Array.isArray(incoming.users)) {
        incoming.users.forEach((u: any) => {
          if (isSyntheticUserRecord(u)) return;
          const key = String(u?.uid || u?.id || u?.email || "");
          if (!key || deletedUserIds.has(key)) return;
          const prev = usersMap.get(key) || {};
          const bestLogin = Math.max(getTimeMs(prev.lastLoginAt), getTimeMs(u.lastLoginAt));
          usersMap.set(key, {
            ...prev,
            ...u,
            photoURL: u.photoURL || prev.photoURL || null,
            lastLoginAt: bestLogin > 0 ? bestLogin : prev.lastLoginAt || u.lastLoginAt || Date.now(),
          });
        });
      }

      // Merge games by id and enrich with creatorEmail/creatorName
      const gamesMap = new Map<string, any>();
      if (Array.isArray(existing.games)) {
        existing.games.forEach((g: any) => {
          if (isInvalidGameRecord(g)) return;
          const id = String(g.id);
          if (incoming.replaceGames && !isLocalOnlyGameId(id)) return;
          gamesMap.set(id, g);
        });
      }
      if (Array.isArray(incoming.games)) {
        incoming.games.forEach((g: any) => {
          if (isInvalidGameRecord(g)) return;
          const id = String(g.id);
          const prev = gamesMap.get(id);
          if (prev) {
            const prevTime = getTimeMs(prev.updatedAt || prev.createdAt);
            const nextTime = getTimeMs(g.updatedAt || g.createdAt);
            if (prevTime > 0 && nextTime < prevTime) {
              return;
            }
          }
          const combined = { ...(prev || {}), ...g };
          const owner = combined.userId ? usersMap.get(String(combined.userId)) : null;
          if (owner) {
            combined.creatorEmail = combined.creatorEmail || owner.email || "";
            combined.creatorName = combined.creatorName || owner.displayName || "";
          }
          gamesMap.set(id, combined);
        });
      }

      // Merge activities by id
      const actsMap = new Map<string, any>();
      const addAct = (a: any) => {
        if (!a || !a.id) return;
        const gid = String(a.gameId || "");
        if (gid && (gid.startsWith("comm-") || gid.startsWith("sample-") || deletedGameIds.has(gid))) return;
        const owner = a.userId ? usersMap.get(String(a.userId)) : null;
        if (owner && String(a.userId) !== "wnxUHR2dywQqrTmD6LE5LPamkQI2") {
          actsMap.set(String(a.id), {
            ...a,
            userEmail: owner.email || a.userEmail,
            userName: owner.displayName || a.userName,
          });
        } else {
          actsMap.set(String(a.id), a);
        }
      };
      if (Array.isArray(existing.activities)) {
        existing.activities.forEach(addAct);
      }
      if (Array.isArray(incoming.activities)) {
        incoming.activities.forEach(addAct);
      }

      const PRESET_FOLDER_IDS = new Set([
        "folder-grammar",
        "folder-vocab",
        "folder-phonics",
        "folder-speaking",
        "folder-exam",
        "folder-warmup",
      ]);
      const deletedFolderIds = new Set<string>([
        ...(Array.isArray(existing.deletedFolderIds) ? existing.deletedFolderIds.map(String) : []),
        ...(Array.isArray(incoming.deletedFolderIds) ? incoming.deletedFolderIds.map(String) : []),
      ]);
      const foldersMap = new Map<string, any>();
      const upsertFolder = (f: any) => {
        if (!f || !f.id || !f.name) return;
        const id = String(f.id).trim();
        const name = String(f.name).trim();
        if (!id || !name || deletedFolderIds.has(id) || PRESET_FOLDER_IDS.has(id)) return;
        const prev = foldersMap.get(id);
        if (!prev) {
          foldersMap.set(id, {
            ...f,
            id,
            name,
            parentId: f.parentId || null,
          });
          return;
        }
        // Real folder metadata always overrides inferred folder metadata
        if (prev.inferred && !f.inferred) {
          foldersMap.set(id, { ...prev, ...f, id, name, inferred: false });
          return;
        }
        if (!prev.inferred && f.inferred) return;
        const prevTime = getTimeMs(prev.updatedAt || prev.createdAt);
        const nextTime = getTimeMs(f.updatedAt || f.createdAt);
        if (nextTime >= prevTime) {
          foldersMap.set(id, {
            ...prev,
            ...f,
            id,
            name,
            parentId: f.parentId !== undefined ? (f.parentId || null) : (prev.parentId || null),
          });
        }
      };
      if (Array.isArray(existing.folders)) existing.folders.forEach(upsertFolder);
      if (Array.isArray(incoming.folders)) incoming.folders.forEach(upsertFolder);

      const merged = {
        ...existing,
        games: Array.from(gamesMap.values()),
        folders: Array.from(foldersMap.values()),
        deletedFolderIds: Array.from(deletedFolderIds),
        users: Array.from(usersMap.values()).sort(
          (a: any, b: any) => getTimeMs(b.lastLoginAt) - getTimeMs(a.lastLoginAt)
        ),
        activities: Array.from(actsMap.values()).slice(0, 300),
        deletedGameIds: Array.from(deletedGameIds),
        deletedUserIds: Array.from(deletedUserIds),
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

  // ============================================================================
  // SERVER-SIDE CLASS REWARDS & CLASSROOM DATA PERSISTENCE
  // Persists per-user classes, recycle bin, and custom rewards across sessions & origins
  // in BOTH .platform-cache.json AND dedicated .class-rewards-backup.json so classes
  // never disappear even when Firestore free-tier daily quota is exhausted.
  // ============================================================================
  const CLASS_BACKUP_FILE = path.resolve("./.class-rewards-backup.json");
  let classBackupMemory: Record<string, any> | null = null;
  let classBackupWriteQueue: Promise<void> = Promise.resolve();

  async function readClassBackupStore(): Promise<Record<string, any>> {
    if (classBackupMemory) return classBackupMemory;
    try {
      const fs = await import("fs/promises");
      const raw = await fs.readFile(CLASS_BACKUP_FILE, "utf-8").catch(() => "{}");
      const parsed = JSON.parse(raw || "{}");
      classBackupMemory = parsed && typeof parsed === "object" ? parsed : {};
      return classBackupMemory!;
    } catch {
      classBackupMemory = {};
      return classBackupMemory;
    }
  }

  async function writeClassBackupStore(store: Record<string, any>): Promise<void> {
    classBackupMemory = store;
    classBackupWriteQueue = classBackupWriteQueue.then(async () => {
      try {
        const fs = await import("fs/promises");
        const tmpFile = `${CLASS_BACKUP_FILE}.tmp`;
        await fs.writeFile(tmpFile, JSON.stringify(store, null, 2), "utf-8");
        await fs.rename(tmpFile, CLASS_BACKUP_FILE);
      } catch (e) {
        console.error("Failed to write class backup store:", e);
      }
    });
    return classBackupWriteQueue;
  }

  function findBestServerClassEntry(
    cacheMap: Record<string, any>,
    backupMap: Record<string, any>,
    userId: string,
    email?: string
  ): any {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const candidates: any[] = [];

    if (userId && backupMap[userId]) candidates.push(backupMap[userId]);
    if (userId && cacheMap[userId]) candidates.push(cacheMap[userId]);

    if (cleanEmail) {
      for (const map of [backupMap, cacheMap]) {
        for (const val of Object.values(map)) {
          if (val && String(val.email || "").trim().toLowerCase() === cleanEmail) {
            candidates.push(val);
          }
        }
      }
    }

    if (candidates.length === 0) return {};

    const nonEmpty = candidates.filter((c) => Array.isArray(c.classes) && c.classes.length > 0);
    if (nonEmpty.length > 0) {
      nonEmpty.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
      const bestNonEmpty = nonEmpty[0];
      const newestAny = [...candidates].sort(
        (a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)
      )[0];
      if (
        newestAny &&
        newestAny.intentionalEmptyReset &&
        (Number(newestAny.updatedAt) || 0) > (Number(bestNonEmpty.updatedAt) || 0)
      ) {
        return newestAny;
      }
      return bestNonEmpty;
    }

    candidates.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    return candidates[0] || {};
  }

  app.get("/api/class-data", async (req, res) => {
    try {
      const userId = String(req.query.userId || "").trim();
      const email = String(req.query.email || "").trim().toLowerCase();
      if (!userId && !email) {
        return res.json({
          classes: [],
          customRewards: [],
          deletedClasses: [],
          deletedStudents: [],
          updatedAt: 0,
          intentionalEmptyReset: false,
        });
      }
      const [cache, backupStore] = await Promise.all([
        readPlatformCache(),
        readClassBackupStore(),
      ]);
      const entry = findBestServerClassEntry(
        cache.classDataByUser || {},
        backupStore,
        userId,
        email
      );
      res.json({
        classes: Array.isArray(entry.classes) ? entry.classes : [],
        customRewards: Array.isArray(entry.customRewards) ? entry.customRewards : [],
        deletedClasses: Array.isArray(entry.deletedClasses) ? entry.deletedClasses : [],
        deletedStudents: Array.isArray(entry.deletedStudents) ? entry.deletedStudents : [],
        updatedAt: Number(entry.updatedAt) || 0,
        intentionalEmptyReset: Boolean(entry.intentionalEmptyReset),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load class data" });
    }
  });

  app.post("/api/class-data", async (req, res) => {
    try {
      const {
        userId,
        email,
        classes,
        customRewards,
        deletedClasses,
        deletedStudents,
        updatedAt,
        replaceEmpty,
        intentionalEmptyReset,
        replaceCustomRewards,
      } = req.body || {};
      const uid = String(userId || "").trim();
      if (!uid) return res.status(400).json({ error: "userId is required" });

      const cleanEmail = String(email || "").trim().toLowerCase();
      const [cache, backupStore] = await Promise.all([
        readPlatformCache(),
        readClassBackupStore(),
      ]);
      if (!cache.classDataByUser || typeof cache.classDataByUser !== "object") {
        cache.classDataByUser = {};
      }

      const prev = findBestServerClassEntry(cache.classDataByUser, backupStore, uid, cleanEmail);
      const prevClasses = Array.isArray(prev.classes) ? prev.classes : [];
      const prevUpdatedAt = Number(prev.updatedAt) || 0;
      const incomingUpdatedAt = Number(updatedAt) || Date.now();
      const allowEmpty = Boolean(intentionalEmptyReset || replaceEmpty);

      let nextClasses = prevClasses;
      let nextIntentionalEmpty = Boolean(prev.intentionalEmptyReset);

      if (Array.isArray(classes)) {
        if (classes.length > 0) {
          // Accept non-empty classes if newer or if server had none
          if (prevClasses.length === 0 || incomingUpdatedAt >= prevUpdatedAt - 2000) {
            nextClasses = classes;
            nextIntentionalEmpty = false;
          }
        } else if (allowEmpty && incomingUpdatedAt >= prevUpdatedAt) {
          nextClasses = [];
          nextIntentionalEmpty = true;
        }
      }

      let nextCustomRewards = Array.isArray(prev.customRewards) ? prev.customRewards : [];
      if (Array.isArray(customRewards)) {
        if (replaceCustomRewards) {
          nextCustomRewards = customRewards;
        } else {
          const map = new Map<string, any>();
          nextCustomRewards.forEach((r: any) => {
            if (r && r.id) map.set(String(r.id), r);
          });
          customRewards.forEach((r: any) => {
            if (r && r.id) map.set(String(r.id), r);
          });
          nextCustomRewards = Array.from(map.values()).sort(
            (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
          );
        }
      }

      const nextDeletedClasses = Array.isArray(deletedClasses)
        ? deletedClasses
        : prev.deletedClasses || [];
      const nextDeletedStudents = Array.isArray(deletedStudents)
        ? deletedStudents
        : prev.deletedStudents || [];

      const updatedEntry = {
        userId: uid,
        email: cleanEmail || prev.email || undefined,
        classes: nextClasses,
        customRewards: nextCustomRewards,
        deletedClasses: nextDeletedClasses,
        deletedStudents: nextDeletedStudents,
        updatedAt: Math.max(incomingUpdatedAt, prevUpdatedAt, Date.now()),
        intentionalEmptyReset: nextIntentionalEmpty,
      };

      cache.classDataByUser[uid] = updatedEntry;
      backupStore[uid] = updatedEntry;
      await Promise.all([writePlatformCache(cache), writeClassBackupStore(backupStore)]);
      res.json({ success: true, ...updatedEntry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save class data" });
    }
  });

  const extractVideoSubject = (videoTitleRaw?: string, topicRaw?: string): string => {
    const cleanTitle = (videoTitleRaw || "")
      .replace(/\[.*?\]|\(.*?\)/g, " ")
      .replace(/\b(4k|hd|official|video|clip|full|episode|seconds|minutes|hours|of|the|best|worst|ideas|ever|compilation|scene|scenes|movie|cartoon)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/mr\.?\s*bean/i.test(videoTitleRaw || "") || /mr\.?\s*bean/i.test(topicRaw || "")) {
      return "Mr. Bean";
    }
    if (/pink\s*panther/i.test(videoTitleRaw || "")) return "The Pink Panther";
    if (/tom\s*and\s*jerry/i.test(videoTitleRaw || "")) return "Tom and Jerry";
    if (/spongebob/i.test(videoTitleRaw || "")) return "SpongeBob";
    if (/peppa\s*pig/i.test(videoTitleRaw || "")) return "Peppa Pig";
    if (/paddington/i.test(videoTitleRaw || "")) return "Paddington";
    if (/harry\s*potter/i.test(videoTitleRaw || "")) return "Harry Potter";
    if (/minion/i.test(videoTitleRaw || "")) return "the Minions";
    if (/hamster/i.test(videoTitleRaw || "")) return "the hamster";

    if (cleanTitle.length >= 3 && cleanTitle.length <= 36) {
      return cleanTitle;
    }
    return "the main character";
  };

  const extractYouTubeId = (rawUrl?: string): string => {
    const s = String(rawUrl || "").trim();
    if (!s) return "";
    const m =
      s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/) ||
      s.match(/^([a-zA-Z0-9_-]{11})$/);
    return m ? m[1] : "";
  };

  const scanYouTubeVideoDeepContext = async (videoUrlRaw?: string) => {
    const videoId = extractYouTubeId(videoUrlRaw);
    let title = "";
    let author = "";
    let description = "";
    let snippet = "";
    let durationSec = 0;
    let chapters: Array<{ title: string; sec: number }> = [];
    const frameParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    if (!videoId) {
      return { videoId: "", title, author, description, snippet, durationSec, chapters, frameParts };
    }

    const tasks: Promise<void>[] = [];

    // 1. OEmbed title & channel
    tasks.push(
      (async () => {
        try {
          const oRes = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${videoId}`
            )}`
          );
          if (oRes.ok) {
            const oData: any = await oRes.json();
            if (oData?.title) title = String(oData.title).trim();
            if (oData?.author_name) author = String(oData.author_name).trim();
          }
        } catch {}
      })()
    );

    // 2. YouTube Innertube Next API for description & chapter timestamps
    tasks.push(
      (async () => {
        try {
          const nRes = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoId,
              context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00" } },
            }),
          });
          if (nRes.ok) {
            const text = await nRes.text();
            const descMatches = [
              ...text.matchAll(/"attributedDescriptionBodyText":\{"content":"((?:[^"\\]|\\.)*)"/g),
            ];
            if (descMatches.length > 0) {
              try {
                description = JSON.parse(`"${descMatches[0][1]}"`).slice(0, 1500);
              } catch {}
            }
            const chapMatches = [
              ...text.matchAll(
                /"chapterRenderer":\{"title":\{"simpleText":"([^"]+)"\},"timeRangeStartMillis":(\d+)/g
              ),
            ];
            chapters = chapMatches.slice(0, 25).map((m) => ({
              title: m[1],
              sec: Math.round(Number(m[2]) / 1000),
            }));
          }
        } catch {}
      })()
    );

    // 3. YouTube Innertube Search API for exact durationSec (lengthText) and detailed snippet
    tasks.push(
      (async () => {
        try {
          const sRes = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: videoId,
              context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00" } },
            }),
          });
          if (sRes.ok) {
            const text = await sRes.text();
            const vidIdx = text.indexOf(`"videoId":"${videoId}"`);
            const windowText =
              vidIdx >= 0 ? text.slice(Math.max(0, vidIdx - 400), vidIdx + 3500) : text.slice(0, 5000);
            const lenMatch = windowText.match(
              /"lengthText":\{.*?"simpleText":"(?:(\d+):)?(\d+):(\d+)"/
            );
            if (lenMatch) {
              const hrs = lenMatch[1] ? parseInt(lenMatch[1], 10) : 0;
              const mins = parseInt(lenMatch[2], 10) || 0;
              const secs = parseInt(lenMatch[3], 10) || 0;
              const parsedSec = hrs * 3600 + mins * 60 + secs;
              if (parsedSec > 0) durationSec = parsedSec;
            }
            const snipMatch = windowText.match(
              /"detailedMetadataSnippets":\[\{"snippetText":\{"runs":\[(.*?)\]\}/
            );
            if (snipMatch) {
              const runs = [...snipMatch[1].matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)].map(
                (m) => m[1]
              );
              snippet = runs.join("").trim();
            }
          }
        } catch {}
      })()
    );

    // 4. Download actual scene frame images from YouTube (hq1.jpg, hq2.jpg, hq3.jpg)
    tasks.push(
      (async () => {
        const frameNames = ["hq1.jpg", "hq2.jpg", "hq3.jpg"];
        const fetched = await Promise.all(
          frameNames.map(async (name) => {
            try {
              const fRes = await fetch(`https://i.ytimg.com/vi/${videoId}/${name}`);
              if (!fRes.ok) return null;
              const buf = Buffer.from(await fRes.arrayBuffer());
              if (buf.byteLength < 1000) return null;
              return {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: buf.toString("base64"),
                },
              };
            } catch {
              return null;
            }
          })
        );
        fetched.forEach((p) => {
          if (p) frameParts.push(p);
        });
      })()
    );

    await Promise.allSettled(tasks);
    if (!description && snippet) {
      description = snippet;
    } else if (snippet && !description.includes(snippet)) {
      description = `${snippet}\n${description}`;
    }
    return { videoId, title, author, description, snippet, durationSec, chapters, frameParts };
  };

  interface ScannedVideoScene {
    sceneLabel: string;
    location: string;
    mustRule: string;
    mustntRule: string;
    shouldAction: string;
    shouldntAction: string;
    canAction: string;
    cantAction: string;
    haveToAction: string;
    dontHaveToAction: string;
    verbBase: string;
    verbPast: string;
    verbV3: string;
    verbIng: string;
    verbS: string;
    obj: string;
    passiveSubject: string;
    passiveVerbV3: string;
    passiveWasOrIs: "was" | "is";
    adjBase: string;
    adjComp: string;
    adjSuper: string;
  }

  const extractDynamicScenesFromVideo = (
    videoTitleRaw?: string,
    videoDescRaw?: string,
    chaptersRaw?: Array<{ title: string; sec: number }>,
    subject: string = "the main character"
  ): ScannedVideoScene[] => {
    const combinedText = `${videoTitleRaw || ""} ${videoDescRaw || ""} ${
      Array.isArray(chaptersRaw) ? chaptersRaw.map((c) => c.title).join(" ") : ""
    }`.toLowerCase();

    const scenes: ScannedVideoScene[] = [];

    // 1. Hospital / Doctor / Clinic / Ambulance / Medical setting (e.g., "Hospital BEAN")
    if (
      /\b(hospital|doctor|nurse|ambulance|clinic|patient|medical|sick|medicine|health|emergency|bandage|waiting room|tooth|dentist)\b/i.test(
        combinedText
      )
    ) {
      scenes.push(
        {
          sceneLabel: "outside the hospital entrance by the ambulance",
          location: "outside the hospital entrance",
          mustRule: "keep the ambulance entrance clear for emergency vehicles",
          mustntRule: "park a car directly behind a hospital ambulance",
          shouldAction: "park in a normal parking space instead of blocking the ambulance",
          shouldntAction: "block the emergency ambulance doors with his car",
          canAction: "see the white ambulance parked at the hospital entrance",
          cantAction: "park legally in the emergency ambulance zone",
          haveToAction: "follow the hospital parking signs outside",
          dontHaveToAction: "drive an ambulance to enter the hospital",
          verbBase: "park",
          verbPast: "parked",
          verbV3: "parked",
          verbIng: "parking",
          verbS: "parks",
          obj: "near the ambulance outside the hospital entrance",
          passiveSubject: "The hospital ambulance",
          passiveVerbV3: "parked",
          passiveWasOrIs: "is",
          adjBase: "urgent",
          adjComp: "more urgent",
          adjSuper: "most urgent",
        },
        {
          sceneLabel: "at the hospital reception and ticket machine",
          location: "in the hospital waiting area",
          mustRule: "take a queue ticket and wait for his number to be called",
          mustntRule: "steal or swap someone else's queue ticket in the hospital",
          shouldAction: "check the number on his waiting-room ticket carefully",
          shouldntAction: "try to trick other patients to get an earlier ticket number",
          canAction: "take a numbered ticket from the hospital machine",
          cantAction: "skip the hospital queue without a valid ticket number",
          haveToAction: "wait until the electronic board shows his ticket number",
          dontHaveToAction: "pay for a queue ticket at the reception machine",
          verbBase: "take",
          verbPast: "took",
          verbV3: "taken",
          verbIng: "taking",
          verbS: "takes",
          obj: "a numbered ticket in the hospital waiting room",
          passiveSubject: "A queue ticket",
          passiveVerbV3: "taken",
          passiveWasOrIs: "was",
          adjBase: "patient",
          adjComp: "more patient",
          adjSuper: "most patient",
        },
        {
          sceneLabel: "in the hospital waiting room chairs",
          location: "in the hospital waiting room",
          mustRule: "sit quietly and respect the injured patients in the waiting room",
          mustntRule: "annoy or disturb the bandaged patient sitting next to him",
          shouldAction: "sit calmly on his chair while waiting for the doctor",
          shouldntAction: "fidget noisily and bother the other patients in the row",
          canAction: "sit on a chair in the hospital waiting room",
          cantAction: "make loud noise inside the quiet hospital ward",
          haveToAction: "share the waiting room benches with other patients",
          dontHaveToAction: "stand up the whole time while waiting for the nurse",
          verbBase: "wait",
          verbPast: "waited",
          verbV3: "waited",
          verbIng: "waiting",
          verbS: "waits",
          obj: "on the chair next to the bandaged patient in the hospital",
          passiveSubject: "The waiting room chairs",
          passiveVerbV3: "shared",
          passiveWasOrIs: "are" as any,
          adjBase: "quiet",
          adjComp: "quieter",
          adjSuper: "quietest",
        },
        {
          sceneLabel: "showing his stuck hand to the medical staff",
          location: "at the hospital clinic",
          mustRule: "explain his injury honestly to the doctor and nurse",
          mustntRule: "hide his stuck teapot hand when his turn finally arrives",
          shouldAction: "ask the doctor or nurse to help remove the stuck object",
          shouldntAction: "pull the stuck teapot off roughly by himself",
          canAction: "ask the hospital staff for medical help",
          cantAction: "use his hand properly while it is stuck inside the teapot",
          haveToAction: "show the nurse what happened to his hand",
          dontHaveToAction: "perform the medical treatment by himself",
          verbBase: "show",
          verbPast: "showed",
          verbV3: "shown",
          verbIng: "showing",
          verbS: "shows",
          obj: "his stuck hand at the hospital desk",
          passiveSubject: "The patient's injured hand",
          passiveVerbV3: "examined",
          passiveWasOrIs: "was",
          adjBase: "careful",
          adjComp: "more careful",
          adjSuper: "most careful",
        },
        {
          sceneLabel: "watching the electronic number board in the hospital",
          location: "by the hospital reception desk",
          mustRule: "watch the electronic display board and go when his number flashes",
          mustntRule: "push ahead of injured patients when the nurse calls a number",
          shouldAction: "listen carefully when the nurse calls the next patient",
          shouldntAction: "turn the ticket upside down and confuse the queue number",
          canAction: "read the red numbers on the hospital display screen",
          cantAction: "enter the examination room before his number is called",
          haveToAction: "look at the digital number board in the waiting room",
          dontHaveToAction: "shout his name across the hospital reception room",
          verbBase: "check",
          verbPast: "checked",
          verbV3: "checked",
          verbIng: "checking",
          verbS: "checks",
          obj: "the electronic number board in the hospital waiting room",
          passiveSubject: "The next ticket number",
          passiveVerbV3: "called",
          passiveWasOrIs: "was",
          adjBase: "polite",
          adjComp: "more polite",
          adjSuper: "most polite",
        },
        {
          sceneLabel: "inside the hospital corridor and treatment area",
          location: "inside the hospital corridor",
          mustRule: "follow the hospital signs and obey the medical staff's instructions",
          mustntRule: "touch medical equipment or bandages that belong to other patients",
          shouldAction: "walk carefully along the hospital corridor",
          shouldntAction: "run or cause chaos near the wheelchairs and stretchers",
          canAction: "follow the hospital signs to the treatment room",
          cantAction: "play with the hospital wheelchairs or bandages",
          haveToAction: "obey the safety rules inside the hospital building",
          dontHaveToAction: "wear a doctor's white coat as a visitor",
          verbBase: "follow",
          verbPast: "followed",
          verbV3: "followed",
          verbIng: "following",
          verbS: "follows",
          obj: "the signs along the hospital corridor",
          passiveSubject: "The hospital rules",
          passiveVerbV3: "followed",
          passiveWasOrIs: "was",
          adjBase: "safe",
          adjComp: "safer",
          adjSuper: "safest",
        }
      );
    }

    // 2. School / Exam / Classroom / Library / Study setting
    if (
      /\b(school|class|classroom|exam|test|student|teacher|homework|study|library|pencil|desk|math|science|chemistry|art class)\b/i.test(
        combinedText
      )
    ) {
      scenes.push(
        {
          sceneLabel: "at the desk during the classroom exam",
          location: "in the examination room",
          mustRule: "write his own answers quietly on the exam paper",
          mustntRule: "copy answers from the student sitting at the next desk",
          shouldAction: "prepare the right pens and pencils before the test starts",
          shouldntAction: "waste time taking out dozens of pens and toys on the desk",
          canAction: "use a pen and ruler to answer the test questions",
          cantAction: "talk loudly or look at another student's paper during the exam",
          haveToAction: "finish the exam before the timer runs out",
          dontHaveToAction: "bring twenty different pencils for one test",
          verbBase: "write",
          verbPast: "wrote",
          verbV3: "written",
          verbIng: "writing",
          verbS: "writes",
          obj: "the answers on the exam paper at the desk",
          passiveSubject: "The exam paper",
          passiveVerbV3: "written",
          passiveWasOrIs: "was",
          adjBase: "quiet",
          adjComp: "quieter",
          adjSuper: "quietest",
        },
        {
          sceneLabel: "when the teacher is watching the classroom",
          location: "inside the classroom",
          mustRule: "stop writing immediately when the teacher says time is up",
          mustntRule: "cheat or make loud noises while the class is working",
          shouldAction: "read the instructions on the exam envelope carefully",
          shouldntAction: "study the wrong subject the night before the exam",
          canAction: "raise his hand if he needs help from the teacher",
          cantAction: "keep writing after the exam bell rings",
          haveToAction: "listen to the teacher's instructions at the start of class",
          dontHaveToAction: "answer both papers if only one is required",
          verbBase: "open",
          verbPast: "opened",
          verbV3: "opened",
          verbIng: "opening",
          verbS: "opens",
          obj: "the question paper on the classroom desk",
          passiveSubject: "The test envelope",
          passiveVerbV3: "opened",
          passiveWasOrIs: "was",
          adjBase: "careful",
          adjComp: "more careful",
          adjSuper: "most careful",
        }
      );
    }

    // 3. Restaurant / Kitchen / Cooking / Food / Cafe / Dinner setting
    if (
      /\b(restaurant|kitchen|cook|food|dinner|lunch|breakfast|eat|waiter|menu|steak|pizza|sandwich|cake|coffee|tea|cafe|turkey)\b/i.test(
        combinedText
      )
    ) {
      scenes.push(
        {
          sceneLabel: "at the table with the food and menu",
          location: "at the dining table",
          mustRule: "use clean cutlery and behave politely at the table",
          mustntRule: "hide unwanted food inside napkins, flowerpots, or someone's bag",
          shouldAction: "order a dish from the menu that he actually likes to eat",
          shouldntAction: "make a mess with the food when the waiter is not looking",
          canAction: "read the menu and choose a meal at the table",
          cantAction: "throw food around the dining room",
          haveToAction: "pay the bill after finishing the meal",
          dontHaveToAction: "cook the meal himself at a restaurant",
          verbBase: "order",
          verbPast: "ordered",
          verbV3: "ordered",
          verbIng: "ordering",
          verbS: "orders",
          obj: "a special meal from the menu at the table",
          passiveSubject: "The meal",
          passiveVerbV3: "served",
          passiveWasOrIs: "was",
          adjBase: "polite",
          adjComp: "more polite",
          adjSuper: "most polite",
        },
        {
          sceneLabel: "while preparing and serving the food",
          location: "in the food preparation scene",
          mustRule: "wash his hands and handle the food safely and cleanly",
          mustntRule: "drop personal items into the food while preparing it",
          shouldAction: "follow the recipe carefully step by step",
          shouldntAction: "rush and spill ingredients all over the counter",
          canAction: "use plates and utensils to serve the food neatly",
          cantAction: "serve spoiled or raw food to the guests",
          haveToAction: "keep the kitchen and table clean while preparing food",
          dontHaveToAction: "eat everything on the plate in one single bite",
          verbBase: "prepare",
          verbPast: "prepared",
          verbV3: "prepared",
          verbIng: "preparing",
          verbS: "prepares",
          obj: "the food carefully in this scene",
          passiveSubject: "The food",
          passiveVerbV3: "prepared",
          passiveWasOrIs: "was",
          adjBase: "clean",
          adjComp: "cleaner",
          adjSuper: "cleanest",
        }
      );
    }

    // 4. Holiday / Travel / Hotel / Swimming Pool / Beach / Airport / Train setting
    if (
      /\b(holiday|vacation|hotel|pool|swim|beach|airport|plane|flight|train|ticket|luggage|suitcase|passport)\b/i.test(
        combinedText
      )
    ) {
      scenes.push(
        {
          sceneLabel: "during the travel and check-in scene",
          location: "at the travel check-in desk",
          mustRule: "show his ticket or booking confirmation at the check-in desk",
          mustntRule: "push past other travellers or take someone else's luggage",
          shouldAction: "keep his ticket and suitcase in a safe place",
          shouldntAction: "wait until the last second to pack and find his ticket",
          canAction: "check in at the counter with his suitcase",
          cantAction: "board or enter without a valid ticket",
          haveToAction: "follow the safety rules during the journey",
          dontHaveToAction: "carry everyone else's heavy bags",
          verbBase: "carry",
          verbPast: "carried",
          verbV3: "carried",
          verbIng: "carrying",
          verbS: "carries",
          obj: "his suitcase during the travel scene",
          passiveSubject: "The ticket",
          passiveVerbV3: "checked",
          passiveWasOrIs: "was",
          adjBase: "fast",
          adjComp: "faster",
          adjSuper: "fastest",
        }
      );
    }

    // 5. Driving / Car / Parking / Traffic / Shopping / City street setting
    if (
      /\b(car|drive|driving|mini|park|parking|traffic|road|street|shop|shopping|store|supermarket)\b/i.test(
        combinedText
      )
    ) {
      scenes.push(
        {
          sceneLabel: "while driving and parking the green car",
          location: "on the street and parking area",
          mustRule: "obey the traffic signs and park only in allowed spaces",
          mustntRule: "drive carelessly or push another car out of the way",
          shouldAction: "check the mirrors and watch out for other vehicles",
          shouldntAction: "park in a restricted or emergency zone",
          canAction: "steer the small green car into a tight parking space",
          cantAction: "ignore road safety rules on a busy street",
          haveToAction: "lock the car door carefully after parking",
          dontHaveToAction: "take the steering wheel off every normal car",
          verbBase: "drive",
          verbPast: "drove",
          verbV3: "driven",
          verbIng: "driving",
          verbS: "drives",
          obj: "his car into the scene",
          passiveSubject: "The green car",
          passiveVerbV3: "driven",
          passiveWasOrIs: "was",
          adjBase: "careful",
          adjComp: "more careful",
          adjSuper: "most careful",
        }
      );
    }

    // 6. Add any explicit chapters from the scanned YouTube video
    if (Array.isArray(chaptersRaw) && chaptersRaw.length > 0) {
      chaptersRaw.slice(0, 8).forEach((ch) => {
        const cleanChap = ch.title.replace(/[^\w\s'-]/g, "").trim();
        if (cleanChap.length > 2) {
          scenes.push({
            sceneLabel: `in the "${cleanChap}" scene`,
            location: `during the "${cleanChap}" scene`,
            mustRule: `pay attention and follow the rules during "${cleanChap}"`,
            mustntRule: `make a careless mistake or cause trouble during "${cleanChap}"`,
            shouldAction: `stay calm and act sensibly in the "${cleanChap}" scene`,
            shouldntAction: `make the problem worse during "${cleanChap}"`,
            canAction: `see what happens next in the "${cleanChap}" scene`,
            cantAction: `solve the problem by breaking the rules in "${cleanChap}"`,
            haveToAction: `deal with the situation carefully in "${cleanChap}"`,
            dontHaveToAction: `panic when something unexpected happens in "${cleanChap}"`,
            verbBase: "watch",
            verbPast: "watched",
            verbV3: "watched",
            verbIng: "watching",
            verbS: "watches",
            obj: `what happens in the "${cleanChap}" scene`,
            passiveSubject: `The "${cleanChap}" scene`,
            passiveVerbV3: "shown",
            passiveWasOrIs: "is",
            adjBase: "funny",
            adjComp: "funnier",
            adjSuper: "funniest",
          });
        }
      });
    }

    // 7. Universal video-title-specific scenes if no specialized category matched (or to supplement)
    const cleanTitle = (videoTitleRaw || "").replace(/\s*\|.*$/, "").trim() || "this video clip";
    if (scenes.length < 6) {
      const genericAdditions: ScannedVideoScene[] = [
        {
          sceneLabel: `at the start of "${cleanTitle}"`,
          location: `in "${cleanTitle}"`,
          mustRule: `follow the rules and pay attention to what is happening around ${subject === "They" ? "them" : "him"}`,
          mustntRule: `break the rules or cause an accident in "${cleanTitle}"`,
          shouldAction: `think carefully before acting in "${cleanTitle}"`,
          shouldntAction: `rush into a silly mistake without looking first`,
          canAction: `Look closely at the problem in "${cleanTitle}"`,
          cantAction: `ignore the rules without getting into trouble`,
          haveToAction: `find a smart way to solve the problem in "${cleanTitle}"`,
          dontHaveToAction: `make a big mess to solve a simple problem`,
          verbBase: "arrive",
          verbPast: "arrived",
          verbV3: "arrived",
          verbIng: "arriving",
          verbS: "arrives",
          obj: `at the main location in "${cleanTitle}"`,
          passiveSubject: "The main problem",
          passiveVerbV3: "caused",
          passiveWasOrIs: "was",
          adjBase: "careful",
          adjComp: "more careful",
          adjSuper: "most careful",
        },
        {
          sceneLabel: `when the problem starts in "${cleanTitle}"`,
          location: `in this scene of "${cleanTitle}"`,
          mustRule: `stay calm and be respectful to the other people in the scene`,
          mustntRule: `annoy or push the other people in "${cleanTitle}"`,
          shouldAction: `ask for help politely when something goes wrong`,
          shouldntAction: `hide the mistake or blame someone else in the room`,
          canAction: `ask another person in the scene for help`,
          cantAction: `fix the mistake by causing even more chaos`,
          haveToAction: `wait patiently for the right moment to act`,
          dontHaveToAction: `push ahead of everyone else in the scene`,
          verbBase: "try",
          verbPast: "tried",
          verbV3: "tried",
          verbIng: "trying",
          verbS: "tries",
          obj: `to fix the problem in "${cleanTitle}"`,
          passiveSubject: "A funny plan",
          passiveVerbV3: "tried",
          passiveWasOrIs: "was",
          adjBase: "patient",
          adjComp: "more patient",
          adjSuper: "most patient",
        },
        {
          sceneLabel: `during the middle scene of "${cleanTitle}"`,
          location: `in the middle of "${cleanTitle}"`,
          mustRule: `keep the area safe and follow the instructions on the signs`,
          mustntRule: `touch things that belong to other people in "${cleanTitle}"`,
          shouldAction: `use the equipment properly and safely`,
          shouldntAction: `do something dangerous or against the rules`,
          canAction: `see how the other people react in "${cleanTitle}"`,
          cantAction: `break the rules when everyone is watching`,
          haveToAction: `follow the instructions shown in the scene`,
          dontHaveToAction: `cause trouble for the other characters`,
          verbBase: "look",
          verbPast: "looked",
          verbV3: "looked",
          verbIng: "looking",
          verbS: "looks",
          obj: `around the room in "${cleanTitle}"`,
          passiveSubject: "The instructions",
          passiveVerbV3: "followed",
          passiveWasOrIs: "was",
          adjBase: "safe",
          adjComp: "safer",
          adjSuper: "safest",
        },
        {
          sceneLabel: `near the end of "${cleanTitle}"`,
          location: `toward the end of "${cleanTitle}"`,
          mustRule: `learn from the mistake and follow the proper rule next time`,
          mustntRule: `repeat the same silly mistake at the end of "${cleanTitle}"`,
          shouldAction: `apologize and clean up any mess before leaving`,
          shouldntAction: `leave a big mess behind for other people`,
          canAction: `see the funny result at the end of "${cleanTitle}"`,
          cantAction: `escape the consequences of breaking the rules`,
          haveToAction: `face the result of the actions at the end of the clip`,
          dontHaveToAction: `make the same mistake again`,
          verbBase: "finish",
          verbPast: "finished",
          verbV3: "finished",
          verbIng: "finishing",
          verbS: "finishes",
          obj: `the funny adventure in "${cleanTitle}"`,
          passiveSubject: "The lesson",
          passiveVerbV3: "learned",
          passiveWasOrIs: "was",
          adjBase: "good",
          adjComp: "better",
          adjSuper: "best",
        },
      ];
      for (const add of genericAdditions) {
        if (scenes.length < 6) scenes.push(add);
      }
    }

    return scenes;
  };

  const buildFallbackVideoQuizQuestions = (
    topicRaw: string,
    levelRaw: string,
    typesRaw: string[],
    countRaw?: number,
    videoTitleRaw?: string,
    videoDurationRaw?: number,
    videoDescriptionRaw?: string,
    chaptersRaw?: Array<{ title: string; sec: number }>
  ) => {
    const rawTopicClean = (topicRaw || "").trim();
    const topicLower = rawTopicClean.toLowerCase();
    const count = Math.max(1, Math.min(100, Number(countRaw) || 5));
    const types =
      Array.isArray(typesRaw) && typesRaw.length > 0
        ? typesRaw
        : ["Fill in the Blanks", "Multiple Choice", "Grammar Choice"];
    const subject = extractVideoSubject(videoTitleRaw, topicRaw);
    const isPluralSubject =
      /\b(and|they|minions|kids|students|animals|friends|people)\b/i.test(subject);
    const subjPronoun = isPluralSubject ? "they" : "he";
    const hasAux = isPluralSubject ? "have" : "has";
    const hasNeg = isPluralSubject ? "haven't" : "hasn't";
    const wrongAux = isPluralSubject ? "has" : "have";
    const wasAux = isPluralSubject ? "were" : "was";
    const wrongWasAux = isPluralSubject ? "was" : "were";
    const isAux = isPluralSubject ? "are" : "is";
    const wrongIsAux = isPluralSubject ? "is" : "are";
    const doesAux = isPluralSubject ? "do" : "does";
    const doesntAux = isPluralSubject ? "don't" : "doesn't";
    const haveToPos = isPluralSubject ? "have to" : "has to";
    const haveToNeg = isPluralSubject ? "don't have to" : "doesn't have to";

    const cleanVideoTitle = (videoTitleRaw || "").replace(/\s*\|.*$/, "").trim();
    const videoContextLabel = cleanVideoTitle ? `in "${cleanVideoTitle}"` : "in this video";

    const duration = Math.max(60, Number(videoDurationRaw) || 540);
    // Distribute questions evenly across 5% to 94% of the real video duration
    const usableStart = Math.max(8, Math.floor(duration * 0.04));
    const usableSpan = Math.max(30, Math.floor(duration * 0.90) - usableStart);

    const dynamicScenes = extractDynamicScenesFromVideo(
      videoTitleRaw,
      videoDescriptionRaw,
      chaptersRaw,
      subject
    );

    type QuizTemplate = {
      type: string;
      question: string;
      answer: string;
      acceptedAnswers?: string[];
      options: Array<{ text: string; isCorrect: boolean }>;
      explanation: string;
    };

    let bank: QuizTemplate[] = [];

    // =========================================================================
    // 1. MUST AND MUSTN'T / MUST & MUST NOT (Obligation & Prohibition)
    // =========================================================================
    if (/\bmust\b|\bmustn'?t\b|\bmust\s+not\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Look at ${subject} ${sc.sceneLabel}: ${subject} ____ (must / mustn't) ${sc.mustntRule}.`,
            answer: "mustn't",
            acceptedAnswers: ["mustn't", "must not", "mustnt"],
            options: [
              { text: "mustn't", isCorrect: true },
              { text: "must", isCorrect: false },
              { text: "must to", isCorrect: false },
              { text: "musts", isCorrect: false },
            ],
            explanation: `We use "mustn't" (must not) for prohibition — something that is against the rules or not allowed ${sc.location}.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Complete the rule ${sc.location}: "${subject} ____ (must / mustn't) ${sc.mustRule}."`,
            answer: "must",
            acceptedAnswers: ["must"],
            options: [
              { text: "must", isCorrect: true },
              { text: "mustn't", isCorrect: false },
              { text: "musts", isCorrect: false },
              { text: "must to", isCorrect: false },
            ],
            explanation: `We use "must + base verb" for strong obligation and important rules ${sc.location}.`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct modal verb of obligation/prohibition ${sc.sceneLabel}: "Visitors and patients ____ ${sc.mustntRule}!"`,
            answer: "mustn't",
            acceptedAnswers: ["mustn't", "must not"],
            options: [
              { text: "mustn't", isCorrect: true },
              { text: "must", isCorrect: false },
              { text: "must to", isCorrect: false },
              { text: "don't must", isCorrect: false },
            ],
            explanation: `"Mustn't" means it is forbidden. Note that we never say "don't must" or "must to".`,
          },
          {
            type: "Multiple Choice",
            question: `Which sentence uses "must" or "mustn't" with the correct grammar ${sc.sceneLabel}?`,
            answer: `${subject} must ${sc.mustRule}.`,
            acceptedAnswers: [`${subject} must ${sc.mustRule}.`, "must"],
            options: [
              { text: `${subject} must ${sc.mustRule}.`, isCorrect: true },
              { text: `${subject} musts ${sc.mustRule}.`, isCorrect: false },
              { text: `${subject} must to ${sc.mustRule}.`, isCorrect: false },
              { text: `${subject} musting ${sc.mustRule}.`, isCorrect: false },
            ],
            explanation: `After "must" or "mustn't", we always use the base form of the verb (infinitive without "to" and without "-s").`,
          },
          {
            type: "Fill in the Blanks",
            question: `After "must" or "mustn't", use the base verb: "${subject} must ____ (${sc.verbBase}) carefully ${sc.location}."`,
            answer: sc.verbBase,
            acceptedAnswers: [sc.verbBase, `must ${sc.verbBase}`],
            options: [
              { text: sc.verbBase, isCorrect: true },
              { text: `to ${sc.verbBase}`, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `Modal verbs ("must" and "mustn't") are followed directly by the base verb "${sc.verbBase}".`,
          }
        );
      });
    }
    // =========================================================================
    // 2. SHOULD AND SHOULDN'T (Advice & Recommendations)
    // =========================================================================
    else if (/\bshould\b|\bshouldn'?t\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Give ${subject} good advice ${sc.sceneLabel}: "${subject} ____ (should / shouldn't) ${sc.shouldntAction}."`,
            answer: "shouldn't",
            acceptedAnswers: ["shouldn't", "should not", "shouldnt"],
            options: [
              { text: "shouldn't", isCorrect: true },
              { text: "should", isCorrect: false },
              { text: "should to", isCorrect: false },
              { text: "shoulds", isCorrect: false },
            ],
            explanation: `We use "shouldn't" to advise someone not to do something unwise ${sc.location}.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Complete the advice ${sc.location}: "${subject} ____ (should / shouldn't) ${sc.shouldAction}."`,
            answer: "should",
            acceptedAnswers: ["should"],
            options: [
              { text: "should", isCorrect: true },
              { text: "shouldn't", isCorrect: false },
              { text: "shoulds", isCorrect: false },
              { text: "should to", isCorrect: false },
            ],
            explanation: `We use "should + base verb" to give positive advice about the best thing to do.`,
          },
          {
            type: "Grammar Choice",
            question: `Which sentence gives grammatically correct advice ${sc.sceneLabel}?`,
            answer: `${subject} should ${sc.shouldAction}.`,
            options: [
              { text: `${subject} should ${sc.shouldAction}.`, isCorrect: true },
              { text: `${subject} should to ${sc.shouldAction}.`, isCorrect: false },
              { text: `${subject} shoulds ${sc.shouldAction}.`, isCorrect: false },
              { text: `${subject} don't should ${sc.shouldntAction}.`, isCorrect: false },
            ],
            explanation: `"Should" and "shouldn't" are followed by the base verb without "to".`,
          }
        );
      });
    }
    // =========================================================================
    // 3. CAN AND CAN'T / COULD AND COULDN'T (Ability & Permission)
    // =========================================================================
    else if (/\bcan\b|\bcan'?t\b|\bcannot\b|\bcould\b|\bcouldn'?t\b/i.test(topicLower)) {
      const useCould = /\bcould/i.test(topicLower);
      const posModal = useCould ? "could" : "can";
      const negModal = useCould ? "couldn't" : "can't";
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Look at ${subject} ${sc.sceneLabel}: ${subject} ____ (${posModal} / ${negModal}) ${sc.cantAction}.`,
            answer: negModal,
            acceptedAnswers: [negModal, useCould ? "could not" : "cannot", useCould ? "couldnt" : "cant"],
            options: [
              { text: negModal, isCorrect: true },
              { text: posModal, isCorrect: false },
              { text: `${posModal} to`, isCorrect: false },
              { text: `${posModal}s`, isCorrect: false },
            ],
            explanation: `We use "${negModal}" to show that something is not possible or not permitted ${sc.location}.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Complete the sentence ${sc.location}: "${subject} ____ (${posModal} / ${negModal}) ${sc.canAction}."`,
            answer: posModal,
            acceptedAnswers: [posModal],
            options: [
              { text: posModal, isCorrect: true },
              { text: negModal, isCorrect: false },
              { text: `${posModal} to`, isCorrect: false },
              { text: `${posModal}s`, isCorrect: false },
            ],
            explanation: `We use "${posModal} + base verb" to describe ability or what is possible in the scene.`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct sentence with "${posModal} / ${negModal}" ${sc.sceneLabel}:`,
            answer: `${subject} ${negModal} ${sc.cantAction}.`,
            options: [
              { text: `${subject} ${negModal} ${sc.cantAction}.`, isCorrect: true },
              { text: `${subject} ${posModal}s ${sc.canAction}.`, isCorrect: false },
              { text: `${subject} ${posModal} to ${sc.canAction}.`, isCorrect: false },
              { text: `${subject} don't ${posModal} ${sc.cantAction}.`, isCorrect: false },
            ],
            explanation: `Modal verb "${posModal} / ${negModal}" takes the base verb directly without "to" or "-s".`,
          }
        );
      });
    }
    // =========================================================================
    // 4. HAVE TO / HAS TO / DON'T HAVE TO / DOESN'T HAVE TO
    // =========================================================================
    else if (/\bhave\s+to\b|\bhas\s+to\b|\bdon'?t\s+have\s+to\b|\bdoesn'?t\s+have\s+to\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the sentence ${sc.sceneLabel}: "${subject} ____ (${haveToPos} / ${haveToNeg}) ${sc.haveToAction}."`,
            answer: haveToPos,
            acceptedAnswers: [haveToPos, "must"],
            options: [
              { text: haveToPos, isCorrect: true },
              { text: haveToNeg, isCorrect: false },
              { text: isPluralSubject ? "has to" : "have to", isCorrect: false },
              { text: "having to", isCorrect: false },
            ],
            explanation: `With "${subject}", we use "${haveToPos} + base verb" to show that something is necessary.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Complete the sentence ${sc.location}: "${subject} ____ (${haveToPos} / ${haveToNeg}) ${sc.dontHaveToAction}."`,
            answer: haveToNeg,
            acceptedAnswers: [haveToNeg],
            options: [
              { text: haveToNeg, isCorrect: true },
              { text: haveToPos, isCorrect: false },
              { text: isPluralSubject ? "doesn't have to" : "don't have to", isCorrect: false },
              { text: "haven't to", isCorrect: false },
            ],
            explanation: `We use "${haveToNeg}" when something is NOT necessary.`,
          }
        );
      });
    }
    // =========================================================================
    // 5. PRESENT PERFECT
    // =========================================================================
    else if (
      topicLower.includes("present perf") ||
      topicLower.includes("present per") ||
      /\b(have|has)\s*\+\s*(past participle|v3|pp)\b/i.test(topicLower) ||
      /\b(just|already|yet|ever|never|since|for)\b/i.test(topicLower)
    ) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the Present Perfect sentence ${sc.sceneLabel}: "${subject} ${hasAux} ____ (${sc.verbBase}) ${sc.obj}."`,
            answer: sc.verbV3,
            acceptedAnswers: [sc.verbV3, `${hasAux} ${sc.verbV3}`],
            options: [
              { text: sc.verbV3, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `In the Present Perfect, after "${hasAux}" we use the past participle (V3) "${sc.verbV3}".`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct Present Perfect form ${sc.sceneLabel}: "${subject} ____ just ____ ${sc.obj}!"`,
            answer: `${hasAux} ${sc.verbV3}`,
            acceptedAnswers: [`${hasAux} ${sc.verbV3}`, sc.verbV3],
            options: [
              { text: `${hasAux} ... ${sc.verbV3}`, isCorrect: true },
              { text: `${wrongAux} ... ${sc.verbBase}`, isCorrect: false },
              { text: `did ... ${sc.verbV3}`, isCorrect: false },
              { text: `${isAux} ... ${sc.verbIng}`, isCorrect: false },
            ],
            explanation: `Present Perfect uses "${hasAux} + just + past participle (${sc.verbV3})" for a recent action with a result now.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Fill in "have" or "has" ${sc.location}: "${subject} ____ ${sc.verbV3} ${sc.obj}."`,
            answer: hasAux,
            acceptedAnswers: [hasAux, `${hasAux} ${sc.verbV3}`],
            options: [
              { text: hasAux, isCorrect: true },
              { text: wrongAux, isCorrect: false },
              { text: "did", isCorrect: false },
              { text: wasAux, isCorrect: false },
            ],
            explanation: `With "${subject}", we use the auxiliary verb "${hasAux}" in the Present Perfect.`,
          },
          {
            type: "Multiple Choice",
            question: `Which sentence about ${subject} ${sc.location} is in the Present Perfect tense?`,
            answer: `${subject} ${hasAux} already ${sc.verbV3} ${sc.obj}.`,
            options: [
              { text: `${subject} ${hasAux} already ${sc.verbV3} ${sc.obj}.`, isCorrect: true },
              { text: `${subject} ${sc.verbPast} ${sc.obj} yesterday.`, isCorrect: false },
              { text: `${subject} ${isAux} ${sc.verbIng} ${sc.obj} right now.`, isCorrect: false },
              { text: `${subject} will ${sc.verbBase} ${sc.obj} tomorrow.`, isCorrect: false },
            ],
            explanation: `"${hasAux} already ${sc.verbV3}" is in the Present Perfect tense (have/has + V3).`,
          }
        );
      });
    }
    // =========================================================================
    // 6. PAST SIMPLE
    // =========================================================================
    else if (topicLower.includes("past simple") || topicLower.includes("simple past")) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the Past Simple sentence ${sc.sceneLabel}: "${subject} ____ (${sc.verbBase}) ${sc.obj}."`,
            answer: sc.verbPast,
            acceptedAnswers: [sc.verbPast],
            options: [
              { text: sc.verbPast, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `The Past Simple form of "${sc.verbBase}" is "${sc.verbPast}".`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct Past Simple negative sentence ${sc.sceneLabel}:`,
            answer: `${subject} didn't ${sc.verbBase} carefully ${sc.location}.`,
            options: [
              { text: `${subject} didn't ${sc.verbBase} carefully ${sc.location}.`, isCorrect: true },
              { text: `${subject} didn't ${sc.verbPast} carefully ${sc.location}.`, isCorrect: false },
              { text: `${subject} ${doesntAux} ${sc.verbPast} carefully ${sc.location}.`, isCorrect: false },
              { text: `${subject} not ${sc.verbPast} carefully ${sc.location}.`, isCorrect: false },
            ],
            explanation: `In Past Simple negative sentences, we use "didn't + base verb (${sc.verbBase})".`,
          },
          {
            type: "Multiple Choice",
            question: `Which Past Simple question asks about what happened ${sc.sceneLabel}?`,
            answer: `What did ${subject} ${sc.verbBase} ${sc.location}?`,
            options: [
              { text: `What did ${subject} ${sc.verbBase} ${sc.location}?`, isCorrect: true },
              { text: `What did ${subject} ${sc.verbPast} ${sc.location}?`, isCorrect: false },
              { text: `What ${wasAux} ${subject} ${sc.verbBase} ${sc.location}?`, isCorrect: false },
              { text: `What ${doesAux} ${subject} ${sc.verbPast} ${sc.location}?`, isCorrect: false },
            ],
            explanation: `Past Simple questions use "Did + subject + base verb (${sc.verbBase})?".`,
          }
        );
      });
    }
    // =========================================================================
    // 7. PRESENT CONTINUOUS / PAST CONTINUOUS
    // =========================================================================
    else if (
      topicLower.includes("continuous") ||
      topicLower.includes("progressive")
    ) {
      const isPastCont = topicLower.includes("past");
      const beAux = isPastCont ? wasAux : isAux;
      const wrongBe = isPastCont ? wrongWasAux : wrongIsAux;
      const tenseLabel = isPastCont ? "Past Continuous" : "Present Continuous";
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the ${tenseLabel} sentence ${sc.sceneLabel}: "${subject} ${beAux} ____ (${sc.verbBase}) ${sc.obj}."`,
            answer: sc.verbIng,
            acceptedAnswers: [sc.verbIng, `${beAux} ${sc.verbIng}`],
            options: [
              { text: sc.verbIng, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbPast, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `${tenseLabel} uses "${beAux} + verb-ing (${sc.verbIng})".`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct ${tenseLabel} sentence ${sc.sceneLabel}:`,
            answer: `${subject} ${beAux} ${sc.verbIng} ${sc.obj}.`,
            options: [
              { text: `${subject} ${beAux} ${sc.verbIng} ${sc.obj}.`, isCorrect: true },
              { text: `${subject} ${wrongBe} ${sc.verbIng} ${sc.obj}.`, isCorrect: false },
              { text: `${subject} ${beAux} ${sc.verbBase} ${sc.obj}.`, isCorrect: false },
              { text: `${subject} ${sc.verbIng} ${sc.obj}.`, isCorrect: false },
            ],
            explanation: `With "${subject}", we use "${beAux} + ${sc.verbIng}".`,
          }
        );
      });
    }
    // =========================================================================
    // 8. PRESENT SIMPLE
    // =========================================================================
    else if (topicLower.includes("present simple") || topicLower.includes("simple present")) {
      const targetVerbForm = isPluralSubject ? "base" : "s";
      dynamicScenes.forEach((sc) => {
        const correctForm = targetVerbForm === "s" ? sc.verbS : sc.verbBase;
        const wrongForm = targetVerbForm === "s" ? sc.verbBase : sc.verbS;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the Present Simple sentence ${sc.sceneLabel}: "${subject} ____ (${sc.verbBase}) ${sc.obj}."`,
            answer: correctForm,
            acceptedAnswers: [correctForm],
            options: [
              { text: correctForm, isCorrect: true },
              { text: wrongForm, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbPast, isCorrect: false },
            ],
            explanation: `In the Present Simple with "${subject}", we use "${correctForm}".`,
          },
          {
            type: "Grammar Choice",
            question: `Choose the correct Present Simple negative sentence ${sc.sceneLabel}:`,
            answer: `${subject} ${doesntAux} ${sc.verbBase} ${sc.obj}.`,
            options: [
              { text: `${subject} ${doesntAux} ${sc.verbBase} ${sc.obj}.`, isCorrect: true },
              { text: `${subject} ${doesntAux} ${sc.verbS} ${sc.obj}.`, isCorrect: false },
              { text: `${subject} ${isPluralSubject ? "doesn't" : "don't"} ${sc.verbBase} ${sc.obj}.`, isCorrect: false },
              { text: `${subject} not ${sc.verbBase} ${sc.obj}.`, isCorrect: false },
            ],
            explanation: `Present Simple negatives use "${doesntAux} + base verb (${sc.verbBase})".`,
          }
        );
      });
    }
    // =========================================================================
    // 9. PASSIVE VOICE
    // =========================================================================
    else if (topicLower.includes("passive")) {
      dynamicScenes.forEach((sc) => {
        const auxWord = sc.passiveWasOrIs;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the Passive Voice sentence ${sc.sceneLabel}: "${sc.passiveSubject} ${auxWord} ____ ${sc.location}."`,
            answer: sc.passiveVerbV3,
            acceptedAnswers: [sc.passiveVerbV3, `${auxWord} ${sc.passiveVerbV3}`],
            options: [
              { text: sc.passiveVerbV3, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `The Passive Voice is formed with "be (${auxWord}) + past participle (${sc.passiveVerbV3})".`,
          },
          {
            type: "Grammar Choice",
            question: `Which sentence ${sc.sceneLabel} is written in the Passive Voice?`,
            answer: `${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3} ${sc.location}.`,
            options: [
              { text: `${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3} ${sc.location}.`, isCorrect: true },
              { text: `${subject} ${sc.verbPast} ${sc.obj}.`, isCorrect: false },
              { text: `${subject} ${isAux} ${sc.verbIng} ${sc.obj}.`, isCorrect: false },
              { text: `${sc.passiveSubject} ${sc.verbBase} ${sc.location}.`, isCorrect: false },
            ],
            explanation: `"${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3}" places the receiver of the action first (Passive Voice).`,
          }
        );
      });
    }
    // =========================================================================
    // 10. CONDITIONALS (First / Second / Zero / If-clauses)
    // =========================================================================
    else if (topicLower.includes("conditional") || /\bif\s+clause/i.test(topicLower)) {
      dynamicScenes.forEach((sc) => {
        const presForm = isPluralSubject ? sc.verbBase : sc.verbS;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the First Conditional sentence ${sc.sceneLabel}: "If ${subject} ____ (${sc.verbBase}) ${sc.obj}, everyone will notice!"`,
            answer: presForm,
            acceptedAnswers: [presForm],
            options: [
              { text: presForm, isCorrect: true },
              { text: `will ${sc.verbBase}`, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: `would ${sc.verbBase}`, isCorrect: false },
            ],
            explanation: `In a First Conditional sentence, the "If"-clause uses the Present Simple ("${presForm}"), and the main clause uses "will + base verb".`,
          },
          {
            type: "Grammar Choice",
            question: `Complete the Second Conditional sentence ${sc.sceneLabel}: "If ${subject} ${sc.verbPast} more carefully ${sc.location}, ${subjPronoun} ____ get into trouble."`,
            answer: "wouldn't",
            acceptedAnswers: ["wouldn't", "would not"],
            options: [
              { text: "wouldn't", isCorrect: true },
              { text: "won't", isCorrect: false },
              { text: "didn't", isCorrect: false },
              { text: "don't", isCorrect: false },
            ],
            explanation: `Second Conditional uses "If + Past Simple, ... would / wouldn't + base verb".`,
          }
        );
      });
    }
    // =========================================================================
    // 11. COMPARATIVES AND SUPERLATIVES
    // =========================================================================
    else if (topicLower.includes("comparative") || topicLower.includes("superlative")) {
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the comparative sentence ${sc.sceneLabel}: "${subject} should be ____ (${sc.adjBase}) than before ${sc.location}."`,
            answer: sc.adjComp,
            acceptedAnswers: [sc.adjComp],
            options: [
              { text: sc.adjComp, isCorrect: true },
              { text: sc.adjBase, isCorrect: false },
              { text: sc.adjSuper, isCorrect: false },
              { text: `more ${sc.adjComp}`, isCorrect: false },
            ],
            explanation: `Before "than", we use the comparative form "${sc.adjComp}".`,
          },
          {
            type: "Grammar Choice",
            question: `Complete the superlative sentence ${sc.sceneLabel}: "What is the ____ (${sc.adjBase}) thing to do ${sc.location}?"`,
            answer: sc.adjSuper,
            acceptedAnswers: [sc.adjSuper],
            options: [
              { text: sc.adjSuper, isCorrect: true },
              { text: sc.adjComp, isCorrect: false },
              { text: sc.adjBase, isCorrect: false },
              { text: `most ${sc.adjSuper}`, isCorrect: false },
            ],
            explanation: `After "the", we use the superlative adjective "${sc.adjSuper}".`,
          }
        );
      });
    }
    // =========================================================================
    // 12. ANY BINARY / CONTRAST TOPIC ("X and Y", "X vs Y", "X or Y", "X / Y")
    // =========================================================================
    else if (/\b(and|vs\.?|or|\/)\b/i.test(rawTopicClean)) {
      const parts = rawTopicClean
        .split(/\s+(?:and|vs\.?|or|\/)\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
      const choiceA = (parts[0] || rawTopicClean).toLowerCase();
      const choiceB = (parts[1] || `not ${choiceA}`).toLowerCase();
      dynamicScenes.forEach((sc) => {
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `Complete the sentence ${sc.sceneLabel} using "${choiceA}" or "${choiceB}": "${subject} ____ (${choiceA} / ${choiceB}) ${sc.mustRule}."`,
            answer: choiceA,
            acceptedAnswers: [choiceA],
            options: [
              { text: choiceA, isCorrect: true },
              { text: choiceB, isCorrect: false },
              { text: `${choiceA} to`, isCorrect: false },
              { text: `${choiceB}s`, isCorrect: false },
            ],
            explanation: `In this positive rule ${sc.location}, "${choiceA}" is the accurate choice.`,
          },
          {
            type: "Fill in the Blanks",
            question: `Complete the sentence ${sc.sceneLabel} using "${choiceA}" or "${choiceB}": "${subject} ____ (${choiceA} / ${choiceB}) ${sc.mustntRule}."`,
            answer: choiceB,
            acceptedAnswers: [choiceB],
            options: [
              { text: choiceB, isCorrect: true },
              { text: choiceA, isCorrect: false },
              { text: `${choiceB} to`, isCorrect: false },
              { text: `${choiceA}s`, isCorrect: false },
            ],
            explanation: `In this negative/prohibited action ${sc.location}, "${choiceB}" is the accurate choice.`,
          },
          {
            type: "Grammar Choice",
            question: `Choose "${choiceA}" or "${choiceB}" for ${subject} ${sc.sceneLabel}: "${subject} ____ ${sc.mustntRule}!"`,
            answer: choiceB,
            acceptedAnswers: [choiceB],
            options: [
              { text: choiceB, isCorrect: true },
              { text: choiceA, isCorrect: false },
              { text: `to ${choiceA}`, isCorrect: false },
              { text: `be ${choiceB}`, isCorrect: false },
            ],
            explanation: `"${choiceB}" fits this sentence ${sc.location}.`,
          }
        );
      });
    }
    // =========================================================================
    // 13. CUSTOM TOPIC OR BLANK TOPIC (Pure Scene-Scanned Video Questions)
    // =========================================================================
    else {
      dynamicScenes.forEach((sc) => {
        const topicHint = rawTopicClean ? ` (${rawTopicClean})` : "";
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `In the scene ${sc.sceneLabel}${topicHint}, ${subject} ____ (${sc.verbBase}) ${sc.obj}.`,
            answer: sc.verbPast,
            acceptedAnswers: [sc.verbPast, sc.verbS, sc.verbBase, `${isAux} ${sc.verbIng}`, `${hasAux} ${sc.verbV3}`],
            options: [
              { text: sc.verbPast, isCorrect: true },
              { text: sc.verbIng, isCorrect: false },
              { text: `to ${sc.verbBase}`, isCorrect: false },
              { text: `${sc.verbBase}edly`, isCorrect: false },
            ],
            explanation: `"${sc.verbPast}" accurately completes the sentence about what happens ${sc.sceneLabel}.`,
          },
          {
            type: "Multiple Choice",
            question: `What should ${subject} do ${sc.sceneLabel} ${videoContextLabel}?`,
            answer: `${subject} should ${sc.shouldAction}.`,
            options: [
              { text: `${subject} should ${sc.shouldAction}.`, isCorrect: true },
              { text: `${subject} should ${sc.shouldntAction}.`, isCorrect: false },
              { text: `${subject} must ${sc.mustntRule}.`, isCorrect: false },
              { text: `${subject} can ${sc.cantAction}.`, isCorrect: false },
            ],
            explanation: `${sc.location.charAt(0).toUpperCase() + sc.location.slice(1)}, ${subject} should ${sc.shouldAction}.`,
          },
          {
            type: "Grammar Choice",
            question: `Look at ${subject} ${sc.sceneLabel}: Which rule is true ${sc.location}?`,
            answer: `${subject} mustn't ${sc.mustntRule}.`,
            options: [
              { text: `${subject} mustn't ${sc.mustntRule}.`, isCorrect: true },
              { text: `${subject} must ${sc.mustntRule}.`, isCorrect: false },
              { text: `${subject} mustn't ${sc.mustRule}.`, isCorrect: false },
              { text: `${subject} should ${sc.shouldntAction}.`, isCorrect: false },
            ],
            explanation: `In this scene ${sc.location}, ${subject} mustn't ${sc.mustntRule}.`,
          }
        );
      });
    }

    const fibTemplates = bank.filter(
      (t) =>
        t.type === "Fill in the Blanks" &&
        t.question.includes("___") &&
        (t.answer || "").split(/\s+/).length <= 4
    );
    const choiceTemplates = bank.filter((t) => t.type !== "Fill in the Blanks");

    return Array.from({ length: count }, (_, index) => {
      const requestedType = types[index % types.length];
      const wantsFib = requestedType === "Fill in the Blanks" && fibTemplates.length > 0;
      const template = wantsFib
        ? fibTemplates[Math.floor(index / Math.max(1, types.length)) % fibTemplates.length]
        : choiceTemplates.length > 0
        ? choiceTemplates[index % choiceTemplates.length]
        : bank[index % bank.length];

      const timeTrigger = Math.min(
        Math.max(8, Math.round(usableStart + ((index + 0.5) / count) * usableSpan)),
        Math.max(15, duration - 6)
      );

      const rawOpts = template.options.map((o) => ({ ...o }));
      const correctOpt = rawOpts.find((o) => o.isCorrect) || rawOpts[0];
      const resolvedAnswer = template.answer || correctOpt?.text || "";

      const isActuallyFib =
        wantsFib &&
        template.question.includes("___") &&
        resolvedAnswer.split(/\s+/).length <= 4;

      if (rawOpts.length > 2) {
        const shift = index % rawOpts.length;
        for (let s = 0; s < shift; s++) {
          const first = rawOpts.shift();
          if (first) rawOpts.push(first);
        }
      }

      return {
        id: index + 1,
        timeTrigger,
        type: isActuallyFib
          ? "Fill in the Blanks"
          : requestedType === "Fill in the Blanks"
          ? "Grammar Choice"
          : requestedType || template.type || "Multiple Choice",
        xp: 100,
        question: template.question,
        answer: resolvedAnswer,
        acceptedAnswers:
          Array.isArray(template.acceptedAnswers) && template.acceptedAnswers.length > 0
            ? template.acceptedAnswers
            : [resolvedAnswer],
        options: rawOpts,
        explanation: template.explanation,
      };
    });
  };

  // Emoji Generation Endpoint (gemini-3.1-flash-lite)
  app.post("/api/generate-emoji", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      if (!hasValidGeminiKey()) {
        return res.json({ emoji: "✨" });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `You are an emoji generator. Reply with EXACTLY ONE emoji that best represents the following text, and nothing else. Text: "${prompt}"`,
      });

      const emoji = response.text?.trim() || "✨";
      res.json({ emoji });
    } catch (err: any) {
      res.json({ emoji: "✨" });
    }
  });

  // Image Generation Endpoint (gemini-3.1-flash-lite-image)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });
      if (!hasValidGeminiKey()) {
        return res.status(400).json({
          error:
            "Please configure a valid GEMINI_API_KEY in the Settings > Secrets panel.",
        });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
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
      res.status(500).json({
        error:
          err?.message ||
          "Image generation failed. Please check your API key in Settings > Secrets.",
      });
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
      res.status(500).json({ error: err.message });
    }
  });

  // Video Generation Start Endpoint
  app.post("/api/generate-video", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });
      if (!hasValidGeminiKey()) {
        return res.status(400).json({
          error:
            "Please configure a valid GEMINI_API_KEY in the Settings > Secrets panel.",
        });
      }
      const aspectRatio = req.body.aspectRatio || "16:9";

      const ai = getAiClient();
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-fast-generate-preview",
        image: {
          imageBytes: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype,
        },
        config: {
          numberOfVideos: 1,
          resolution: "720p",
          aspectRatio: aspectRatio,
        },
      });

      res.json({ operationName: operation.name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Video Polling Endpoint
  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });
      if (!hasValidGeminiKey()) {
        return res.status(400).json({ error: "Missing valid GEMINI_API_KEY" });
      }

      const ai = getAiClient();
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      res.json({ done: updated.done });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Video Download Endpoint
  app.get("/api/video-download", async (req, res) => {
    try {
      const operationName = req.query.operationName as string;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });
      if (!hasValidGeminiKey()) {
        return res.status(400).json({ error: "Missing valid GEMINI_API_KEY" });
      }

      const ai = getAiClient();
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await ai.operations.getVideosOperation({ operation: op });

      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) return res.status(404).json({ error: "Video not ready or not found" });

      const videoRes = await fetch(uri, {
        headers: { "x-goog-api-key": getResolvedGeminiKey() },
      });

      res.setHeader("Content-Type", "video/mp4");
      if (videoRes.body) {
        const nodeStream = require("stream").Readable.fromWeb(videoRes.body);
        nodeStream.pipe(res);
      } else {
        res.status(500).json({ error: "Empty response body from video URL" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image Analysis Endpoint (gemini-4-hydrogen)
  app.post("/api/analyze-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Image is required" });
      if (!hasValidGeminiKey()) {
        return res.status(400).json({
          error:
            "Please configure a valid GEMINI_API_KEY in the Settings > Secrets panel.",
        });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype,
              },
            },
            {
              text: "Analyze this image and describe what you see in detail. If it contains text, summarize it. If it contains objects or characters, identify them.",
            },
          ],
        },
      });

      res.json({ text: response.text });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mystery Box Questions Generation Endpoint
  app.post("/api/generate-mystery-box-questions", async (req, res) => {
    const { topic, level, type, count } = req.body || {};
    if (!topic || !level || !type) {
      return res.status(400).json({ error: "Topic, level, and type are required" });
    }
    const targetCount = Math.min(30, Math.max(5, count || 30));

    const buildMysteryFallback = () =>
      Array.from({ length: targetCount }, (_, i) => ({
        type: "mcq",
        question: `Question ${i + 1}: Which statement best relates to ${topic} (${level})?`,
        options: [
          `A key fact or vocabulary item about ${topic}`,
          `An unrelated idea`,
          `An opposite meaning`,
          `None of the above`,
        ],
        correctOptionIndex: 0,
      }));

    if (!hasValidGeminiKey()) {
      return res.json({ questions: buildMysteryFallback() });
    }

    try {
      const prompt = `Generate exactly ${targetCount} questions for an ESL game about "${topic}". The English proficiency level is Cambridge ${level}. 
      The question type should be ${type === 'mcq' ? 'Multiple Choice' : type === 'fib' ? 'Fill in the Blanks' : 'a mix of Multiple Choice and Fill in the Blanks'}.

      Respond ONLY with a valid JSON array of exactly ${targetCount} objects. Do not wrap in markdown tags like \`\`\`json.
      
      If the type is Multiple Choice (mcq), use this format:
      {
        "type": "mcq",
        "question": "The question text?",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "correctOptionIndex": 0
      }
      
      If the type is Fill in the Blanks (fib), use this format:
      {
        "type": "fib",
        "question": "The sentence with a ____ blank.",
        "answer": "correct word"
      }
      
      Ensure the English is natural, accurate, and perfectly matches the Cambridge ${level} level. 
      The JSON array MUST have exactly ${targetCount} objects.`;

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text?.trim() || "[]";
      let questions = JSON.parse(text);

      if (Array.isArray(questions) && questions.length > 0) {
        if (questions.length > targetCount) {
          questions = questions.slice(0, targetCount);
        } else {
          while (questions.length < targetCount && questions.length < 30) {
            questions.push({ ...questions[questions.length - 1] });
          }
        }
        return res.json({ questions: questions.slice(0, 30) });
      }
      return res.json({ questions: buildMysteryFallback() });
    } catch {
      return res.json({ questions: buildMysteryFallback() });
    }
  });

  app.post("/api/generate-hamster-questions", async (req, res) => {
    const {
      topic,
      videoTitle,
      level,
      types,
      count,
      videoDuration,
      videoUrl,
    } = req.body || {};

    const cleanTopic = typeof topic === "string" ? topic.trim() : "";
    const cleanLevel = typeof level === "string" && level.trim() ? level.trim() : "A2 Movers";
    const requestedTypes: string[] =
      Array.isArray(types) && types.length > 0
        ? types
        : ["Fill in the Blanks", "Multiple Choice", "Grammar Choice"];

    const targetCount = Math.max(1, Math.min(100, Number(count) || 5));
    const scanned = await scanYouTubeVideoDeepContext(
      typeof videoUrl === "string" ? videoUrl : ""
    );

    const resolvedVideoTitle =
      (typeof videoTitle === "string" && videoTitle.trim() && !/^https?:\/\//i.test(videoTitle.trim())
        ? videoTitle.trim()
        : "") ||
      scanned.title ||
      "";
    const resolvedAuthor = scanned.author || "";
    const resolvedDuration = Math.max(
      60,
      Number(videoDuration) || Number(scanned.durationSec) || 540
    );

    const fallbackList = buildFallbackVideoQuizQuestions(
      cleanTopic,
      cleanLevel,
      requestedTypes,
      targetCount,
      resolvedVideoTitle,
      resolvedDuration,
      scanned.description,
      scanned.chapters
    );

    if (!hasValidGeminiKey()) {
      return res.json({
        questions: fallbackList,
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
      });
    }

    try {
      const durationSec = resolvedDuration;
      const stepSec = Math.max(5, Math.floor((durationSec * 0.88) / (targetCount + 1)));
      const topicInstruction = cleanTopic
        ? `Target Grammar / Vocabulary Topic: "${cleanTopic}". Every single question MUST directly test "${cleanTopic}" while anchoring the sentence in the actual characters, setting, objects, and actions shown in THIS specific video ("${resolvedVideoTitle}"). Do NOT use unrelated grammar topics.`
        : `No specific grammar topic was entered by the teacher — scan the video frames, title, description, and scenes to generate accurate video comprehension, action grammar, and vocabulary questions directly about what happens in "${resolvedVideoTitle}".`;

      const promptText = `You are an expert Cambridge ESL curriculum designer creating an interactive classroom video quiz.

${topicInstruction}
English Level: Cambridge ${cleanLevel} (Starters, Movers, Flyers, KET / A2 Key, B1 Preliminary, or B2 First)
Video Title: "${resolvedVideoTitle || "Classroom Video Clip"}" ${resolvedAuthor ? `(Channel: ${resolvedAuthor})` : ""}
Video URL: ${videoUrl || "Uploaded Video"}
Video Description / Context: ${scanned.description ? scanned.description.slice(0, 900) : "Use the attached video scene frames and title."}
${scanned.chapters.length > 0 ? `Video Chapters / Scenes: ${scanned.chapters.map((c) => `${c.title} (@${c.sec}s)`).join(" | ")}` : ""}
Video Duration: ~${durationSec} seconds
Allowed Question Types: ${requestedTypes.join(", ")}
Number of Questions to Generate: EXACTLY ${targetCount}

CRITICAL INSTRUCTIONS:
1. Examine the attached video scene frames, video title ("${resolvedVideoTitle}"), and description carefully so every question accurately reflects the REAL setting, characters, and actions in THIS specific video. NEVER use fixed questions from other videos.
2. Strictly test the requested topic ("${cleanTopic || "Video Scene Comprehension"}"). For example, if the topic is "Must and mustn't", every question must test "must" vs "mustn't" in the context of the scenes in "${resolvedVideoTitle}".
3. Cycle through the Allowed Question Types (${requestedTypes.join(", ")}).
4. Whenever a question has type "Fill in the Blanks":
   - The "question" string MUST contain "____" showing where the missing word(s) go.
   - Provide "answer" with the exact correct missing word/phrase and "acceptedAnswers" with valid variations.
   - Also include 4 "options" where the first or matching option is the correct answer so it can be graded in both modes.
5. For "Multiple Choice", "Grammar Choice", "Vocabulary Meaning", or "True or False", provide 4 clear options (or 2 for True or False) with exactly one option marked "isCorrect": true, and vary which option index is correct.
6. NEVER write vague meta-questions like "What is the main focus of this scene?" or "What does EVER mean in this context?".
7. Spread "timeTrigger" (in seconds) in ascending order across the video between 10 and ${Math.max(25, Math.floor(durationSec * 0.90))} seconds.`;

      const ai = getAiClient();
      const contentsParts: any[] = [
        ...(Array.isArray(scanned.frameParts) ? scanned.frameParts : []),
        { text: promptText },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: contentsParts,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timeTrigger: { type: Type.INTEGER },
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                acceptedAnswers: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      isCorrect: { type: Type.BOOLEAN },
                    },
                    required: ["text", "isCorrect"],
                  },
                },
                explanation: { type: Type.STRING },
              },
              required: ["timeTrigger", "type", "question", "options", "explanation"],
            },
          },
        },
      });

      const text = response.text?.trim() || "[]";
      const parsed = JSON.parse(text);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];

      const sanitized = rawArray
        .map((q: any, idx: number) => {
          let qText = String(q?.question || q?.text || "").trim();
          if (
            !qText ||
            /main focus of this scene|what does .* mean in this context|unrelated topic not shown/i.test(
              qText
            )
          ) {
            return null;
          }

          const assignedType = requestedTypes.includes(String(q?.type || ""))
            ? String(q.type)
            : requestedTypes[idx % requestedTypes.length];

          const rawOpts = Array.isArray(q?.options) ? q.options : [];
          let hasCorrect = false;
          const mappedOpts = rawOpts
            .slice(0, 4)
            .map((o: any, oIdx: number) => {
              const optText =
                typeof o === "string" ? o.trim() : String(o?.text || "").trim();
              if (!optText || /^Option [A-D1-4]$/i.test(optText)) return null;
              const isRight =
                typeof o === "object" && o !== null
                  ? Boolean(o.isCorrect)
                  : typeof q.correctOptionIndex === "number"
                  ? q.correctOptionIndex === oIdx
                  : typeof q.answerIndex === "number"
                  ? q.answerIndex === oIdx
                  : false;
              if (isRight) hasCorrect = true;
              return { text: optText, isCorrect: isRight };
            })
            .filter(Boolean) as { text: string; isCorrect: boolean }[];

          const explicitAnswer = String(
            q?.answer ||
              mappedOpts.find((o) => o.isCorrect)?.text ||
              mappedOpts[0]?.text ||
              ""
          ).trim();

          if (assignedType === "Fill in the Blanks") {
            if (!explicitAnswer) return null;
            if (!qText.includes("___")) {
              qText = `${qText} (____)`;
            }
            const rawAccepted = Array.isArray(q?.acceptedAnswers)
              ? q.acceptedAnswers.map((a: any) => String(a || "").trim()).filter(Boolean)
              : [];
            const accepted = Array.from(
              new Set([explicitAnswer, ...rawAccepted].filter(Boolean))
            );
            const fallbackOpts =
              mappedOpts.length >= 2
                ? mappedOpts
                : [{ text: explicitAnswer, isCorrect: true }];
            if (!fallbackOpts.some((o) => o.isCorrect)) {
              fallbackOpts[0].isCorrect = true;
            }
            return {
              id: idx + 1,
              timeTrigger: Math.max(5, Number(q?.timeTrigger) || (idx + 1) * stepSec),
              type: "Fill in the Blanks",
              xp: 100,
              question: qText,
              answer: explicitAnswer,
              acceptedAnswers: accepted,
              options: fallbackOpts,
              explanation: String(
                q?.explanation || `Correct answer: "${explicitAnswer}".`
              ),
            };
          }

          if (mappedOpts.length < 2) return null;
          if (!hasCorrect) {
            mappedOpts[0].isCorrect = true;
          }

          return {
            id: idx + 1,
            timeTrigger: Math.max(5, Number(q?.timeTrigger) || (idx + 1) * stepSec),
            type: assignedType,
            xp: 100,
            question: qText,
            answer: explicitAnswer,
            options: mappedOpts,
            explanation: String(q?.explanation || ""),
          };
        })
        .filter(Boolean);

      if (sanitized.length > 0) {
        const finalQuestions =
          sanitized.length >= targetCount
            ? sanitized.slice(0, targetCount)
            : [
                ...sanitized,
                ...fallbackList.slice(sanitized.length, targetCount),
              ].map((item: any, idx: number) => ({
                ...item,
                id: idx + 1,
              }));

        return res.json({
          questions: finalQuestions,
          videoTitle: resolvedVideoTitle,
          videoDuration: resolvedDuration,
        });
      }

      return res.json({
        questions: fallbackList,
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
      });
    } catch {
      return res.json({
        questions: fallbackList,
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
      });
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
  // Guarantees Host & Students see each other immediately across all devices,
  // tabs, and domains (both active Cloud Run URL & www.hamsterenglish.online).
  // ============================================================================
  app.use("/api/paintball", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  const paintballRoomsMemory = new Map<
    string,
    {
      room: Record<string, any>;
      players: Map<string, Record<string, any>>;
      events: Array<Record<string, any>>;
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
          teamCount: 2,
          cameraViewPreset: "balanced",
          aimControlMode: "shoulder",
          matchStatus: "lobby",
          configuredDurationSec: 180,
          ballsPerQuestion: 10,
          matchEpoch: 0,
          isUninitialized: true,
          updatedAt: Date.now()
        },
        players: new Map(),
        events: []
      };
      paintballRoomsMemory.set(cleanCode, entry);
    }
    return entry;
  }

  function appendPaintballRoomEvents(
    entry: {
      room: Record<string, any>;
      players: Map<string, Record<string, any>>;
      events: Array<Record<string, any>>;
    },
    incomingEvents: Array<Record<string, any>>
  ) {
    const now = Date.now();
    // Prune events older than 8 seconds
    entry.events = entry.events.filter(ev => now - (ev.serverTs || now) < 8000);
    for (const ev of incomingEvents) {
      if (!ev) continue;
      const evId = ev.id || ev.eventId;
      if (!evId) continue;
      const evType = ev.type || ev.kind || "shot";
      if (!entry.events.some(existingEv => (existingEv.id || existingEv.eventId) === evId)) {
        entry.events.push({
          ...ev,
          id: evId,
          eventId: evId,
          type: evType,
          kind: evType,
          ownerId: ev.ownerId || ev.actorId || ev.victimId || "",
          ownerName: ev.ownerName || ev.actorName || "Student",
          ownerTeam: ev.ownerTeam || ev.actorTeam || "red",
          attackerId: ev.attackerId || ev.actorId || "",
          attackerName: ev.attackerName || ev.actorName || "Student",
          ts: ev.ts || now,
          serverTs: now
        });
      }
    }
    if (entry.events.length > 40) {
      entry.events = entry.events.slice(-40);
    }
  }

  function serializePaintballRoom(entry: {
    room: Record<string, any>;
    players: Map<string, Record<string, any>>;
    events: Array<Record<string, any>>;
  }) {
    const now = Date.now();
    entry.events = entry.events.filter(ev => now - (ev.serverTs || now) < 8000);
    // Prune stale disconnected players who haven't updated in > 45 seconds
    entry.players.forEach((p, id) => {
      if (p.kicked && now - (p.updatedAt || 0) > 5000) {
        entry.players.delete(id);
      } else if (now - (p.updatedAt || 0) > 45000) {
        entry.players.delete(id);
      }
    });
    const serializedPlayers = Array.from(entry.players.values()).map(p => {
      const immuneRemMs =
        typeof p.serverImmuneUntil === "number"
          ? Math.max(0, p.serverImmuneUntil - now)
          : 0;
      return {
        ...p,
        immuneRemainingMs: immuneRemMs
      };
    });
    return {
      serverNow: now,
      room: {
        ...entry.room,
        serverNow: now
      },
      players: serializedPlayers,
      events: entry.events
    };
  }

  // GET /api/paintball/room/:code -> Fetch room configuration, all joined players & combat ring buffer
  app.get("/api/paintball/room/:code", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });
    res.json(serializePaintballRoom(entry));
  });

  // POST /api/paintball/room/:code/room -> Host updates room settings, status, timer, or bulk player spawn positions
  app.post("/api/paintball/room/:code/room", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });

    const now = Date.now();
    const { room: roomPatch, players: playersPatch, combatEvents, events } = req.body || {};
    if (roomPatch && typeof roomPatch === "object") {
      const nextEpoch =
        typeof roomPatch.matchEpoch === "number" && roomPatch.matchEpoch > 0
          ? roomPatch.matchEpoch
          : typeof roomPatch.startedAt === "number" && roomPatch.startedAt > 0
          ? roomPatch.startedAt
          : entry.room.matchEpoch || 0;

      // Anchor timerSyncedAt and startedAt to authoritative server clock so skewed client clocks never break timers!
      const normalizedPatch = { ...roomPatch };
      if (typeof normalizedPatch.timerSyncSeconds === "number") {
        normalizedPatch.timerSyncedAt = now;
      }
      if (roomPatch.matchStatus === "playing" && nextEpoch > (entry.room.matchEpoch || 0)) {
        normalizedPatch.startedAt = now;
        normalizedPatch.matchEpoch = nextEpoch;
      }

      entry.room = {
        ...entry.room,
        ...normalizedPatch,
        matchEpoch: Math.max(entry.room.matchEpoch || 0, nextEpoch),
        roomCode: entry.room.roomCode,
        isUninitialized: false,
        updatedAt: now
      };
    }

    if (Array.isArray(playersPatch)) {
      playersPatch.forEach((pPatch: any) => {
        if (!pPatch || !pPatch.id) return;
        const existing = entry.players.get(pPatch.id) || {};
        const resetEpoch =
          pPatch.matchStartResetAt || pPatch.lastStartedAt || entry.room.matchEpoch || 0;
        entry.players.set(pPatch.id, {
          ...existing,
          ...pPatch,
          lastStartedAt: Math.max(existing.lastStartedAt || 0, resetEpoch),
          serverImmuneUntil: 0,
          hostOverrideAt: now,
          updatedAt: now
        });
      });
    }

    const incomingRoomEvents = Array.isArray(events)
      ? events
      : Array.isArray(combatEvents)
      ? combatEvents
      : [];
    if (incomingRoomEvents.length > 0) {
      appendPaintballRoomEvents(entry, incomingRoomEvents);
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

    // Preserve Host's team override or kick state until acknowledged
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
      now - hostOverrideAt < 10000;

    const incomingSeq = typeof playerData.seq === "number" ? playerData.seq : 0;
    const existingSeq = typeof existing.seq === "number" ? existing.seq : 0;
    const incomingEpoch =
      typeof playerData.matchEpoch === "number" && playerData.matchEpoch > 0
        ? playerData.matchEpoch
        : typeof playerData.lastStartedAt === "number"
        ? playerData.lastStartedAt
        : 0;
    const existingPlayerEpoch = Math.max(
      existing.matchEpoch || 0,
      existing.lastStartedAt || 0,
      existing.matchStartResetAt || 0
    );
    const activeEpoch = Math.max(
      existingPlayerEpoch,
      entry.room.matchStatus === "playing" ? entry.room.matchEpoch || 0 : 0
    );

    const hasExistingPlayer = Boolean(existing && existing.id);

    // Block pre-match lobby heartbeats (`incomingEpoch < activeEpoch`) for already-synced players
    // and brief out-of-order HTTP packets (<1.5s), while always allowing brand-new late-game joiners!
    const isOlderMatchEpoch =
      !isHostAction &&
      hasExistingPlayer &&
      activeEpoch > 1000 &&
      incomingEpoch < activeEpoch;
    const isNewerMatchEpoch = incomingEpoch > existingPlayerEpoch && incomingEpoch > 1000;
    const sameMatchSession = !isNewerMatchEpoch && incomingEpoch === existingPlayerEpoch;
    const recentExistingMs = now - (existing.updatedAt || 0);
    const isStaleSeqPacket =
      !isHostAction &&
      hasExistingPlayer &&
      sameMatchSession &&
      recentExistingMs < 1500 &&
      ((incomingSeq > 0 &&
        existingSeq > 0 &&
        incomingSeq < existingSeq &&
        existingSeq - incomingSeq < 5000) ||
        (existingSeq > 0 && incomingSeq === 0));

    const isStaleStudentPacket = isOlderMatchEpoch || isStaleSeqPacket;

    // Server-authoritative relative immunity window (eliminates cross-device clock skew!)
    let nextServerImmuneUntil =
      typeof existing.serverImmuneUntil === "number" ? existing.serverImmuneUntil : 0;
    if (isHostAction && playerData.matchStartResetAt) {
      nextServerImmuneUntil = 0;
    } else if (typeof playerData.immuneRemainingMs === "number") {
      nextServerImmuneUntil =
        playerData.immuneRemainingMs > 0 ? now + Math.min(12000, playerData.immuneRemainingMs) : 0;
    } else if (typeof playerData.immuneUntil === "number" && playerData.immuneUntil > now) {
      nextServerImmuneUntil = Math.min(now + 12000, playerData.immuneUntil);
    }

    const resolvedSeq =
      isHostAction && playerData.matchStartResetAt
        ? 0
        : isNewerMatchEpoch || recentExistingMs >= 1500
        ? incomingSeq
        : Math.max(incomingSeq, existingSeq);

    const resolvedEpoch =
      isHostAction && playerData.matchStartResetAt
        ? playerData.matchStartResetAt
        : Math.max(incomingEpoch, existingPlayerEpoch, activeEpoch);

    const mergedPlayer: Record<string, any> = isStaleStudentPacket
      ? {
          ...existing,
          // Keep connection alive while preserving authoritative match-start reset & latest coordinates
          updatedAt: now
        }
      : {
          ...existing,
          ...playerData,
          id: playerId,
          seq: resolvedSeq,
          matchEpoch: resolvedEpoch,
          lastStartedAt: resolvedEpoch,
          team: preserveHostTeam
            ? existing.team
            : playerData.team || existing.team || "red",
          kicked: isHostAction
            ? Boolean(playerData.kicked)
            : Boolean(existing.kicked || playerData.kicked),
          serverImmuneUntil: nextServerImmuneUntil,
          hostOverrideAt,
          updatedAt: now
        };

    entry.players.set(playerId, mergedPlayer);

    // Record any combat events (shots, hits, KOs) into the room's 40-event ring buffer so rapid fire is NEVER dropped!
    const collectedEvents: Array<Record<string, any>> = [];
    if (Array.isArray(body.events)) {
      collectedEvents.push(...body.events);
    }
    if (Array.isArray(body.combatEvents)) {
      collectedEvents.push(...body.combatEvents);
    }
    if (playerData.lastShot?.shotId) {
      collectedEvents.push({
        id: playerData.lastShot.shotId,
        eventId: playerData.lastShot.shotId,
        type: "shot",
        kind: "shot",
        ownerId: playerId,
        ownerName: mergedPlayer.name || "Student",
        ownerTeam: mergedPlayer.team || "red",
        x: playerData.lastShot.x,
        z: playerData.lastShot.z,
        angle: playerData.lastShot.angle,
        paintColor: playerData.lastShot.paintColor
      });
    }
    if (playerData.lastHit?.hitId) {
      collectedEvents.push({
        id: playerData.lastHit.hitId,
        eventId: playerData.lastHit.hitId,
        type: "hit",
        kind: "hit",
        ownerId: playerData.lastHit.attackerId || playerId,
        ownerName: playerData.lastHit.attackerName || mergedPlayer.name || "Student",
        attackerId: playerData.lastHit.attackerId || playerId,
        attackerName: playerData.lastHit.attackerName || mergedPlayer.name || "Student",
        targetId: playerData.lastHit.targetId,
        damage: playerData.lastHit.damage
      });
    }
    if (playerData.lastKo?.koId) {
      collectedEvents.push({
        id: playerData.lastKo.koId,
        eventId: playerData.lastKo.koId,
        type: "ko",
        kind: "ko",
        ownerId: playerId,
        attackerId: playerData.lastKo.attackerId,
        victimId: playerId,
        victimName: playerData.lastKo.victimName || mergedPlayer.name || "Opponent"
      });
    }
    if (collectedEvents.length > 0) {
      appendPaintballRoomEvents(entry, collectedEvents);
    }

    // Adopt room state if reported from Firestore into an uninitialized memory room
    if (body.roomState && typeof body.roomState === "object") {
      const rs = body.roomState;
      const rsEpoch = rs.matchEpoch || rs.startedAt || 0;
      if (
        entry.room.isUninitialized ||
        (rs.matchStatus === "playing" && rsEpoch > (entry.room.matchEpoch || 0))
      ) {
        entry.room = {
          ...entry.room,
          ...rs,
          matchEpoch: Math.max(entry.room.matchEpoch || 0, rsEpoch),
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
  // Support sendBeacon POST leave on mobile tab close
  app.post("/api/paintball/room/:code/player/:playerId/leave", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });
    const playerId = String(req.params.playerId || "").trim();
    if (playerId) {
      entry.players.delete(playerId);
    }
    res.json({ ok: true });
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
