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
          const bestActive = Math.max(getTimeMs(prev.lastActiveAt), getTimeMs(u.lastActiveAt), bestLogin);
          usersMap.set(key, {
            ...prev,
            ...u,
            photoURL: u.photoURL || prev.photoURL || null,
            lastLoginAt: bestLogin > 0 ? bestLogin : prev.lastLoginAt || u.lastLoginAt || null,
            ...(bestActive > 0 ? { lastActiveAt: bestActive } : {}),
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
    const combined = `${videoTitleRaw || ""} ${topicRaw || ""}`;
    if (/mr\.?\s*bean/i.test(combined)) return "Mr. Bean";
    if (/pink\s*panther/i.test(combined)) return "The Pink Panther";
    if (/tom\s*and\s*jerry/i.test(combined)) return "Tom and Jerry";
    if (/spongebob/i.test(combined)) return "SpongeBob";
    if (/peppa\s*pig/i.test(combined)) return "Peppa Pig";
    if (/paddington/i.test(combined)) return "Paddington";
    if (/harry\s*potter/i.test(combined)) return "Harry Potter";
    if (/elsa/i.test(combined)) return "Elsa";
    if (/spider-?man/i.test(combined)) return "Spider-Man";
    if (/minion/i.test(combined)) return "They";
    if (/hamster/i.test(combined)) return "The hamster";
    return "";
  };

  const extractYouTubeId = (rawUrl?: string): string => {
    const s = String(rawUrl || "").trim();
    if (!s) return "";
    const m =
      s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/) ||
      s.match(/^([a-zA-Z0-9_-]{11})$/);
    return m ? m[1] : "";
  };

  const decodeHtmlEntities = (str: string): string =>
    (str || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/\s+/g, " ")
      .trim();

  const formatTimestampTag = (secRaw: number): string => {
    const s = Math.max(0, Math.floor(secRaw || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const extractJsonObjectAfterMarker = (source: string, markerRegex: RegExp): any | null => {
    const m = markerRegex.exec(source);
    if (!m) return null;
    const startIdx = source.indexOf("{", m.index);
    if (startIdx < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = startIdx; i < source.length; i++) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(startIdx, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  interface StoryboardSheetInfo {
    startSec: number;
    endSec: number;
    cols: number;
    rows: number;
    intervalSec: number;
    mimeType: string;
    data: string;
  }

  const scanYouTubeVideoDeepContext = async (
    videoUrlRaw?: string,
    options?: { skipFrames?: boolean }
  ) => {
    const videoId = extractYouTubeId(videoUrlRaw);
    let title = "";
    let author = "";
    let description = "";
    let snippet = "";
    let durationSec = 0;
    let keywords: string[] = [];
    let transcript = "";
    let chapters: Array<{ title: string; sec: number }> = [];
    let captionTrackUrl = "";
    let storyboardSpec = "";
    const storyboardSheets: StoryboardSheetInfo[] = [];
    const frameParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    if (!videoId) {
      return {
        videoId: "",
        title,
        author,
        description,
        snippet,
        durationSec,
        keywords,
        transcript,
        chapters,
        storyboardSheets,
        frameParts,
      };
    }

    const pickCaptionTrackUrl = (tracks: any[]): string => {
      if (!Array.isArray(tracks) || tracks.length === 0) return "";
      const exactEn = tracks.find(
        (t) =>
          typeof t?.languageCode === "string" &&
          /^en(-|$)/i.test(t.languageCode) &&
          t?.kind !== "asr" &&
          t?.baseUrl
      );
      if (exactEn?.baseUrl) return String(exactEn.baseUrl);
      const anyEn = tracks.find(
        (t) =>
          typeof t?.languageCode === "string" && /^en(-|$)/i.test(t.languageCode) && t?.baseUrl
      );
      if (anyEn?.baseUrl) return String(anyEn.baseUrl);
      const firstTrack = tracks.find((t) => t?.baseUrl);
      return firstTrack?.baseUrl ? String(firstTrack.baseUrl) : "";
    };

    const tasks: Promise<void>[] = [];

    // 1. OEmbed title & channel (fast backup)
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

    // 2. YouTube Watch Page parsing (ytInitialPlayerResponse + ytInitialData -> captions, duration, description, chapters, & chronological storyboard sheets)
    tasks.push(
      (async () => {
        try {
          const wRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
              "Accept-Language": "en-US,en;q=0.9",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });
          if (!wRes.ok) return;
          const html = await wRes.text();

          const pr = extractJsonObjectAfterMarker(
            html,
            /(?:var\s+)?ytInitialPlayerResponse\s*=\s*/
          );
          if (pr) {
            const vd = pr?.videoDetails;
            if (vd) {
              const len = parseInt(String(vd.lengthSeconds || "0"), 10);
              if (len > 0 && durationSec <= 0) durationSec = len;
              if (vd.title && !title) title = String(vd.title).trim();
              if (vd.author && !author) author = String(vd.author).trim();
              if (vd.shortDescription && !description) {
                description = String(vd.shortDescription).trim().slice(0, 2200);
              }
              if (Array.isArray(vd.keywords) && keywords.length === 0) {
                keywords = vd.keywords
                  .map((k: any) => String(k || "").trim())
                  .filter(Boolean)
                  .slice(0, 18);
              }
            }
            const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!captionTrackUrl && Array.isArray(tracks)) {
              captionTrackUrl = pickCaptionTrackUrl(tracks);
            }
            const sb = pr?.storyboards?.playerStoryboardSpecRenderer?.spec;
            if (typeof sb === "string" && sb.includes("|")) {
              storyboardSpec = sb;
            }
          }

          if (durationSec <= 0) {
            const lenMatch = html.match(/"lengthSeconds":"(\d+)"/);
            if (lenMatch?.[1]) {
              const parsed = parseInt(lenMatch[1], 10);
              if (parsed > 0) durationSec = parsed;
            }
          }
          if (!title) {
            const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/i);
            if (ogTitle?.[1]) title = decodeHtmlEntities(ogTitle[1]);
          }

          // Extract chapters from watch HTML if present
          const chapMatches = [
            ...html.matchAll(
              /"chapterRenderer":\{"title":\{"simpleText":"([^"]+)"\},"timeRangeStartMillis":(\d+)/g
            ),
          ];
          if (chapMatches.length > 0 && chapters.length === 0) {
            chapters = chapMatches.slice(0, 30).map((m) => ({
              title: decodeHtmlEntities(m[1]),
              sec: Math.round(Number(m[2]) / 1000),
            }));
          }
        } catch {}

        // Fetch and parse timestamped captions if available
        const subTasks: Promise<void>[] = [];
        if (captionTrackUrl) {
          subTasks.push(
            (async () => {
              try {
                const capUrl = captionTrackUrl.includes("fmt=")
                  ? captionTrackUrl
                  : `${captionTrackUrl}&fmt=json3`;
                const cRes = await fetch(capUrl);
                if (!cRes.ok) return;
                const rawText = await cRes.text();
                const entries: Array<{ sec: number; text: string }> = [];
                if (rawText.trim().startsWith("{")) {
                  try {
                    const jsonData: any = JSON.parse(rawText);
                    const events = Array.isArray(jsonData?.events) ? jsonData.events : [];
                    events.forEach((ev: any) => {
                      const segs = Array.isArray(ev?.segs) ? ev.segs : [];
                      const line = decodeHtmlEntities(
                        segs.map((s: any) => s?.utf8 || "").join("")
                      );
                      if (line && !/^\[.*\]$/.test(line)) {
                        entries.push({
                          sec: Math.round((Number(ev?.tStartMs) || 0) / 1000),
                          text: line,
                        });
                      }
                    });
                  } catch {}
                } else {
                  const xmlMatches = [
                    ...rawText.matchAll(/<text start="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g),
                  ];
                  xmlMatches.forEach((m) => {
                    const line = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, " "));
                    if (line && !/^\[.*\]$/.test(line)) {
                      entries.push({
                        sec: Math.round(parseFloat(m[1]) || 0),
                        text: line,
                      });
                    }
                  });
                }

                if (entries.length > 0) {
                  const maxLines = 160;
                  const step = entries.length > maxLines ? entries.length / maxLines : 1;
                  const sampled: string[] = [];
                  for (let i = 0; i < entries.length && sampled.length < maxLines; i += step) {
                    const e = entries[Math.floor(i)];
                    if (e && e.text) {
                      sampled.push(`[${formatTimestampTag(e.sec)} / ${e.sec}s] ${e.text}`);
                    }
                  }
                  transcript = sampled.join("\n").slice(0, 9000);
                }
              } catch {}
            })()
          );
        }

        // Download chronological YouTube Storyboard sprite sheets so Gemini can inspect the full timeline visually
        if (!options?.skipFrames && storyboardSpec) {
          subTasks.push(
            (async () => {
              try {
                const parts = storyboardSpec.split("|");
                const baseUrl = parts[0];
                const levels = parts.slice(1).map((lvlStr, idx) => {
                  const segs = lvlStr.split("#");
                  return {
                    levelIdx: idx,
                    width: parseInt(segs[0] || "0", 10) || 0,
                    height: parseInt(segs[1] || "0", 10) || 0,
                    totalFrames: parseInt(segs[2] || "0", 10) || 0,
                    cols: parseInt(segs[3] || "1", 10) || 1,
                    rows: parseInt(segs[4] || "1", 10) || 1,
                    intervalMs: parseInt(segs[5] || "0", 10) || 0,
                    namePattern: segs[6] || "",
                    sigh: segs[7] || "",
                  };
                });

                // Prefer highest-resolution sheet with $M grid support
                const validLevels = levels.filter(
                  (l) => l.namePattern.includes("$M") && l.cols * l.rows >= 4 && l.totalFrames > 0
                );
                const chosen = validLevels.sort((a, b) => b.width - a.width)[0];
                if (!chosen) return;

                const framesPerSheet = Math.max(1, chosen.cols * chosen.rows);
                const totalSheets = Math.max(1, Math.ceil(chosen.totalFrames / framesPerSheet));
                const intervalSec =
                  chosen.intervalMs > 0
                    ? chosen.intervalMs / 1000
                    : durationSec > 0
                    ? durationSec / Math.max(1, chosen.totalFrames)
                    : 2;

                const maxSheetsToFetch = Math.min(6, totalSheets);
                const sheetIndices = Array.from({ length: maxSheetsToFetch }, (_, i) =>
                  maxSheetsToFetch === 1
                    ? 0
                    : Math.round((i / (maxSheetsToFetch - 1)) * (totalSheets - 1))
                ).filter((v, i, arr) => arr.indexOf(v) === i);

                const downloaded = await Promise.all(
                  sheetIndices.map(async (mIdx) => {
                    try {
                      const sheetUrl =
                        baseUrl
                          .replace("$L", String(chosen.levelIdx))
                          .replace("$N", chosen.namePattern.replace("$M", String(mIdx))) +
                        (chosen.sigh ? `&sigh=${encodeURIComponent(chosen.sigh)}` : "");
                      const sbRes = await fetch(sheetUrl);
                      if (!sbRes.ok) return null;
                      const buf = Buffer.from(await sbRes.arrayBuffer());
                      if (buf.byteLength < 1000) return null;
                      const startFrame = mIdx * framesPerSheet;
                      const endFrame = Math.min(
                        chosen.totalFrames - 1,
                        startFrame + framesPerSheet - 1
                      );
                      const startSec = Math.round(startFrame * intervalSec);
                      const endSec = Math.min(
                        durationSec > 0 ? durationSec : Math.round(endFrame * intervalSec),
                        Math.round((endFrame + 1) * intervalSec)
                      );
                      return {
                        startSec,
                        endSec: Math.max(startSec + 1, endSec),
                        cols: chosen.cols,
                        rows: chosen.rows,
                        intervalSec: Math.max(0.5, Math.round(intervalSec * 10) / 10),
                        mimeType: "image/jpeg",
                        data: buf.toString("base64"),
                      } as StoryboardSheetInfo;
                    } catch {
                      return null;
                    }
                  })
                );

                downloaded.forEach((sheet) => {
                  if (sheet) storyboardSheets.push(sheet);
                });
              } catch {}
            })()
          );
        }

        await Promise.allSettled(subTasks);
      })()
    );

    // 3. YouTube Innertube Next API for description & chapter timestamps (backup)
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
            if (descMatches.length > 0 && !description) {
              try {
                const parsedDesc = JSON.parse(`"${descMatches[0][1]}"`).slice(0, 2200);
                if (parsedDesc) description = parsedDesc;
              } catch {}
            }
            if (chapters.length === 0) {
              const chapMatches = [
                ...text.matchAll(
                  /"chapterRenderer":\{"title":\{"simpleText":"([^"]+)"\},"timeRangeStartMillis":(\d+)/g
                ),
              ];
              chapters = chapMatches.slice(0, 30).map((m) => ({
                title: decodeHtmlEntities(m[1]),
                sec: Math.round(Number(m[2]) / 1000),
              }));
            }
          }
        } catch {}
      })()
    );

    // 4. YouTube Innertube Search API for detailed snippet & backup durationSec
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
            if (durationSec <= 0) {
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

    // 5. Backup standard thumbnail frames (used only if storyboard sheets were unavailable)
    if (!options?.skipFrames) {
      tasks.push(
        (async () => {
          const frameNames = ["hq1.jpg", "hq2.jpg", "hq3.jpg", "0.jpg"];
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
    }

    await Promise.allSettled(tasks);
    if (!description && snippet) {
      description = snippet;
    } else if (snippet && !description.includes(snippet)) {
      description = `${snippet}\n${description}`;
    }
    return {
      videoId,
      title,
      author,
      description,
      snippet,
      durationSec,
      keywords,
      transcript,
      chapters,
      storyboardSheets,
      frameParts,
    };
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
    subject: string = "He",
    videoTranscriptRaw?: string,
    videoKeywordsRaw?: string[]
  ): ScannedVideoScene[] => {
    const combinedText = `${videoTitleRaw || ""} ${videoDescRaw || ""} ${
      Array.isArray(chaptersRaw) ? chaptersRaw.map((c) => c.title).join(" ") : ""
    } ${Array.isArray(videoKeywordsRaw) ? videoKeywordsRaw.join(" ") : ""} ${
      (videoTranscriptRaw || "").slice(0, 3500)
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
          sceneLabel: "outside the hospital",
          location: "outside the hospital",
          mustRule: "park in a normal parking space",
          mustntRule: "park in front of the ambulance",
          shouldAction: "move his car away from the ambulance",
          shouldntAction: "block the ambulance doors",
          canAction: "see the white ambulance outside",
          cantAction: "park in the ambulance space",
          haveToAction: "follow the parking signs",
          dontHaveToAction: "drive an ambulance",
          verbBase: "park",
          verbPast: "parked",
          verbV3: "parked",
          verbIng: "parking",
          verbS: "parks",
          obj: "his car near the ambulance",
          passiveSubject: "The ambulance",
          passiveVerbV3: "parked",
          passiveWasOrIs: "is",
          adjBase: "safe",
          adjComp: "safer",
          adjSuper: "safest",
        },
        {
          sceneLabel: "at the hospital desk",
          location: "in the hospital",
          mustRule: "take a ticket and wait his turn",
          mustntRule: "take another person's ticket",
          shouldAction: "wait for his number",
          shouldntAction: "trick the other people",
          canAction: "get a number from the machine",
          cantAction: "jump to the front of the line",
          haveToAction: "wait for his number on the screen",
          dontHaveToAction: "pay for a waiting ticket",
          verbBase: "take",
          verbPast: "took",
          verbV3: "taken",
          verbIng: "taking",
          verbS: "takes",
          obj: "a number ticket at the hospital",
          passiveSubject: "A ticket",
          passiveVerbV3: "taken",
          passiveWasOrIs: "was",
          adjBase: "polite",
          adjComp: "more polite",
          adjSuper: "most polite",
        },
        {
          sceneLabel: "in the waiting room",
          location: "in the waiting room",
          mustRule: "sit quietly in the waiting room",
          mustntRule: "bother the sick people",
          shouldAction: "sit calmly on his chair",
          shouldntAction: "make loud noises",
          canAction: "sit on a chair in the waiting room",
          cantAction: "shout in the hospital",
          haveToAction: "share the seats with other people",
          dontHaveToAction: "stand up the whole time",
          verbBase: "wait",
          verbPast: "waited",
          verbV3: "waited",
          verbIng: "waiting",
          verbS: "waits",
          obj: "on a chair in the waiting room",
          passiveSubject: "The chairs",
          passiveVerbV3: "used",
          passiveWasOrIs: "are" as any,
          adjBase: "quiet",
          adjComp: "quieter",
          adjSuper: "quietest",
        },
        {
          sceneLabel: "with his hand stuck",
          location: "at the hospital",
          mustRule: "ask the doctor for help",
          mustntRule: "hide his stuck hand",
          shouldAction: "show his hand to the nurse",
          shouldntAction: "pull the teapot off too hard",
          canAction: "ask the nurse for help",
          cantAction: "use his stuck hand well",
          haveToAction: "show the nurse his hand",
          dontHaveToAction: "fix it all by himself",
          verbBase: "show",
          verbPast: "showed",
          verbV3: "shown",
          verbIng: "showing",
          verbS: "shows",
          obj: "his hand to the nurse",
          passiveSubject: "His hand",
          passiveVerbV3: "checked",
          passiveWasOrIs: "was",
          adjBase: "careful",
          adjComp: "more careful",
          adjSuper: "most careful",
        },
        {
          sceneLabel: "watching the number screen",
          location: "by the number screen",
          mustRule: "watch the screen for his number",
          mustntRule: "push in front of sick people",
          shouldAction: "listen when the nurse calls",
          shouldntAction: "turn his ticket upside down",
          canAction: "read the numbers on the screen",
          cantAction: "go in before his turn",
          haveToAction: "look at the number screen",
          dontHaveToAction: "shout across the room",
          verbBase: "check",
          verbPast: "checked",
          verbV3: "checked",
          verbIng: "checking",
          verbS: "checks",
          obj: "the number on the screen",
          passiveSubject: "His number",
          passiveVerbV3: "called",
          passiveWasOrIs: "was",
          adjBase: "patient",
          adjComp: "more patient",
          adjSuper: "most patient",
        },
        {
          sceneLabel: "inside the hospital",
          location: "inside the hospital",
          mustRule: "follow the hospital rules",
          mustntRule: "touch other people's things",
          shouldAction: "walk slowly in the hall",
          shouldntAction: "run near the wheelchairs",
          canAction: "follow the signs on the wall",
          cantAction: "play with the wheelchairs",
          haveToAction: "listen to the doctor and nurse",
          dontHaveToAction: "wear a doctor's coat",
          verbBase: "follow",
          verbPast: "followed",
          verbV3: "followed",
          verbIng: "following",
          verbS: "follows",
          obj: "the signs in the hospital",
          passiveSubject: "The rules",
          passiveVerbV3: "followed",
          passiveWasOrIs: "are" as any,
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
          sceneLabel: "during the test",
          location: "in the classroom",
          mustRule: "do his own work quietly",
          mustntRule: "copy another student's answers",
          shouldAction: "bring the right pens for the test",
          shouldntAction: "play with toys on his desk",
          canAction: "use a pen to write his answers",
          cantAction: "talk loudly during the test",
          haveToAction: "finish before time runs out",
          dontHaveToAction: "bring twenty pens to class",
          verbBase: "write",
          verbPast: "wrote",
          verbV3: "written",
          verbIng: "writing",
          verbS: "writes",
          obj: "his answers on the paper",
          passiveSubject: "The test paper",
          passiveVerbV3: "written",
          passiveWasOrIs: "was",
          adjBase: "quiet",
          adjComp: "quieter",
          adjSuper: "quietest",
        },
        {
          sceneLabel: "in the classroom",
          location: "in class",
          mustRule: "stop writing when the teacher says stop",
          mustntRule: "cheat on the test",
          shouldAction: "read the test questions carefully",
          shouldntAction: "study the wrong page",
          canAction: "raise his hand for help",
          cantAction: "keep writing after the bell",
          haveToAction: "listen to the teacher",
          dontHaveToAction: "guess every answer fast",
          verbBase: "open",
          verbPast: "opened",
          verbV3: "opened",
          verbIng: "opening",
          verbS: "opens",
          obj: "the paper on the desk",
          passiveSubject: "The test paper",
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
          sceneLabel: "at the restaurant",
          location: "at the table",
          mustRule: "be polite at the table",
          mustntRule: "hide food in someone's bag",
          shouldAction: "order food he likes from the menu",
          shouldntAction: "make a mess with his food",
          canAction: "read the menu at the table",
          cantAction: "throw food around the room",
          haveToAction: "pay for the meal at the end",
          dontHaveToAction: "cook the meal himself",
          verbBase: "order",
          verbPast: "ordered",
          verbV3: "ordered",
          verbIng: "ordering",
          verbS: "orders",
          obj: "a meal from the menu",
          passiveSubject: "The meal",
          passiveVerbV3: "served",
          passiveWasOrIs: "was",
          adjBase: "polite",
          adjComp: "more polite",
          adjSuper: "most polite",
        },
        {
          sceneLabel: "in the kitchen",
          location: "in the kitchen",
          mustRule: "wash his hands before cooking",
          mustntRule: "drop dirty things in the food",
          shouldAction: "cook the food step by step",
          shouldntAction: "spill food on the table",
          canAction: "put the food on a clean plate",
          cantAction: "serve bad food to guests",
          haveToAction: "keep the kitchen clean",
          dontHaveToAction: "eat everything in one bite",
          verbBase: "make",
          verbPast: "made",
          verbV3: "made",
          verbIng: "making",
          verbS: "makes",
          obj: "the food in the kitchen",
          passiveSubject: "The food",
          passiveVerbV3: "made",
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
          sceneLabel: "on his trip",
          location: "at the station",
          mustRule: "show his ticket at the desk",
          mustntRule: "take another person's bag",
          shouldAction: "keep his ticket in a safe place",
          shouldntAction: "lose his bag or ticket",
          canAction: "carry his suitcase to the desk",
          cantAction: "get on without a ticket",
          haveToAction: "follow the travel rules",
          dontHaveToAction: "carry everyone else's bags",
          verbBase: "carry",
          verbPast: "carried",
          verbV3: "carried",
          verbIng: "carrying",
          verbS: "carries",
          obj: "his suitcase on the trip",
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
          sceneLabel: "while driving his car",
          location: "on the street",
          mustRule: "follow the road signs",
          mustntRule: "push another car out of the way",
          shouldAction: "look in the mirrors before turning",
          shouldntAction: "park in a no-parking area",
          canAction: "drive the small green car",
          cantAction: "break the traffic rules",
          haveToAction: "lock the car after parking",
          dontHaveToAction: "take the steering wheel with him",
          verbBase: "drive",
          verbPast: "drove",
          verbV3: "driven",
          verbIng: "driving",
          verbS: "drives",
          obj: "his car down the street",
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
      chaptersRaw.slice(0, 12).forEach((ch, cIdx) => {
        const cleanChap = ch.title.replace(/[^\w\s'-]/g, "").trim();
        if (cleanChap.length > 2) {
          const verbPool = [
            { b: "watch", p: "watched", v3: "watched", ing: "watching", s: "watches", pSubj: "The scene", pV3: "shown" },
            { b: "check", p: "checked", v3: "checked", ing: "checking", s: "checks", pSubj: "The plan", pV3: "checked" },
            { b: "Start".toLowerCase(), p: "started", v3: "started", ing: "starting", s: "starts", pSubj: "The action", pV3: "started" },
            { b: "follow", p: "followed", v3: "followed", ing: "following", s: "follows", pSubj: "The rule", pV3: "followed" },
          ];
          const vp = verbPool[cIdx % verbPool.length];
          scenes.push({
            sceneLabel: `in "${cleanChap}"`,
            location: `in "${cleanChap}"`,
            mustRule: `pay attention in "${cleanChap}"`,
            mustntRule: `cause trouble in "${cleanChap}"`,
            shouldAction: `be careful during "${cleanChap}"`,
            shouldntAction: `make a mistake in "${cleanChap}"`,
            canAction: `see what happens in "${cleanChap}"`,
            cantAction: `break the rules in "${cleanChap}"`,
            haveToAction: `stay focused in "${cleanChap}"`,
            dontHaveToAction: `make a mess in "${cleanChap}"`,
            verbBase: vp.b,
            verbPast: vp.p,
            verbV3: vp.v3,
            verbIng: vp.ing,
            verbS: vp.s,
            obj: `what happens in "${cleanChap}"`,
            passiveSubject: vp.pSubj,
            passiveVerbV3: vp.pV3,
            passiveWasOrIs: "is",
            adjBase: "careful",
            adjComp: "more careful",
            adjSuper: "most careful",
          });
        }
      });
    }

    // 6b. Extract timestamped transcript moments so questions directly match real spoken lines
    if (typeof videoTranscriptRaw === "string" && videoTranscriptRaw.trim()) {
      const lines = videoTranscriptRaw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const actionCycles = [
        { b: "listen", p: "listened", v3: "listened", ing: "listening", s: "listens", adjB: "careful", adjC: "more careful", adjS: "most careful" },
        { b: "explain", p: "explained", v3: "explained", ing: "explaining", s: "explains", adjB: "clear", adjC: "clearer", adjS: "clearest" },
        { b: "learn", p: "learned", v3: "learned", ing: "learning", s: "learns", adjB: "good", adjC: "better", adjS: "best" },
        { b: "answer", p: "answered", v3: "answered", ing: "answering", s: "answers", adjB: "quick", adjC: "quicker", adjS: "quickest" },
        { b: "help", p: "helped", v3: "helped", ing: "helping", s: "helps", adjB: "kind", adjC: "kinder", adjS: "kindest" },
        { b: "walk", p: "walked", v3: "walked", ing: "walking", s: "walks", adjB: "fast", adjC: "faster", adjS: "fastest" },
        { b: "look", p: "looked", v3: "looked", ing: "looking", s: "looks", adjB: "quiet", adjC: "quieter", adjS: "quietest" },
        { b: "share", p: "shared", v3: "shared", ing: "sharing", s: "shares", adjB: "polite", adjC: "more polite", adjS: "most polite" },
      ];
      const maxTranscriptScenes = 16;
      const step = Math.max(1, Math.floor(lines.length / maxTranscriptScenes));
      for (let i = 0; i < lines.length && scenes.length < 24; i += step) {
        const line = lines[i];
        const m = line.match(/^\[([0-9:]+)\s*\/\s*(\d+)s\]\s*(.+)$/);
        const timeTag = m?.[1] || "";
        const rawPhrase = (m?.[3] || line)
          .replace(/[^\w\s'-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const words = rawPhrase.split(" ").filter((w) => w.length > 2);
        if (words.length < 2) continue;
        const snippetWords = words.slice(0, 5).join(" ");
        const ac = actionCycles[scenes.length % actionCycles.length];
        const tagLabel = timeTag ? `at ${timeTag}` : `in part ${scenes.length + 1}`;
        scenes.push({
          sceneLabel: `${tagLabel} ("${snippetWords}")`,
          location: tagLabel,
          mustRule: `listen carefully ${tagLabel}`,
          mustntRule: `forget the lesson about "${snippetWords}"`,
          shouldAction: `pay attention to "${snippetWords}"`,
          shouldntAction: `ignore what happens ${tagLabel}`,
          canAction: `understand "${snippetWords}" ${tagLabel}`,
          cantAction: `skip the rule ${tagLabel}`,
          haveToAction: `remember what is shown ${tagLabel}`,
          dontHaveToAction: `make a mistake ${tagLabel}`,
          verbBase: ac.b,
          verbPast: ac.p,
          verbV3: ac.v3,
          verbIng: ac.ing,
          verbS: ac.s,
          obj: `about "${snippetWords}" ${tagLabel}`,
          passiveSubject: `The idea "${snippetWords}"`,
          passiveVerbV3: "shown",
          passiveWasOrIs: "is",
          adjBase: ac.adjB,
          adjComp: ac.adjC,
          adjSuper: ac.adjS,
        });
      }
    }

    // 7. Universal easy video-title-specific scenes so up to 30+ questions are always distinct
    const cleanTitle = (videoTitleRaw || "").replace(/\s*\|.*$/, "").trim() || "the video";
    const genericAdditions: ScannedVideoScene[] = [
      {
        sceneLabel: "at the start of the video",
        location: "at the start",
        mustRule: "follow the rules",
        mustntRule: "break the rules",
        shouldAction: "look carefully before acting",
        shouldntAction: "make a silly mistake",
        canAction: "see what the problem is",
        cantAction: "ignore the rules",
        haveToAction: "solve the problem",
        dontHaveToAction: "make a big mess",
        verbBase: "arrive",
        verbPast: "arrived",
        verbV3: "arrived",
        verbIng: "arriving",
        verbS: "arrives",
        obj: `at the place in "${cleanTitle}"`,
        passiveSubject: "The problem",
        passiveVerbV3: "started",
        passiveWasOrIs: "was",
        adjBase: "careful",
        adjComp: "more careful",
        adjSuper: "most careful",
      },
      {
        sceneLabel: "when the problem starts",
        location: "in this scene",
        mustRule: "be polite to other people",
        mustntRule: "push or bother other people",
        shouldAction: "ask for help politely",
        shouldntAction: "blame someone else",
        canAction: "ask another person for help",
        cantAction: "fix it by making more trouble",
        haveToAction: "wait his turn",
        dontHaveToAction: "push ahead of others",
        verbBase: "try",
        verbPast: "tried",
        verbV3: "tried",
        verbIng: "trying",
        verbS: "tries",
        obj: "to fix the problem",
        passiveSubject: "A plan",
        passiveVerbV3: "tried",
        passiveWasOrIs: "was",
        adjBase: "patient",
        adjComp: "more patient",
        adjSuper: "most patient",
      },
      {
        sceneLabel: "in the middle of the video",
        location: "in the room",
        mustRule: "keep everyone safe",
        mustntRule: "touch other people's things",
        shouldAction: "use things safely",
        shouldntAction: "do something dangerous",
        canAction: "see how people react",
        cantAction: "hide what happened",
        haveToAction: "follow the instructions",
        dontHaveToAction: "cause trouble for others",
        verbBase: "look",
        verbPast: "looked",
        verbV3: "looked",
        verbIng: "looking",
        verbS: "looks",
        obj: "around the room",
        passiveSubject: "The rules",
        passiveVerbV3: "followed",
        passiveWasOrIs: "were" as any,
        adjBase: "safe",
        adjComp: "safer",
        adjSuper: "safest",
      },
      {
        sceneLabel: "when someone comes to help",
        location: "nearby",
        mustRule: "listen to good advice",
        mustntRule: "shout at people nearby",
        shouldAction: "work together calmly",
        shouldntAction: "run away with someone's things",
        canAction: "find a smart way to help",
        cantAction: "be rude to other people",
        haveToAction: "check what happens next",
        dontHaveToAction: "panic in this moment",
        verbBase: "help",
        verbPast: "helped",
        verbV3: "helped",
        verbIng: "helping",
        verbS: "helps",
        obj: "with the situation",
        passiveSubject: "The problem",
        passiveVerbV3: "solved",
        passiveWasOrIs: "was",
        adjBase: "helpful",
        adjComp: "more helpful",
        adjSuper: "most helpful",
      },
      {
        sceneLabel: "during the next part",
        location: "in the next scene",
        mustRule: "wait patiently for his turn",
        mustntRule: "interrupt other people",
        shouldAction: "check the signs around the room",
        shouldntAction: "drop things on the floor",
        canAction: "notice what is on the wall",
        cantAction: "make loud noise here",
        haveToAction: "stay in the right place",
        dontHaveToAction: "hurry without looking",
        verbBase: "walk",
        verbPast: "walked",
        verbV3: "walked",
        verbIng: "walking",
        verbS: "walks",
        obj: "across the room carefully",
        passiveSubject: "The door",
        passiveVerbV3: "opened",
        passiveWasOrIs: "was",
        adjBase: "calm",
        adjComp: "calmer",
        adjSuper: "calmest",
      },
      {
        sceneLabel: "near the end of the video",
        location: "at the end",
        mustRule: "follow the right rules",
        mustntRule: "make the same mistake again",
        shouldAction: "say sorry and clean up",
        shouldntAction: "leave a mess behind",
        canAction: "see the funny ending",
        cantAction: "break the rules without trouble",
        haveToAction: "learn from the mistake",
        dontHaveToAction: "do it the wrong way again",
        verbBase: "finish",
        verbPast: "finished",
        verbV3: "finished",
        verbIng: "finishing",
        verbS: "finishes",
        obj: "what he was doing",
        passiveSubject: "The lesson",
        passiveVerbV3: "learned",
        passiveWasOrIs: "was",
        adjBase: "good",
        adjComp: "better",
        adjSuper: "best",
      },
    ];
    for (const add of genericAdditions) {
      if (scenes.length < 10) scenes.push(add);
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
    chaptersRaw?: Array<{ title: string; sec: number }>,
    videoTranscriptRaw?: string,
    videoKeywordsRaw?: string[]
  ) => {
    const rawTopicClean = (topicRaw || "").trim();
    const topicLower = rawTopicClean.toLowerCase();
    const count = Math.max(1, Math.min(100, Number(countRaw) || 5));
    const types =
      Array.isArray(typesRaw) && typesRaw.length > 0
        ? typesRaw
        : ["Fill in the Blanks", "Multiple Choice", "Grammar Choice"];
    const namedSubject = extractVideoSubject(videoTitleRaw, topicRaw);
    const adaptPronoun = (phrase: string, subj: string) => {
      if (subj !== "She") return phrase;
      return phrase
        .replace(/\bhimself\b/gi, "herself")
        .replace(/\bhis\b/gi, "her")
        .replace(/\bhe\b/gi, "she")
        .replace(/\bhim\b/gi, "her");
    };
    const pickPronounForIndex = (idx: number) =>
      namedSubject ? namedSubject : idx % 2 === 0 ? "He" : "She";
    const subject = namedSubject || "He";
    const isPluralFor = (subjStr: string) =>
      /^(they|we|you)$/i.test(subjStr.trim()) || /\b(and|minions|kids|students|friends|people)\b/i.test(subjStr);

    const isPluralSubject = isPluralFor(subject);
    const subjPronoun = isPluralSubject ? "they" : subject === "She" ? "she" : "he";
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
      subject,
      videoTranscriptRaw,
      videoKeywordsRaw
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
    // 1. MUST AND MUSTN'T
    // =========================================================================
    if (/\bmust\b|\bmustn'?t\b|\bmust\s+not\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const mustRule = adaptPronoun(sc.mustRule, scSubj);
        const mustntRule = adaptPronoun(sc.mustntRule, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (must / mustn't) ${mustntRule}.`,
            answer: "mustn't",
            acceptedAnswers: ["mustn't", "must not", "mustnt"],
            options: [
              { text: "mustn't", isCorrect: true },
              { text: "must", isCorrect: false },
              { text: "must to", isCorrect: false },
              { text: "musts", isCorrect: false },
            ],
            explanation: `Use "mustn't" when something is not allowed.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (must / mustn't) ${mustRule}.`,
            answer: "must",
            acceptedAnswers: ["must"],
            options: [
              { text: "must", isCorrect: true },
              { text: "mustn't", isCorrect: false },
              { text: "musts", isCorrect: false },
              { text: "must to", isCorrect: false },
            ],
            explanation: `Use "must" for an important rule.`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} ____ ${mustntRule}!`,
            answer: "mustn't",
            acceptedAnswers: ["mustn't", "must not"],
            options: [
              { text: "mustn't", isCorrect: true },
              { text: "must", isCorrect: false },
              { text: "must to", isCorrect: false },
              { text: "don't must", isCorrect: false },
            ],
            explanation: `Use "mustn't" because this is not allowed. Never say "don't must" or "must to".`,
          },
          {
            type: "Multiple Choice",
            question: `Which sentence is correct ${sc.sceneLabel}?`,
            answer: `${scSubj} must ${mustRule}.`,
            acceptedAnswers: [`${scSubj} must ${mustRule}.`, "must"],
            options: [
              { text: `${scSubj} must ${mustRule}.`, isCorrect: true },
              { text: `${scSubj} musts ${mustRule}.`, isCorrect: false },
              { text: `${scSubj} must to ${mustRule}.`, isCorrect: false },
              { text: `${scSubj} musting ${mustRule}.`, isCorrect: false },
            ],
            explanation: `Use "must" + the simple verb (no "-s" and no "to").`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} must ____ (${sc.verbBase}) ${sc.location}.`,
            answer: sc.verbBase,
            acceptedAnswers: [sc.verbBase, `must ${sc.verbBase}`],
            options: [
              { text: sc.verbBase, isCorrect: true },
              { text: `to ${sc.verbBase}`, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `After "must", use the base verb "${sc.verbBase}".`,
          }
        );
      });
    }
    // =========================================================================
    // 2. SHOULD AND SHOULDN'T
    // =========================================================================
    else if (/\bshould\b|\bshouldn'?t\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const shouldAction = adaptPronoun(sc.shouldAction, scSubj);
        const shouldntAction = adaptPronoun(sc.shouldntAction, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (should / shouldn't) ${shouldntAction}.`,
            answer: "shouldn't",
            acceptedAnswers: ["shouldn't", "should not", "shouldnt"],
            options: [
              { text: "shouldn't", isCorrect: true },
              { text: "should", isCorrect: false },
              { text: "should to", isCorrect: false },
              { text: "shoulds", isCorrect: false },
            ],
            explanation: `Use "shouldn't" because it is not a good idea.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (should / shouldn't) ${shouldAction}.`,
            answer: "should",
            acceptedAnswers: ["should"],
            options: [
              { text: "should", isCorrect: true },
              { text: "shouldn't", isCorrect: false },
              { text: "shoulds", isCorrect: false },
              { text: "should to", isCorrect: false },
            ],
            explanation: `Use "should" for good advice.`,
          },
          {
            type: "Grammar Choice",
            question: `Which sentence gives good advice ${sc.sceneLabel}?`,
            answer: `${scSubj} should ${shouldAction}.`,
            options: [
              { text: `${scSubj} should ${shouldAction}.`, isCorrect: true },
              { text: `${scSubj} should to ${shouldAction}.`, isCorrect: false },
              { text: `${scSubj} shoulds ${shouldAction}.`, isCorrect: false },
              { text: `${scSubj} don't should ${shouldntAction}.`, isCorrect: false },
            ],
            explanation: `Use "should" + the base verb (no "to").`,
          }
        );
      });
    }
    // =========================================================================
    // 3. CAN AND CAN'T / COULD AND COULDN'T
    // =========================================================================
    else if (/\bcan\b|\bcan'?t\b|\bcannot\b|\bcould\b|\bcouldn'?t\b/i.test(topicLower)) {
      const useCould = /\bcould/i.test(topicLower);
      const posModal = useCould ? "could" : "can";
      const negModal = useCould ? "couldn't" : "can't";
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const canAct = adaptPronoun(sc.canAction, scSubj);
        const cantAct = adaptPronoun(sc.cantAction, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${posModal} / ${negModal}) ${cantAct}.`,
            answer: negModal,
            acceptedAnswers: [negModal, useCould ? "could not" : "cannot", useCould ? "couldnt" : "cant"],
            options: [
              { text: negModal, isCorrect: true },
              { text: posModal, isCorrect: false },
              { text: `${posModal} to`, isCorrect: false },
              { text: `${posModal}s`, isCorrect: false },
            ],
            explanation: `Use "${negModal}" when something is not possible or not allowed.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${posModal} / ${negModal}) ${canAct}.`,
            answer: posModal,
            acceptedAnswers: [posModal],
            options: [
              { text: posModal, isCorrect: true },
              { text: negModal, isCorrect: false },
              { text: `${posModal} to`, isCorrect: false },
              { text: `${posModal}s`, isCorrect: false },
            ],
            explanation: `Use "${posModal}" to talk about what is possible.`,
          },
          {
            type: "Grammar Choice",
            question: `Which sentence is correct ${sc.sceneLabel}?`,
            answer: `${scSubj} ${negModal} ${cantAct}.`,
            options: [
              { text: `${scSubj} ${negModal} ${cantAct}.`, isCorrect: true },
              { text: `${scSubj} ${posModal}s ${canAct}.`, isCorrect: false },
              { text: `${scSubj} ${posModal} to ${canAct}.`, isCorrect: false },
              { text: `${scSubj} don't ${posModal} ${cantAct}.`, isCorrect: false },
            ],
            explanation: `Use "${negModal}" + base verb without "to" or "-s".`,
          }
        );
      });
    }
    // =========================================================================
    // 4. HAVE TO / HAS TO / DON'T HAVE TO / DOESN'T HAVE TO
    // =========================================================================
    else if (/\bhave\s+to\b|\bhas\s+to\b|\bdon'?t\s+have\s+to\b|\bdoesn'?t\s+have\s+to\b/i.test(topicLower)) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const haveToAct = adaptPronoun(sc.haveToAction, scSubj);
        const dontHaveAct = adaptPronoun(sc.dontHaveToAction, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${haveToPos} / ${haveToNeg}) ${haveToAct}.`,
            answer: haveToPos,
            acceptedAnswers: [haveToPos, "must"],
            options: [
              { text: haveToPos, isCorrect: true },
              { text: haveToNeg, isCorrect: false },
              { text: isPluralSubject ? "has to" : "have to", isCorrect: false },
              { text: "having to", isCorrect: false },
            ],
            explanation: `Use "${haveToPos}" with "${scSubj}" when something is needed.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${haveToPos} / ${haveToNeg}) ${dontHaveAct}.`,
            answer: haveToNeg,
            acceptedAnswers: [haveToNeg],
            options: [
              { text: haveToNeg, isCorrect: true },
              { text: haveToPos, isCorrect: false },
              { text: isPluralSubject ? "doesn't have to" : "don't have to", isCorrect: false },
              { text: "haven't to", isCorrect: false },
            ],
            explanation: `Use "${haveToNeg}" when you do not need to do it.`,
          }
        );
      });
    }
    // =========================================================================
    // 5. PRESENT PERFECT (Specific regex — never false-trigger on "for" or "have to")
    // =========================================================================
    else if (
      /\bpresent\s*perf/i.test(topicLower) ||
      /\bpast\s*participle\b|\bv3\b/i.test(topicLower) ||
      /\b(just|already|yet|ever|never)\b/i.test(topicLower) ||
      /\bfor\s+(and|vs\.?|or|\/)\s+since\b|\bsince\s+(and|vs\.?|or|\/)\s+for\b/i.test(topicLower)
    ) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ${hasAux} ____ (${sc.verbBase}) ${scObj}.`,
            answer: sc.verbV3,
            acceptedAnswers: [sc.verbV3, `${hasAux} ${sc.verbV3}`],
            options: [
              { text: sc.verbV3, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `After "${hasAux}", use "${sc.verbV3}".`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} ____ just ${sc.verbV3} ${scObj}!`,
            answer: hasAux,
            acceptedAnswers: [hasAux],
            options: [
              { text: hasAux, isCorrect: true },
              { text: wrongAux, isCorrect: false },
              { text: "did", isCorrect: false },
              { text: isAux, isCorrect: false },
            ],
            explanation: `Use "${hasAux} + ${sc.verbV3}" for Present Perfect.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (have / has) ${sc.verbV3} ${scObj}.`,
            answer: hasAux,
            acceptedAnswers: [hasAux, `${hasAux} ${sc.verbV3}`],
            options: [
              { text: hasAux, isCorrect: true },
              { text: wrongAux, isCorrect: false },
              { text: "did", isCorrect: false },
              { text: wasAux, isCorrect: false },
            ],
            explanation: `With "${scSubj}", we use "${hasAux}".`,
          },
          {
            type: "Multiple Choice",
            question: `What has ${scSubj === "He" || scSubj === "She" ? scSubj.toLowerCase() : scSubj} done ${adaptPronoun(sc.sceneLabel, scSubj)}?`,
            answer: `${scSubj} ${hasAux} ${sc.verbV3} ${scObj}.`,
            options: [
              { text: `${scSubj} ${hasAux} ${sc.verbV3} ${scObj}.`, isCorrect: true },
              { text: `${scSubj} ${wrongAux} ${sc.verbBase} ${scObj}.`, isCorrect: false },
              { text: `${scSubj} ${isAux} ${sc.verbV3} ${scObj}.`, isCorrect: false },
              { text: `${scSubj} didn't ${sc.verbV3} ${scObj}.`, isCorrect: false },
            ],
            explanation: `"${hasAux} ${sc.verbV3}" is the correct Present Perfect form.`,
          }
        );
      });
    }
    // =========================================================================
    // 6. PAST SIMPLE
    // =========================================================================
    else if (topicLower.includes("past simple") || topicLower.includes("simple past")) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${sc.verbBase}) ${scObj}.`,
            answer: sc.verbPast,
            acceptedAnswers: [sc.verbPast],
            options: [
              { text: sc.verbPast, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `The past form of "${sc.verbBase}" is "${sc.verbPast}".`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} didn't ____ (${sc.verbBase}) ${sc.location}.`,
            answer: sc.verbBase,
            options: [
              { text: sc.verbBase, isCorrect: true },
              { text: sc.verbPast, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
            ],
            explanation: `After "didn't", always use the base verb "${sc.verbBase}".`,
          },
          {
            type: "Multiple Choice",
            question: `What did ${scSubj === "He" || scSubj === "She" ? scSubj.toLowerCase() : scSubj} do ${adaptPronoun(sc.sceneLabel, scSubj)}?`,
            answer: `${scSubj} ${sc.verbPast} ${scObj}.`,
            options: [
              { text: `${scSubj} ${sc.verbPast} ${scObj}.`, isCorrect: true },
              { text: `${scSubj} did ${sc.verbPast} ${scObj}.`, isCorrect: false },
              { text: `${scSubj} ${wasAux} ${sc.verbPast} ${scObj}.`, isCorrect: false },
              { text: `${scSubj} ${sc.verbBase} ${scObj} yesterday.`, isCorrect: false },
            ],
            explanation: `In Past Simple statements, use "${sc.verbPast}".`,
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
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ${beAux} ____ (${sc.verbBase}) ${scObj}.`,
            answer: sc.verbIng,
            acceptedAnswers: [sc.verbIng, `${beAux} ${sc.verbIng}`],
            options: [
              { text: sc.verbIng, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbPast, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `After "${beAux}", use "${sc.verbIng}".`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} ____ ${sc.verbIng} ${scObj}.`,
            answer: beAux,
            options: [
              { text: beAux, isCorrect: true },
              { text: wrongBe, isCorrect: false },
              { text: isPastCont ? "did" : "does", isCorrect: false },
              { text: hasAux, isCorrect: false },
            ],
            explanation: `With "${scSubj}", use "${beAux} + ${sc.verbIng}".`,
          }
        );
      });
    }
    // =========================================================================
    // 8. PRESENT SIMPLE
    // =========================================================================
    else if (topicLower.includes("present simple") || topicLower.includes("simple present")) {
      const targetVerbForm = isPluralSubject ? "base" : "s";
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        const correctForm = targetVerbForm === "s" ? sc.verbS : sc.verbBase;
        const wrongForm = targetVerbForm === "s" ? sc.verbBase : sc.verbS;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${sc.verbBase}) ${scObj}.`,
            answer: correctForm,
            acceptedAnswers: [correctForm],
            options: [
              { text: correctForm, isCorrect: true },
              { text: wrongForm, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbPast, isCorrect: false },
            ],
            explanation: `With "${scSubj}", we say "${correctForm}".`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} ${doesntAux} ____ ${scObj}.`,
            answer: sc.verbBase,
            options: [
              { text: sc.verbBase, isCorrect: true },
              { text: sc.verbS, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbPast, isCorrect: false },
            ],
            explanation: `After "${doesntAux}", use the base verb "${sc.verbBase}".`,
          }
        );
      });
    }
    // =========================================================================
    // 9. FUTURE (WILL / WON'T / GOING TO)
    // =========================================================================
    else if (/\b(future|will|won'?t|going\s+to)\b/i.test(topicLower)) {
      const useGoingTo = topicLower.includes("going to");
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        const mustRule = adaptPronoun(sc.mustRule, scSubj);
        if (useGoingTo) {
          bank.push(
            {
              type: "Fill in the Blanks",
              question: `${scSubj} ${isAux} going to ____ (${sc.verbBase}) ${scObj}.`,
              answer: sc.verbBase,
              acceptedAnswers: [sc.verbBase],
              options: [
                { text: sc.verbBase, isCorrect: true },
                { text: sc.verbIng, isCorrect: false },
                { text: sc.verbPast, isCorrect: false },
                { text: sc.verbS, isCorrect: false },
              ],
              explanation: `After "going to", use the base verb "${sc.verbBase}".`,
            },
            {
              type: "Grammar Choice",
              question: `${scSubj} ____ going to ${sc.verbBase} ${sc.location}.`,
              answer: isAux,
              options: [
                { text: isAux, isCorrect: true },
                { text: wrongIsAux, isCorrect: false },
                { text: "will", isCorrect: false },
                { text: "did", isCorrect: false },
              ],
              explanation: `Use "${isAux} going to" with "${scSubj}".`,
            }
          );
        } else {
          bank.push(
            {
              type: "Fill in the Blanks",
              question: `${scSubj} ____ (will / won't) ${mustRule}.`,
              answer: "will",
              acceptedAnswers: ["will"],
              options: [
                { text: "will", isCorrect: true },
                { text: "won't", isCorrect: false },
                { text: "will to", isCorrect: false },
                { text: "wills", isCorrect: false },
              ],
              explanation: `Use "will" + base verb for future actions.`,
            },
            {
              type: "Grammar Choice",
              question: `${scSubj} will ____ ${sc.location}.`,
              answer: sc.verbBase,
              options: [
                { text: sc.verbBase, isCorrect: true },
                { text: `to ${sc.verbBase}`, isCorrect: false },
                { text: sc.verbIng, isCorrect: false },
                { text: sc.verbPast, isCorrect: false },
              ],
              explanation: `After "will", use the base verb "${sc.verbBase}" (no "to").`,
            }
          );
        }
      });
    }
    // =========================================================================
    // 10. PASSIVE VOICE
    // =========================================================================
    else if (topicLower.includes("passive")) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        const auxWord = sc.passiveWasOrIs;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${sc.passiveSubject} ${auxWord} ____ (${sc.verbBase}) ${sc.location}.`,
            answer: sc.passiveVerbV3,
            acceptedAnswers: [sc.passiveVerbV3, `${auxWord} ${sc.passiveVerbV3}`],
            options: [
              { text: sc.passiveVerbV3, isCorrect: true },
              { text: sc.verbBase, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: sc.verbS, isCorrect: false },
            ],
            explanation: `Passive voice uses "${auxWord} + ${sc.passiveVerbV3}".`,
          },
          {
            type: "Grammar Choice",
            question: `Which sentence is in the Passive Voice?`,
            answer: `${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3} ${sc.location}.`,
            options: [
              { text: `${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3} ${sc.location}.`, isCorrect: true },
              { text: `${scSubj} ${sc.verbPast} ${scObj}.`, isCorrect: false },
              { text: `${scSubj} ${isAux} ${sc.verbIng} ${scObj}.`, isCorrect: false },
              { text: `${sc.passiveSubject} ${sc.verbBase} ${sc.location}.`, isCorrect: false },
            ],
            explanation: `"${sc.passiveSubject} ${auxWord} ${sc.passiveVerbV3}" is Passive Voice.`,
          }
        );
      });
    }
    // =========================================================================
    // 11. CONDITIONALS (First / Second / Zero / If-clauses)
    // =========================================================================
    else if (topicLower.includes("conditional") || /\bif\s+clause/i.test(topicLower)) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        const presForm = isPluralSubject ? sc.verbBase : sc.verbS;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `If ${scSubj.toLowerCase() === scSubj ? scSubj : scSubj} ____ (${sc.verbBase}) ${scObj}, everyone will notice.`,
            answer: presForm,
            acceptedAnswers: [presForm],
            options: [
              { text: presForm, isCorrect: true },
              { text: `will ${sc.verbBase}`, isCorrect: false },
              { text: sc.verbIng, isCorrect: false },
              { text: `would ${sc.verbBase}`, isCorrect: false },
            ],
            explanation: `In First Conditional, use Present Simple ("${presForm}") after "If".`,
          },
          {
            type: "Grammar Choice",
            question: `If ${scSubj === "He" || scSubj === "She" ? scSubj.toLowerCase() : scSubj} ${sc.verbPast} carefully, ${scSubj === "She" ? "she" : "he"} ____ get into trouble.`,
            answer: "wouldn't",
            acceptedAnswers: ["wouldn't", "would not"],
            options: [
              { text: "wouldn't", isCorrect: true },
              { text: "won't", isCorrect: false },
              { text: "didn't", isCorrect: false },
              { text: "don't", isCorrect: false },
            ],
            explanation: `In Second Conditional, use "would / wouldn't" with "If + Past Simple".`,
          }
        );
      });
    }
    // =========================================================================
    // 12. COMPARATIVES AND SUPERLATIVES
    // =========================================================================
    else if (topicLower.includes("comparative") || topicLower.includes("superlative")) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} should be ____ (${sc.adjBase}) than before.`,
            answer: sc.adjComp,
            acceptedAnswers: [sc.adjComp],
            options: [
              { text: sc.adjComp, isCorrect: true },
              { text: sc.adjBase, isCorrect: false },
              { text: sc.adjSuper, isCorrect: false },
              { text: `more ${sc.adjComp}`, isCorrect: false },
            ],
            explanation: `Before "than", use the comparative "${sc.adjComp}".`,
          },
          {
            type: "Grammar Choice",
            question: `What is the ____ (${sc.adjBase}) thing to do ${sc.location}?`,
            answer: sc.adjSuper,
            acceptedAnswers: [sc.adjSuper],
            options: [
              { text: sc.adjSuper, isCorrect: true },
              { text: sc.adjComp, isCorrect: false },
              { text: sc.adjBase, isCorrect: false },
              { text: `most ${sc.adjSuper}`, isCorrect: false },
            ],
            explanation: `After "the", use the superlative "${sc.adjSuper}".`,
          }
        );
      });
    }
    // =========================================================================
    // 13. PREPOSITIONS / ARTICLES / RELATIVE CLAUSES
    // =========================================================================
    else if (topicLower.includes("preposition")) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `${scSubj} is standing ____ (in / on / at) the door ${adaptPronoun(sc.sceneLabel, scSubj)}.`,
            answer: "at",
            acceptedAnswers: ["at", "near", "by"],
            options: [
              { text: "at", isCorrect: true },
              { text: "on", isCorrect: false },
              { text: "to", isCorrect: false },
              { text: "over", isCorrect: false },
            ],
            explanation: `Use "at" for a specific point like the door or desk.`,
          },
          {
            type: "Grammar Choice",
            question: `${scSubj} puts the bag ____ the table ${sc.location}.`,
            answer: "on",
            options: [
              { text: "on", isCorrect: true },
              { text: "between", isCorrect: false },
              { text: "into", isCorrect: false },
              { text: "above", isCorrect: false },
            ],
            explanation: `Use "on" when something rests on top of a surface.`,
          }
        );
      });
    } else if (topicLower.includes("article") || /\b(a\s*,\s*an|a\s*\/\s*an|no\s+article)\b/i.test(topicLower)) {
      const articleItems: Array<{
        type: string;
        q: (p: string) => string;
        ans: string;
        accepted?: string[];
        opts: Array<{ text: string; isCorrect: boolean }>;
        exp: string;
      }> = [
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} carried ____ (a / an) umbrella because it started to rain.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "an" before a vowel sound ("umbrella").`,
        },
        {
          type: "Grammar Choice",
          q: (p) => `${p} waited for almost ____ hour outside the door.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `The "h" in "hour" is silent, so it starts with a vowel sound ("an hour").`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} wore ____ (a / an) bright blue uniform at work.`,
          ans: "a",
          opts: [
            { text: "a", isCorrect: true },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `"Uniform" begins with a "y" consonant sound (/juː/), so use "a".`,
        },
        {
          type: "Multiple Choice",
          q: (p) => `${p} picked up a heavy bag. ____ bag nearly fell on the floor.`,
          ans: "The",
          opts: [
            { text: "The", isCorrect: true },
            { text: "A", isCorrect: false },
            { text: "An", isCorrect: false },
            { text: "No article", isCorrect: false },
          ],
          exp: `Use "The" when talking about a specific item mentioned a second time.`,
        },
        {
          type: "Grammar Choice",
          q: (p) => `${p} asked for ____ cold water after walking up the stairs.`,
          ans: "no article",
          accepted: ["no article", "-", "none"],
          opts: [
            { text: "no article", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
          ],
          exp: `Use no article before uncountable nouns like "water" when speaking in general.`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} usually eats ____ (a / no article) breakfast at eight o'clock.`,
          ans: "no article",
          accepted: ["no article", "-"],
          opts: [
            { text: "no article", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
          ],
          exp: `We do not normally use an article before meal names like "breakfast".`,
        },
        {
          type: "Grammar Choice",
          q: () => `Look up! ____ sun is shining brightly over the street.`,
          ans: "The",
          opts: [
            { text: "The", isCorrect: true },
            { text: "A", isCorrect: false },
            { text: "An", isCorrect: false },
            { text: "No article", isCorrect: false },
          ],
          exp: `Use "The" for unique things in nature such as "the sun" or "the sky".`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} found ____ (a / an) empty seat right beside the window.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "an" before vowel sounds like "empty".`,
        },
        {
          type: "Multiple Choice",
          q: (p) => `${p} plays ____ piano calmly after finishing work.`,
          ans: "the",
          opts: [
            { text: "the", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "the" before musical instruments with "play" (play the piano).`,
        },
        {
          type: "Grammar Choice",
          q: (p) => `${p} loves playing ____ tennis in the park on weekends.`,
          ans: "no article",
          opts: [
            { text: "no article", isCorrect: true },
            { text: "the", isCorrect: false },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
          ],
          exp: `Do not use an article before sports such as "tennis" or "football".`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} bought ____ (a / an) paper ticket from the counter.`,
          ans: "a",
          opts: [
            { text: "a", isCorrect: true },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "a" before singular countable nouns starting with a consonant sound ("paper ticket").`,
        },
        {
          type: "Grammar Choice",
          q: () => `Please shut ____ front door so the wind stays outside.`,
          ans: "the",
          opts: [
            { text: "the", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "the" because both speakers know which specific door is meant.`,
        },
        {
          type: "Multiple Choice",
          q: (p) => `${p} speaks ____ English clearly when greeting visitors.`,
          ans: "no article",
          opts: [
            { text: "no article", isCorrect: true },
            { text: "the", isCorrect: false },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
          ],
          exp: `Do not use an article before languages like "English".`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} peeled ____ (a / an) orange and placed it in a bowl.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "an" before vowel sounds like "orange".`,
        },
        {
          type: "Grammar Choice",
          q: (p) => `${p} noticed a stray cat. ____ cat jumped onto the bench.`,
          ans: "The",
          opts: [
            { text: "The", isCorrect: true },
            { text: "A", isCorrect: false },
            { text: "An", isCorrect: false },
            { text: "No article", isCorrect: false },
          ],
          exp: `Use "The" because "cat" was already introduced in the first sentence.`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} stays awake reading ____ (the / no article) most nights.`,
          ans: "no article",
          accepted: ["no article", "-"],
          opts: [
            { text: "no article", isCorrect: true },
            { text: "the", isCorrect: false },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
          ],
          exp: `Use no article in the phrase "most nights" when speaking generally.`,
        },
        {
          type: "Grammar Choice",
          q: (p) => `${p} gave ____ honest answer when the friend asked why.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `"Honest" begins with a silent "h", so use "an".`,
        },
        {
          type: "Multiple Choice",
          q: () => `Which sentence uses "a", "an", and "the" correctly?`,
          ans: `She put the key in a small pocket.`,
          opts: [
            { text: `She put the key in a small pocket.`, isCorrect: true },
            { text: `She put a key in an small pocket.`, isCorrect: false },
            { text: `She drinks a water every morning.`, isCorrect: false },
            { text: `He waited for a hour outside.`, isCorrect: false },
          ],
          exp: `"a small pocket" and "the key" are both grammatically correct.`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} drew ____ (a / an) quick map on a napkin.`,
          ans: "a",
          opts: [
            { text: "a", isCorrect: true },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "a" before consonant sounds like "quick".`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} checked ____ (a / the) clock on the wall before leaving.`,
          ans: "the",
          opts: [
            { text: "the", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "the" for a specific object in the room ("the clock on the wall").`,
        },
        {
          type: "Multiple Choice",
          q: (p) => `${p} travels to work by ____ bus every morning.`,
          ans: "no article",
          opts: [
            { text: "no article", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "an", isCorrect: false },
            { text: "the", isCorrect: false },
          ],
          exp: `Use no article after "by" with transport ("by bus", "by train").`,
        },
        {
          type: "Fill in the Blanks",
          q: (p) => `${p} packed ____ (a / an) extra jacket inside the backpack.`,
          ans: "an",
          opts: [
            { text: "an", isCorrect: true },
            { text: "a", isCorrect: false },
            { text: "the", isCorrect: false },
            { text: "no article", isCorrect: false },
          ],
          exp: `Use "an" before vowel sounds like "extra".`,
        },
      ];

      articleItems.forEach((item, idx) => {
        const p = namedSubject || (idx % 2 === 0 ? "He" : "She");
        bank.push({
          type: item.type,
          question: item.q(p),
          answer: item.ans,
          acceptedAnswers: item.accepted || [item.ans],
          options: item.opts,
          explanation: item.exp,
        });
      });
    } else if (topicLower.includes("relative")) {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const objPronoun = scSubj === "She" ? "her" : scSubj === "He" ? "him" : scSubj;
        bank.push(
          {
            type: "Fill in the Blanks",
            question: `The person ____ (who / which) helps ${objPronoun} ${sc.location} is very kind.`,
            answer: "who",
            acceptedAnswers: ["who", "that"],
            options: [
              { text: "who", isCorrect: true },
              { text: "which", isCorrect: false },
              { text: "where", isCorrect: false },
              { text: "what", isCorrect: false },
            ],
            explanation: `Use "who" when talking about a person.`,
          },
          {
            type: "Grammar Choice",
            question: `This is the place ____ ${scSubj === "He" || scSubj === "She" ? scSubj.toLowerCase() : scSubj} ${sc.verbPast}.`,
            answer: "where",
            options: [
              { text: "where", isCorrect: true },
              { text: "who", isCorrect: false },
              { text: "whose", isCorrect: false },
              { text: "whom", isCorrect: false },
            ],
            explanation: `Use "where" for places.`,
          }
        );
      });
    }
    // =========================================================================
    // 14. BLANK TOPIC OR GENERAL VIDEO COMPREHENSION
    // =========================================================================
    else {
      dynamicScenes.forEach((sc, scIdx) => {
        const scSubj = pickPronounForIndex(scIdx);
        const scObj = adaptPronoun(sc.obj, scSubj);
        bank.push(
          {
            type: "Multiple Choice",
            question: `What happens ${adaptPronoun(sc.sceneLabel, scSubj)} ${videoContextLabel}?`,
            answer: `${scSubj} ${sc.verbS} ${scObj}.`,
            options: [
              { text: `${scSubj} ${sc.verbS} ${scObj}.`, isCorrect: true },
              { text: `Everyone goes to sleep quietly.`, isCorrect: false },
              { text: `Nothing happens in this scene.`, isCorrect: false },
              { text: `The video shows an empty playground.`, isCorrect: false },
            ],
            explanation: `In this scene, ${scSubj === "He" || scSubj === "She" ? scSubj.toLowerCase() : scSubj} ${sc.verbS} ${scObj}.`,
          },
          {
            type: "Fill in the Blanks",
            question: `${scSubj} ____ (${sc.verbBase}) ${scObj}.`,
            answer: sc.verbS,
            acceptedAnswers: [sc.verbS, sc.verbPast, `${isAux} ${sc.verbIng}`],
            options: [
              { text: sc.verbS, isCorrect: true },
              { text: sc.verbIng, isCorrect: false },
              { text: `to ${sc.verbBase}`, isCorrect: false },
              { text: `didn't ${sc.verbPast}`, isCorrect: false },
            ],
            explanation: `${scSubj} ${sc.verbS} ${scObj}.`,
          },
          {
            type: "True or False",
            question: `True or False: ${scSubj} ${sc.verbS} ${scObj} ${sc.location}.`,
            answer: "True",
            options: [
              { text: "True", isCorrect: true },
              { text: "False", isCorrect: false },
            ],
            explanation: `That happens in this scene.`,
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
    const tfTemplates = bank.filter(
      (t) => t.type === "True or False" || t.options.length === 2
    );
    const choiceTemplates = bank.filter(
      (t) => t.type !== "Fill in the Blanks" && t.type !== "True or False"
    );

    const usedQuestions = new Set<string>();
    let fibCursor = 0;
    let tfCursor = 0;
    let choiceCursor = 0;

    return Array.from({ length: count }, (_, index) => {
      const requestedType = types[index % types.length];
      const wantsFib = requestedType === "Fill in the Blanks" && fibTemplates.length > 0;
      const wantsTf = requestedType === "True or False" && tfTemplates.length > 0;

      const pickUnique = (pool: QuizTemplate[], cursorRef: "fib" | "tf" | "choice"): QuizTemplate => {
        const start =
          cursorRef === "fib" ? fibCursor : cursorRef === "tf" ? tfCursor : choiceCursor;
        for (let offset = 0; offset < pool.length; offset++) {
          const cand = pool[(start + offset) % pool.length];
          if (!usedQuestions.has(cand.question)) {
            if (cursorRef === "fib") fibCursor = start + offset + 1;
            else if (cursorRef === "tf") tfCursor = start + offset + 1;
            else choiceCursor = start + offset + 1;
            usedQuestions.add(cand.question);
            return cand;
          }
        }
        const fallback = pool[start % pool.length];
        if (cursorRef === "fib") fibCursor = start + 1;
        else if (cursorRef === "tf") tfCursor = start + 1;
        else choiceCursor = start + 1;
        return fallback;
      };

      const template = wantsFib
        ? pickUnique(fibTemplates, "fib")
        : wantsTf
        ? pickUnique(tfTemplates, "tf")
        : choiceTemplates.length > 0
        ? pickUnique(choiceTemplates, "choice")
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

  const getTopicGrammarRules = (topicRaw: string): string => {
    const t = (topicRaw || "").trim();
    if (!t) {
      return `No specific grammar topic was entered — test genuine comprehension of what happens and is said in the video (actions, characters, objects, dialogue, cause/effect, and vocabulary in context). Keep grammar natural and level-appropriate.`;
    }
    const lower = t.toLowerCase();
    const specificRules: string[] = [];
    if (/\bmust\b|\bmustn'?t\b/i.test(lower)) {
      specificRules.push(
        `- "must" = strong rule/necessity; "mustn't" = prohibition/not allowed. Always followed by bare infinitive (NEVER "must to", NEVER "musts", NEVER "don't must").`
      );
    }
    if (/\bshould\b|\bshouldn'?t\b/i.test(lower)) {
      specificRules.push(
        `- "should" = good advice; "shouldn't" = bad idea. Always followed by bare infinitive (NEVER "should to").`
      );
    }
    if (/\bpresent\s*perf/i.test(lower) || /\bpast\s*participle\b/i.test(lower)) {
      specificRules.push(
        `- Present Perfect MUST use "have / has + past participle (V3)" (or "haven't / hasn't + V3"). Verify subject-verb agreement ("he/she/Mr. Bean has", "they/we have") and exact irregular V3 forms (e.g. gone, seen, taken, written, broken, forgotten). Do NOT turn Present Perfect questions into Past Simple ("did + V1" or "yesterday").`
      );
    }
    if (/\bpast\s*simple\b|\bsimple\s*past\b/i.test(lower)) {
      specificRules.push(
        `- Past Simple MUST test V2 affirmative ("went", "took", "parked") or "did / didn't + base verb (V1)" or "was / were". Do NOT mix with "have/has + V3".`
      );
    }
    if (/\bcontinuous\b|\bprogressive\b/i.test(lower)) {
      const tense = lower.includes("past") ? "was / were" : "am / is / are";
      specificRules.push(
        `- Continuous tense MUST test "${tense} + verb-ing" for ongoing actions visible in the scene. Check exact "-ing" spelling (e.g. running, sitting, taking, writing).`
      );
    }
    if (/\bpassive\b/i.test(lower)) {
      specificRules.push(
        `- Passive Voice MUST use "be (am/is/are/was/were/been) + past participle (V3)" where the grammatical subject receives the action (e.g., "The ticket was taken...", "His car is parked..."). Never generate active-voice answers marked correct for Passive Voice.`
      );
    }
    if (/\bconditional\b|\bif\s+clause/i.test(lower)) {
      specificRules.push(
        `- Conditionals MUST preserve exact clause matching: Zero (If + Present, Present), First (If + Present, will/won't + V1), Second (If + Past Simple/were, would/wouldn't + V1), Third (If + had + V3, would have + V3). Never put "will" or "would" inside the "if" clause.`
      );
    }
    if (/\bcomparative\b|\bsuperlative\b/i.test(lower)) {
      specificRules.push(
        `- Comparatives use "-er / more + adj + than"; Superlatives use "the + -est / most + adj". Never double-mark ("more taller", "most fastest").`
      );
    }
    if (/\bpreposition\b/i.test(lower)) {
      specificRules.push(
        `- Prepositions MUST test the exact spatial/time preposition shown in the scene ("in", "on", "at", "under", "next to", "between", "into", "through") with only ONE clearly right preposition.`
      );
    }
    if (/\barticle\b|\b(a\s*,\s*an|a\s*\/\s*an|no\s+article)\b/i.test(lower)) {
      specificRules.push(
        `- Articles ("a / an / the / no article"): Test ALL four cases clearly across different scenes: (1) "a" before consonant sounds (including "a uniform", "a university"), (2) "an" before vowel sounds (including silent-h "an hour", "an honest..."), (3) "the" for specific/second-mention nouns or unique things ("the sun", "the door"), and (4) "no article" before general plural nouns, uncountable nouns ("water", "music"), meals ("breakfast"), sports ("tennis"), and languages ("English"). Use "no article" as the clean option text when zero article is correct.`
      );
    }
    if (/\brelative\b/i.test(lower)) {
      specificRules.push(
        `- Relative Clauses MUST test "who", "which", "that", "where", "whose" with unambiguous antecedents.`
      );
    }
    return [
      `TARGET GRAMMAR / TOPIC: "${t}". Every single question MUST directly practice "${t}" while staying grounded in the actual video.`,
      ...specificRules,
    ].join("\n");
  };

  // Fast Video Metadata Preview Endpoint (title, real duration, transcript status)
  app.post("/api/scan-video-info", async (req, res) => {
    try {
      const { videoUrl } = req.body || {};
      const scanned = await scanYouTubeVideoDeepContext(
        typeof videoUrl === "string" ? videoUrl : "",
        { skipFrames: true }
      );
      res.json({
        videoId: scanned.videoId,
        title: scanned.title,
        author: scanned.author,
        durationSec: scanned.durationSec,
        hasTranscript: Boolean(scanned.transcript),
        chaptersCount: scanned.chapters.length,
        keywords: scanned.keywords,
      });
    } catch {
      res.json({ videoId: "", title: "", durationSec: 0, hasTranscript: false });
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
      clientFrames,
    } = req.body || {};

    const cleanTopic = typeof topic === "string" ? topic.trim() : "";
    const cleanLevel = typeof level === "string" && level.trim() ? level.trim() : "Movers";
    const requestedTypes: string[] =
      Array.isArray(types) && types.length > 0
        ? types
        : ["Fill in the Blanks", "Multiple Choice", "Grammar Choice"];

    const targetCount = Math.max(1, Math.min(100, Number(count) || 5));

    const scanned = await scanYouTubeVideoDeepContext(
      typeof videoUrl === "string" ? videoUrl : ""
    );

    const resolvedVideoTitle =
      scanned.title ||
      (typeof videoTitle === "string" && videoTitle.trim() && !/^https?:\/\//i.test(videoTitle.trim())
        ? videoTitle.trim()
        : "") ||
      "";
    const resolvedAuthor = scanned.author || "";
    const resolvedDuration = Math.max(
      10,
      Number(scanned.durationSec) || Number(videoDuration) || 240
    );

    const normalizeAscendingTimestamps = (rawQuestions: any[]) => {
      const minAllowedSec = Math.min(4, Math.max(2, Math.floor(resolvedDuration * 0.04)));
      const maxAllowedSec = Math.max(minAllowedSec + 4, resolvedDuration - 2);
      let prevTrigger = 0;
      return [...rawQuestions]
        .slice(0, targetCount)
        .sort((a: any, b: any) => (Number(a.timeTrigger) || 0) - (Number(b.timeTrigger) || 0))
        .map((item: any, idx: number, arr: any[]) => {
          const rawTrig = Number(item.timeTrigger) || 0;
          const spreadTrig = Math.max(
            minAllowedSec,
            Math.round(((idx + 1) / (arr.length + 1)) * maxAllowedSec)
          );
          let trig = rawTrig >= minAllowedSec && rawTrig <= maxAllowedSec ? rawTrig : spreadTrig;
          if (trig <= prevTrigger) {
            const stepRoom = Math.max(
              1,
              Math.floor((maxAllowedSec - prevTrigger) / Math.max(1, arr.length - idx))
            );
            trig = Math.min(maxAllowedSec, prevTrigger + Math.min(3, stepRoom));
          }
          prevTrigger = trig;
          return {
            ...item,
            id: idx + 1,
            timeTrigger: trig,
          };
        });
    };

    const generateBuiltInVideoQuestions = () =>
      normalizeAscendingTimestamps(
        buildFallbackVideoQuizQuestions(
          cleanTopic,
          cleanLevel,
          requestedTypes,
          targetCount,
          resolvedVideoTitle,
          resolvedDuration,
          scanned.description,
          scanned.chapters,
          scanned.transcript,
          scanned.keywords
        )
      );

    if (!hasValidGeminiKey()) {
      return res.json({
        questions: generateBuiltInVideoQuestions(),
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
        hasTranscript: Boolean(scanned.transcript),
        usedStoryboard: false,
        usedVisualFramesCount: 0,
        usedBuiltInGenerator: true,
      });
    }

    // Collect timestamped visual frames from uploaded/direct video OR YouTube storyboard sheets
    const parsedClientFrames: Array<{
      sec: number | null;
      mimeType: string;
      data: string;
    }> = [];
    if (Array.isArray(clientFrames)) {
      clientFrames.slice(0, 18).forEach((rawFrame: any) => {
        const rawUrl =
          typeof rawFrame === "string"
            ? rawFrame
            : typeof rawFrame?.dataUrl === "string"
            ? rawFrame.dataUrl
            : "";
        if (!rawUrl) return;
        const m = rawUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
        if (m?.[1] && m?.[2] && m[2].length < 750000) {
          const secVal =
            typeof rawFrame?.sec === "number" && Number.isFinite(rawFrame.sec)
              ? Math.max(0, Math.round(rawFrame.sec))
              : null;
          parsedClientFrames.push({
            sec: secVal,
            mimeType: m[1],
            data: m[2],
          });
        }
      });
    }

    const labeledVisualParts: any[] = [];
    if (scanned.storyboardSheets.length > 0) {
      scanned.storyboardSheets.forEach((sheet, idx) => {
        labeledVisualParts.push(
          {
            text: `[YouTube Storyboard Grid #${idx + 1} covering ${formatTimestampTag(
              sheet.startSec
            )} (${sheet.startSec}s) to ${formatTimestampTag(sheet.endSec)} (${sheet.endSec}s) — ${
              sheet.cols
            } columns x ${sheet.rows} rows, read left-to-right then top-to-bottom, ~${
              sheet.intervalSec
            }s per frame]:`,
          },
          {
            inlineData: { mimeType: sheet.mimeType, data: sheet.data },
          }
        );
      });
    } else if (parsedClientFrames.length > 0) {
      parsedClientFrames.forEach((cf, idx) => {
        const timeText =
          cf.sec !== null
            ? `${formatTimestampTag(cf.sec)} (${cf.sec}s)`
            : `sample ${idx + 1} of ${parsedClientFrames.length}`;
        labeledVisualParts.push(
          {
            text: `[Observed Video Frame #${idx + 1} at ${timeText} of total duration ${formatTimestampTag(
              resolvedDuration
            )} (${resolvedDuration}s)]:`,
          },
          {
            inlineData: { mimeType: cf.mimeType, data: cf.data },
          }
        );
      });
    } else if (scanned.frameParts.length > 0) {
      scanned.frameParts.forEach((fp, idx) => {
        labeledVisualParts.push(
          { text: `[YouTube Preview Frame #${idx + 1}]:` },
          fp
        );
      });
    }

    const hasVisualOrTranscriptEvidence =
      labeledVisualParts.length > 0 ||
      Boolean(scanned.transcript) ||
      Boolean(scanned.description) ||
      scanned.chapters.length > 0;

    if (!hasVisualOrTranscriptEvidence && !resolvedVideoTitle) {
      return res.status(400).json({
        error:
          "Could not extract scenes, frames, or captions from this video source. Please upload a browser-playable video (MP4/WebM) or paste a valid YouTube link.",
      });
    }

    const sanitizeGeminiBatch = (rawArray: any[], stepSec: number) => {
      return rawArray
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

          let assignedType = requestedTypes.includes(String(q?.type || ""))
            ? String(q.type)
            : requestedTypes[idx % requestedTypes.length];

          const rawOpts = Array.isArray(q?.options) ? q.options : [];
          const seenOptTexts = new Set<string>();
          let hasCorrect = false;
          const mappedOpts = rawOpts
            .slice(0, 4)
            .map((o: any, oIdx: number) => {
              const optText =
                typeof o === "string" ? o.trim() : String(o?.text || "").trim();
              if (!optText || /^Option [A-D1-4]$/i.test(optText)) return null;
              const dedupKey = optText.toLowerCase();
              if (seenOptTexts.has(dedupKey)) return null;
              seenOptTexts.add(dedupKey);
              const isRight =
                typeof o === "object" && o !== null
                  ? Boolean(o.isCorrect)
                  : typeof q.correctOptionIndex === "number"
                  ? q.correctOptionIndex === oIdx
                  : typeof q.answerIndex === "number"
                  ? q.answerIndex === oIdx
                  : false;
              if (isRight && !hasCorrect) {
                hasCorrect = true;
                return { text: optText, isCorrect: true };
              }
              return { text: optText, isCorrect: false };
            })
            .filter(Boolean) as { text: string; isCorrect: boolean }[];

          let explicitAnswer = String(
            q?.answer ||
              mappedOpts.find((o) => o.isCorrect)?.text ||
              mappedOpts[0]?.text ||
              ""
          ).trim();

          // Normalize True or False cleanly
          if (assignedType === "True or False") {
            const isTrueRight =
              /^true$/i.test(explicitAnswer) ||
              Boolean(
                mappedOpts.find((o) => /^true$/i.test(o.text) && o.isCorrect)
              );
            const tfAns = isTrueRight ? "True" : "False";
            return {
              id: idx + 1,
              timeTrigger: Math.max(4, Number(q?.timeTrigger) || (idx + 1) * stepSec),
              sceneContext: String(q?.sceneContext || "").trim(),
              type: "True or False",
              xp: 100,
              question: qText,
              answer: tfAns,
              options: [
                { text: "True", isCorrect: isTrueRight },
                { text: "False", isCorrect: !isTrueRight },
              ],
              explanation: String(
                q?.explanation || `This statement is ${tfAns}.`
              ),
            };
          }

          if (assignedType === "Fill in the Blanks") {
            if (!explicitAnswer) return null;
            const blankMatches = qText.match(/_{2,}/g) || [];
            if (blankMatches.length === 0) {
              const escapedAns = explicitAnswer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const ansRe = new RegExp(`\\b${escapedAns}\\b`, "i");
              if (ansRe.test(qText)) {
                qText = qText.replace(ansRe, "____");
              } else {
                assignedType = requestedTypes.includes("Grammar Choice")
                  ? "Grammar Choice"
                  : requestedTypes.includes("Multiple Choice")
                  ? "Multiple Choice"
                  : "Fill in the Blanks";
                if (assignedType === "Fill in the Blanks") {
                  qText = `${qText.replace(/[.?!]+$/, "")} ____.`;
                }
              }
            } else if (blankMatches.length > 1) {
              let firstKept = false;
              qText = qText
                .replace(/_{2,}/g, () => {
                  if (!firstKept) {
                    firstKept = true;
                    return "____";
                  }
                  return explicitAnswer;
                })
                .replace(/\s+/g, " ")
                .trim();
            } else {
              qText = qText.replace(/_{2,}/g, "____");
            }

            if (assignedType === "Fill in the Blanks") {
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
                timeTrigger: Math.max(4, Number(q?.timeTrigger) || (idx + 1) * stepSec),
                sceneContext: String(q?.sceneContext || "").trim(),
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
          }

          if (mappedOpts.length < 2) return null;
          if (!hasCorrect) {
            const matchedOpt = mappedOpts.find(
              (o) => o.text.toLowerCase() === explicitAnswer.toLowerCase()
            );
            if (matchedOpt) matchedOpt.isCorrect = true;
            else mappedOpts[0].isCorrect = true;
          }
          const finalCorrectText =
            mappedOpts.find((o) => o.isCorrect)?.text || explicitAnswer;

          return {
            id: idx + 1,
            timeTrigger: Math.max(4, Number(q?.timeTrigger) || (idx + 1) * stepSec),
            sceneContext: String(q?.sceneContext || "").trim(),
            type: assignedType,
            xp: 100,
            question: qText,
            answer: finalCorrectText,
            options: mappedOpts,
            explanation: String(q?.explanation || `Correct answer: "${finalCorrectText}".`),
          };
        })
        .filter(Boolean) as any[];
    };

    try {
      const durationSec = resolvedDuration;
      const stepSec = Math.max(3, Math.floor((durationSec * 0.88) / (targetCount + 1)));
      const topicRules = getTopicGrammarRules(cleanTopic);

      const videoEvidenceBlock = [
        `Video Title: "${resolvedVideoTitle || "Uploaded Video"}"${resolvedAuthor ? ` (Channel: ${resolvedAuthor})` : ""}`,
        `Video Duration: ${durationSec} seconds (${formatTimestampTag(durationSec)})`,
        scanned.keywords.length > 0 ? `Video Tags/Keywords: ${scanned.keywords.join(", ")}` : "",
        scanned.chapters.length > 0
          ? `Chapters/Scenes:\n${scanned.chapters.map((c) => `- [${formatTimestampTag(c.sec)} / ${c.sec}s] ${c.title}`).join("\n")}`
          : "",
        scanned.description
          ? `Video Description:\n${scanned.description.slice(0, 1500)}`
          : "",
        scanned.transcript
          ? `Timestamped Video Transcript / Spoken Dialogue (MATCH REAL EVENTS & EXACT TIMESTAMPS):\n${scanned.transcript}`
          : "No spoken captions track was found; rely directly on the attached timestamped video frames / storyboard grids above, plus title/description.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const buildPrompt = (
        neededCount: number,
        existingQs: any[] = [],
        timeWindow?: { minSec: number; maxSec: number; label: string }
      ) => {
        const winMin = timeWindow?.minSec ?? Math.min(4, Math.max(2, Math.floor(durationSec * 0.04)));
        const winMax = timeWindow?.maxSec ?? Math.max(winMin + 6, Math.floor(durationSec * 0.94));
        const avoidBlock =
          existingQs.length > 0
            ? `\nAlready generated questions (DO NOT repeat these moments, verbs, nouns, or sentence structures):\n${existingQs
                .map((eq, i) => `${i + 1}. [@${eq.timeTrigger}s] ${eq.question}`)
                .join("\n")}\n`
            : "";

        return `You are an expert Cambridge ESL curriculum designer & visual video analyst. Inspect EVERY attached video frame / storyboard image carefully before writing a single word.

${topicRules}

English Level: Cambridge ${cleanLevel} (Starters = Pre-A1, Movers = A1, Flyers = A2, KET = A2 Key, B1 = Preliminary, B2 = First)
Allowed Question Types: ${requestedTypes.join(", ")}
Number of Questions Required: EXACTLY ${neededCount}
${timeWindow ? `Focus Timeline Window: ${timeWindow.label} (${winMin}s to ${winMax}s)` : ""}

=== REAL VIDEO EVIDENCE ===
${videoEvidenceBlock}
=== END VIDEO EVIDENCE ===
${avoidBlock}
STRICT VISUAL GROUNDING, PRONOUN & GRAMMAR RULES:
1. STRICT VISUAL & TRANSCRIPT MATCHING (ZERO HALLUCINATION): Every question MUST directly match what is ACTUALLY visible in the attached timestamped video frames/storyboard or spoken in the transcript at that exact "timeTrigger". NEVER invent objects, clothing, pets, rooms, or actions (e.g., do not make up bags, pianos, umbrellas, or trains unless you actually see or hear them in this video!).
2. INSPECT CHARACTER GENDER & PRONOUNS ACCURATELY: Look closely at who is on screen in the frame(s) near each "timeTrigger". Match the pronoun to the real person/character you see:
   - Boy / man -> "He", "his", "him"
   - Girl / woman -> "She", "her"
   - Multiple people -> "They", "their", "them"
   - Animal / object -> "It", "its"
   NEVER guess the opposite gender or randomly alternate "He" and "She" for the same character!
   NEVER use vague placeholders like "the main character", "someone", "something", or "a funny object".
3. SET "sceneContext" FIRST: Start with the timestamp and concrete visible/spoken evidence, e.g. "[0:18] Boy in yellow shirt walks beside green plant and steps". Then write a question that matches that exact scene!
4. ZERO REPETITIVE OR VAGUE QUESTIONS: Spread questions across the whole timeline (${winMin}s to ${winMax}s) so each question observes a distinct moment, action, or visible object.
5. GRAMMAR & TOPIC PRECISION: Every question MUST accurately test ${cleanTopic ? `"${cleanTopic}"` : "video comprehension & level-appropriate English grammar"} using natural, idiomatic English for Cambridge ${cleanLevel}.
6. UNAMBIGUOUS SINGLE ANSWER: Exactly ONE option may be marked "isCorrect": true (matching "answer"). The 3 distractors MUST be clearly wrong in that sentence.
7. CLEAN QUESTION FORMATS (cycle evenly across ${requestedTypes.join(", ")}):
   - "Fill in the Blanks": Write a natural complete sentence with EXACTLY ONE blank "____" (never two blanks!), plus a brief cue in parentheses when helpful (e.g. "He walks past ____ (a / an) green plant."), with "answer", "acceptedAnswers", and 4 "options".
   - "Multiple Choice" / "Grammar Choice": Provide 4 clear options with exactly 1 "isCorrect": true. Keep stems concise (1 sentence, 6–16 words), NO meta-instructions like "Choose the correct...".
   - "True or False": Write a clear true/false statement about what visibly happens in the video at that timestamp, with EXACTLY 2 options: "True" and "False".
   - "Vocabulary Meaning": Pick a real visible object/action/word from the video at that timestamp and ask for its simple ${cleanLevel}-level meaning with 4 options.
8. TIMESTAMPS: Assign strictly ascending "timeTrigger" integer seconds between ${winMin} and ${winMax} aligned directly with the observed frame/storyboard/transcript timestamps.`;
      };

      const ai = getAiClient();
      const responseSchemaConfig = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timeTrigger: { type: Type.INTEGER },
            sceneContext: { type: Type.STRING },
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
          required: ["timeTrigger", "sceneContext", "type", "question", "answer", "options", "explanation"],
        },
      };

      const isNearDuplicateQuestion = (candQ: string, existingList: any[]): boolean => {
        const normalizeWords = (s: string) =>
          s
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2);
        const candWords = normalizeWords(candQ);
        if (candWords.length === 0) return false;
        const candSet = new Set(candWords);
        return existingList.some((ex) => {
          const exWords = normalizeWords(String(ex?.question || ""));
          if (exWords.length === 0) return false;
          const overlap = exWords.filter((w) => candSet.has(w)).length;
          return overlap / Math.max(candSet.size, exWords.length) >= 0.78;
        });
      };

      const parseGeminiJson = (rawText: string) => {
        const cleaned = rawText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        return JSON.parse(cleaned || "[]");
      };

      const extractCleanGeminiError = (err: any): { status: number; message: string } => {
        const rawMsg = String(err?.message || err || "");
        let parsedCode = Number(err?.status || err?.code || 0);
        let innerStatus = "";
        let innerMessage = rawMsg;

        const jsonStart = rawMsg.indexOf("{");
        if (jsonStart >= 0) {
          try {
            const parsed = JSON.parse(rawMsg.slice(jsonStart));
            const eObj = parsed?.error || parsed;
            if (typeof eObj?.code === "number") parsedCode = eObj.code;
            if (typeof eObj?.status === "string") innerStatus = eObj.status;
            if (typeof eObj?.message === "string" && eObj.message.trim()) {
              innerMessage = eObj.message.trim();
            }
          } catch {}
        }

        const safeStatus = parsedCode >= 400 && parsedCode < 600 ? parsedCode : 500;
        if (
          safeStatus === 402 ||
          /prepayment credits|billing#prepay/i.test(innerMessage)
        ) {
          return {
            status: 402,
            message:
              "Gemini API prepayment credits are depleted on this project. Top up billing at ai.studio/projects or select an active GEMINI_API_KEY in Settings > Secrets.",
          };
        }
        if (safeStatus === 401 || safeStatus === 403 || innerStatus === "PERMISSION_DENIED") {
          return {
            status: safeStatus === 401 ? 401 : 403,
            message:
              "Gemini API authentication failed. Please check or select a valid GEMINI_API_KEY in Settings > Secrets.",
          };
        }
        if (safeStatus === 429 || innerStatus === "RESOURCE_EXHAUSTED") {
          return {
            status: 429,
            message:
              "Gemini API quota limit reached. Please wait a moment and try again, or switch to another GEMINI_API_KEY in Settings > Secrets.",
          };
        }
        return {
          status: safeStatus,
          message:
            innerMessage ||
            "Failed to analyze the video and generate scene-matched questions.",
        };
      };

      const callGeminiBatch = async (
        needed: number,
        existing: any[] = [],
        timeWindow?: { minSec: number; maxSec: number; label: string }
      ) => {
        const promptPart = { text: buildPrompt(needed, existing, timeWindow) };
        const primaryParts: any[] = [...labeledVisualParts, promptPart];

        const runModel = async (
          modelName: string,
          parts: any[],
          useHighThinking: boolean
        ) => {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: parts,
            config: {
              ...(useHighThinking
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
                : {}),
              responseMimeType: "application/json",
              responseSchema: responseSchemaConfig,
            },
          });
          const parsed = parseGeminiJson(response.text || "[]");
          const rawArr = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.questions)
            ? parsed.questions
            : [];
          return sanitizeGeminiBatch(rawArr, stepSec);
        };

        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // Try free-tier lightweight model first
            return await runModel("gemini-3.1-flash-lite", primaryParts, false);
          } catch (err: any) {
            lastErr = err;
            const info = extractCleanGeminiError(err);
            if (info.status === 402 || info.status === 401 || info.status === 403) {
              // Project prepayment credits or auth unavailable — fall back immediately to built-in video generator
              break;
            }
            try {
              return await runModel("gemini-4-hydrogen", primaryParts, false);
            } catch (hydErr: any) {
              lastErr = hydErr;
              const hydInfo = extractCleanGeminiError(hydErr);
              if (attempt === 0 && hydInfo.status >= 500) {
                await new Promise((r) => setTimeout(r, 800));
                continue;
              }
              break;
            }
          }
        }
        throw lastErr;
      };

      let sanitized: any[] = [];
      const minT = Math.min(4, Math.max(2, Math.floor(durationSec * 0.04)));
      const maxT = Math.max(minT + 6, Math.floor(durationSec * 0.94));

      if (targetCount > 20) {
        const firstHalfTarget = Math.ceil(targetCount / 2);
        const midT = Math.max(minT + 5, Math.floor((minT + maxT) / 2));
        const batch1 = await callGeminiBatch(firstHalfTarget, [], {
          minSec: minT,
          maxSec: midT,
          label: "First Half of Video",
        });
        batch1.forEach((item) => {
          if (!isNearDuplicateQuestion(item.question, sanitized)) {
            sanitized.push(item);
          }
        });

        const secondHalfTarget = Math.max(1, targetCount - sanitized.length);
        const batch2 = await callGeminiBatch(secondHalfTarget, sanitized, {
          minSec: Math.min(maxT - 4, midT + 1),
          maxSec: maxT,
          label: "Second Half of Video",
        });
        batch2.forEach((item) => {
          if (sanitized.length < targetCount && !isNearDuplicateQuestion(item.question, sanitized)) {
            sanitized.push(item);
          }
        });
      } else {
        const batch1 = await callGeminiBatch(targetCount);
        batch1.forEach((item) => {
          if (!isNearDuplicateQuestion(item.question, sanitized)) {
            sanitized.push(item);
          }
        });
      }

      // Top up any shortfall with another Gemini pass, then built-in video generator if still short
      if (sanitized.length > 0 && sanitized.length < targetCount) {
        try {
          const remainingNeeded = Math.min(20, targetCount - sanitized.length);
          const extra = await callGeminiBatch(remainingNeeded, sanitized);
          extra.forEach((item) => {
            if (sanitized.length < targetCount && !isNearDuplicateQuestion(item.question, sanitized)) {
              sanitized.push(item);
            }
          });
        } catch {}
      }

      if (sanitized.length < targetCount) {
        const builtInList = generateBuiltInVideoQuestions();
        for (const bItem of builtInList) {
          if (sanitized.length >= targetCount) break;
          if (!isNearDuplicateQuestion(bItem.question, sanitized)) {
            sanitized.push(bItem);
          }
        }
      }

      const finalQuestions = normalizeAscendingTimestamps(
        sanitized.length > 0 ? sanitized : generateBuiltInVideoQuestions()
      );

      return res.json({
        questions: finalQuestions,
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
        hasTranscript: Boolean(scanned.transcript),
        usedStoryboard: scanned.storyboardSheets.length > 0,
        usedVisualFramesCount:
          scanned.storyboardSheets.length > 0
            ? scanned.storyboardSheets.length
            : parsedClientFrames.length || scanned.frameParts.length,
      });
    } catch (err: any) {
      console.warn(
        "Gemini API unavailable for Video Quiz (falling back to built-in video generator):",
        err?.message || err
      );
      const builtInQuestions = generateBuiltInVideoQuestions();
      return res.json({
        questions: builtInQuestions,
        videoTitle: resolvedVideoTitle,
        videoDuration: resolvedDuration,
        hasTranscript: Boolean(scanned.transcript),
        usedStoryboard: scanned.storyboardSheets.length > 0,
        usedVisualFramesCount:
          scanned.storyboardSheets.length > 0
            ? scanned.storyboardSheets.length
            : parsedClientFrames.length || scanned.frameParts.length,
        usedBuiltInGenerator: true,
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

  const ROOM_ACTIVE_TTL_MS = 30 * 60 * 1000;

  function normalizeRoomCodeParam(rawCode: string) {
    return String(rawCode || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .slice(0, 6);
  }

  function isPaintballRoomActive(entry: { room: Record<string, any> } | undefined): boolean {
    if (!entry || !entry.room) return false;
    if (entry.room.isUninitialized || entry.room.hostClosed) return false;
    const lastHeartbeat = Number(entry.room.hostHeartbeatAt || entry.room.updatedAt || 0);
    if (!lastHeartbeat || Date.now() - lastHeartbeat > ROOM_ACTIVE_TTL_MS) return false;
    return true;
  }

  function getExistingPaintballRoom(rawCode: string) {
    const cleanCode = normalizeRoomCodeParam(rawCode);
    if (!cleanCode) return null;
    const entry = paintballRoomsMemory.get(cleanCode);
    if (!isPaintballRoomActive(entry)) return null;
    return entry!;
  }

  function getOrCreatePaintballRoom(rawCode: string) {
    const cleanCode = normalizeRoomCodeParam(rawCode);
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
          hostClosed: false,
          hostHeartbeatAt: 0,
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

  // GET /api/paintball/room/:code -> Fetch room configuration, all joined players & combat ring buffer (only if actively hosted!)
  app.get("/api/paintball/room/:code", (req, res) => {
    const cleanCode = normalizeRoomCodeParam(req.params.code);
    if (!cleanCode) return res.status(400).json({ error: "Invalid room code", exists: false });
    const entry = getExistingPaintballRoom(cleanCode);
    if (!entry) {
      return res.json({
        exists: false,
        serverNow: Date.now(),
        room: { roomCode: cleanCode, isUninitialized: true, hostClosed: false },
        players: [],
        events: []
      });
    }
    res.json({ exists: true, ...serializePaintballRoom(entry) });
  });

  // POST /api/paintball/room/:code/room -> Host updates room settings, status, timer, or bulk player spawn positions
  app.post("/api/paintball/room/:code/room", (req, res) => {
    const entry = getOrCreatePaintballRoom(req.params.code);
    if (!entry) return res.status(400).json({ error: "Invalid room code" });

    const now = Date.now();
    const { room: roomPatch, players: playersPatch, combatEvents, events } = req.body || {};
    if (roomPatch && typeof roomPatch === "object") {
      if (roomPatch.hostClosed === true) {
        entry.room = {
          ...entry.room,
          ...roomPatch,
          roomCode: entry.room.roomCode,
          isUninitialized: true,
          hostClosed: true,
          updatedAt: now
        };
        return res.json({ exists: false, ...serializePaintballRoom(entry) });
      }

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
        hostClosed: false,
        hostHeartbeatAt: now,
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

    res.json({ exists: isPaintballRoomActive(entry), ...serializePaintballRoom(entry) });
  });

  // POST /api/paintball/room/:code/player -> Student joins/heartbeats state OR Host updates/moves/kicks a player
  app.post("/api/paintball/room/:code/player", (req, res) => {
    const cleanCode = normalizeRoomCodeParam(req.params.code);
    if (!cleanCode) return res.status(400).json({ error: "Invalid room code" });

    const body = req.body || {};
    const isHostAction = Boolean(body.isHostAction);
    const verifiedFirestoreHost = Boolean(body.verifiedFirestoreHost && body.roomState);

    let entry = getExistingPaintballRoom(cleanCode);
    if (!entry && (isHostAction || verifiedFirestoreHost)) {
      entry = getOrCreatePaintballRoom(cleanCode);
    }
    if (!entry) {
      return res.status(404).json({
        error: "Room not found or host is not active",
        roomNotFound: true
      });
    }

    const playerData = body.player || body;
    const playerId = String(playerData.id || "").trim();
    if (!playerId) {
      return res.status(400).json({ error: "Player id is required" });
    }

    const now = Date.now();
    const existing = entry.players.get(playerId) || {};

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
    const entry = getExistingPaintballRoom(req.params.code);
    if (!entry) return res.json({ ok: true });
    const playerId = String(req.params.playerId || "").trim();
    if (playerId) {
      entry.players.delete(playerId);
    }
    res.json({ ok: true });
  });

  // Tic-Tac-Toe hosted room validation registry (authoritative check alongside Firestore `ttt_rooms`)
  const tttRoomsMemory = new Map<
    string,
    { roomCode: string; status: string; closed: boolean; updatedAt: number }
  >();

  app.get("/api/tictactoe/room/:code", (req, res) => {
    const cleanCode = normalizeRoomCodeParam(req.params.code);
    if (!cleanCode) return res.status(400).json({ exists: false, error: "Invalid room code" });
    const entry = tttRoomsMemory.get(cleanCode);
    const isFresh =
      entry &&
      !entry.closed &&
      entry.status &&
      entry.status !== "SETUP" &&
      Date.now() - entry.updatedAt < ROOM_ACTIVE_TTL_MS;
    if (!isFresh) {
      return res.json({ exists: false, roomCode: cleanCode });
    }
    return res.json({ exists: true, roomCode: entry.roomCode, status: entry.status });
  });

  app.post("/api/tictactoe/room/:code", (req, res) => {
    const cleanCode = normalizeRoomCodeParam(req.params.code);
    if (!cleanCode) return res.status(400).json({ error: "Invalid room code" });
    const { status, closed } = req.body || {};
    if (closed) {
      tttRoomsMemory.delete(cleanCode);
      return res.json({ exists: false, roomCode: cleanCode });
    }
    const nextStatus = String(status || "LOBBY");
    tttRoomsMemory.set(cleanCode, {
      roomCode: cleanCode,
      status: nextStatus,
      closed: nextStatus === "SETUP",
      updatedAt: Date.now(),
    });
    return res.json({ exists: nextStatus !== "SETUP", roomCode: cleanCode, status: nextStatus });
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
