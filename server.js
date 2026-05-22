require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

const API_KEY = process.env.GROQ_API_KEY;
console.log('GROQ_API_KEY loaded:', API_KEY ? 'YES' : 'NO — set it in Railway Variables');

const FALLBACK_TRAITS = [
  {"trait":"Chaos Cortex","emoji":"🌀","color":"#FF6B6B","description":"Thrives in disorder like it pays rent"},
  {"trait":"Midnight Hunger Protocol","emoji":"🍕","color":"#00FFD1","description":"Snacks at 2am without guilt or regret"},
  {"trait":"Selective Empathy Engine","emoji":"🧠","color":"#9B5DE5","description":"Feels deeply for dogs, less so for people"},
  {"trait":"Caffeine Dependency Matrix","emoji":"☕","color":"#FFD93D","description":"Cannot function before the sacred morning ritual"},
  {"trait":"Irrational Fear Processor","emoji":"😱","color":"#FF6B9D","description":"Scared of things that definitely cannot hurt you"},
  {"trait":"Social Battery Depleter","emoji":"🔋","color":"#4ECDC4","description":"Recharges alone and calls it self-care"},
  {"trait":"Overthinking Overdrive","emoji":"💭","color":"#45B7D1","description":"Replays every conversation from five years ago"},
  {"trait":"Chaotic Neutral Navigator","emoji":"🎲","color":"#F7DC6F","description":"Makes decisions via vibes and gut feelings only"},
];

const buildPrompt = (answers) => `You are a savage but loving personality analysis AI.

Given these 5 answers about a person:
- Comfort food when life falls apart: ${answers.food}
- Most embarrassing irrational fear: ${answers.fear}
- How they take their coffee: ${answers.coffee}
- Word their friends really use to describe them: ${answers.word}
- Most unhinged recurring habit: ${answers.chaos}

You must respond with ONLY a valid JSON array, no markdown, no explanation, no code blocks. Just the raw JSON array starting with [ and ending with ]. Example format:
[{"trait":"Name","emoji":"🔥","color":"#FF6B6B","description":"Short funny line"}]
Return exactly 8 traits.

Rules:
- trait: creative science-sounding name (e.g. "Chaos Cortex", "Midnight Hunger Protocol", "Selective Empathy Engine")
- emoji: one unique emoji per trait
- color: vivid neon hex, all 8 must be different, use exactly these: #FF6B6B #00FFD1 #9B5DE5 #FFD93D #FF6B9D #4ECDC4 #45B7D1 #F7DC6F
- description: 8-12 words, brutally honest and funny, do NOT use double quotes inside the description`;

app.post('/api/generate', async (req, res) => {
  const { answers } = req.body;

  const required = ['food', 'fear', 'coffee', 'word', 'chaos'];
  if (!answers || required.some((k) => !answers[k] || !answers[k].trim())) {
    return res.status(400).json({ error: 'All 5 answers are required.' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in .env' });
  }

  try {
    const groq = new Groq({ apiKey: API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildPrompt(answers) }],
      max_tokens: 1024,
    });

    let text = completion.choices[0].message.content.trim();

    // Strip markdown code blocks if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

    let traits;
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array found in response');
      traits = JSON.parse(match[0]).slice(0, 8);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw response:', text);
      console.error('Parse error:', parseErr.message);
      traits = FALLBACK_TRAITS;
    }

    return res.json({ traits });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
