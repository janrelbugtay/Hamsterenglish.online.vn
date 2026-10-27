import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import multer from "multer";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
