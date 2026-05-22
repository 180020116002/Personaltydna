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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let answers;
  try {
    ({ answers } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const required = ['food', 'fear', 'coffee', 'word', 'chaos'];
  if (!answers || required.some((k) => !answers[k] || !answers[k].trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All 5 answers are required.' }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GROQ_API_KEY not configured.' }) };
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(answers) }],
        max_tokens: 1024,
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) throw new Error(data.error?.message || 'Groq API error');

    let text = data.choices[0].message.content.trim();
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

    let traits;
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array found');
      traits = JSON.parse(match[0]).slice(0, 8);
    } catch {
      traits = FALLBACK_TRAITS;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traits }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
