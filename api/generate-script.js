export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Send a POST request.' });
  }

  try {
    const { category, topic, explicitLevel, hosts } = req.body;

    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing API Key. Add OPENAI_API_KEY to your Vercel Environment Variables.'
      });
    }

    // Determine content rating tone based on explicit dial
    let tonePrompt = "Clean, professional, G/PG-rated broadcast safe.";
    if (explicitLevel > 0 && explicitLevel <= 25) {
      tonePrompt = "Mild edge, realistic conversational tension with occasional gritty slang.";
    } else if (explicitLevel > 25 && explicitLevel <= 60) {
      tonePrompt = "Uncensored late-night cable banter, raw debate style, moderate swearing allowed.";
    } else if (explicitLevel > 60) {
      tonePrompt = "Raw outlaw style, unhinged banter, completely unrestricted vocabulary.";
    }

    const hostDescriptions = `
      - Host 1 (H1 - ${hosts?.host1?.name || 'Aria Vance'}): ${hosts?.host1?.role || 'Lead Anchor / Moderator'}
      - Host 2 (H2 - ${hosts?.host2?.name || 'Kai Sterling'}): ${hosts?.host2?.role || 'Analytical Co-Host'}
      - Host 3 (H3 - ${hosts?.host3?.name || 'Aiden Stone'}): ${hosts?.host3?.role || 'Energetic Field Specialist'}
      - Host 4 (H4 - ${hosts?.host4?.name || 'Fern Elise'}): ${hosts?.host4?.role || 'Contrarian / Wildcard'}
    `;

    const systemPrompt = `You are the Executive Showrunner and Lead Writer for MyAI Studio.
Write an engaging, fast-paced episodic script between 4 distinct podcast hosts.

Host Roles:
${hostDescriptions}

Episode Category: ${category || 'Podcast Debate'}
Topic / Plot Hook: "${topic || 'The Future of AI Voice Media'}"
Maturity & Language Parameter: ${tonePrompt}

Rules:
1. Return ONLY a valid JSON array of objects. Do not include markdown code fences, headers, or conversational text.
2. Each object in the array must strictly have:
   - "speaker": one of "host1", "host2", "host3", or "host4"
   - "text": the spoken dialogue string for that turn
3. Create 6 to 10 dialogue turns with natural back-and-forth banter, reactions, and pacing.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate the script for topic: "${topic}"` }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({ error: errData });
    }

    const data = await response.json();
    let rawContent = data.choices[0].message.content.trim();

    // Sanitize any accidental markdown formatting
    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const scriptArray = JSON.parse(rawContent);
    return res.status(200).json({ success: true, script: scriptArray });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to generate script', details: error.message });
  }
}
