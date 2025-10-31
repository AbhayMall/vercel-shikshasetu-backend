const axios = require('axios');
const { AiCourse } = require('../models/AiCourse');

function buildPrompt(topic, language) {
  return `You are an expert course creator. Create a complete, beginner-friendly course in ${language} for the topic: "${topic}".

You MUST respond with ONLY a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text before or after the JSON.

The JSON must match this exact schema:
{
  "title": "Course title as a string",
  "description": "Course description as a string",
  "modules": [
    {
      "title": "Module title",
      "lessons": [
        {
          "title": "Lesson title",
          "content": "Detailed lesson content"
        }
      ]
    }
  ],
  "quizzes": {
    "mcq": [
      {
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "Correct option",
        "explanation": "Why this is correct"
      }
    ],
    "true_false": [
      {
        "question": "Statement",
        "answer": true,
        "explanation": "Explanation"
      }
    ],
    "fill_in_the_blanks": [
      {
        "question": "Question with _____ blank",
        "answer": "correct answer"
      }
    ]
  }
}

Remember: Return ONLY the JSON object, nothing else.`;
}

async function callGemini(topic, language) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const prompt = buildPrompt(topic, language);
  const { data } = await axios.post(url, {
    model: 'mistralai/mistral-7b-instruct:free',
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  let text = data?.choices?.[0]?.message?.content || '';
  
  // Remove markdown code blocks if present
  text = text.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
  
  // Try to fix incomplete JSON by counting braces
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  
  if (openBraces > closeBraces) {
    // Add missing closing braces
    text += '\n}\n}'.repeat(openBraces - closeBraces);
  }
  
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON object from text
    const jsonMatch = text.match(/\{[\s\S]*\}/g);
    if (jsonMatch && jsonMatch.length > 0) {
      // Try the largest JSON object found
      const largestJson = jsonMatch.reduce((a, b) => a.length > b.length ? a : b);
      try {
        parsed = JSON.parse(largestJson);
      } catch (e2) {
        console.error('Model response (first 500 chars):', text.substring(0, 500));
        console.error('Parse error:', e2.message);
        throw new Error('Failed to parse model response as JSON');
      }
    } else {
      console.error('Model response (first 500 chars):', text.substring(0, 500));
      throw new Error('No JSON object found in model response');
    }
  }
  
  // Validate the parsed object has required fields
  if (!parsed.title || !parsed.modules || !parsed.quizzes) {
    throw new Error('Model response missing required fields');
  }
  
  return parsed;
}

async function generateAICourse(req, res) {
  try {
    const { topic, language } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const structured = await callGemini(topic, language || 'English');
    const doc = await AiCourse.create({
      student: req.user.id,
      topic,
      language: language || 'English',
      title: structured.title || topic,
      description: structured.description || '',
      content: structured,
    });
    return res.status(201).json({ course: sanitize(doc) });
  } catch (err) {
    console.error('AI generation failed:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to generate course' });
  }
}

function sanitize(doc) {
  const o = doc.toObject();
  o.ai = true;
  return o;
}

async function listMyAICourses(req, res) {
  const list = await AiCourse.find({ student: req.user.id }).sort({ createdAt: -1 });
  return res.json({ courses: list.map(sanitize) });
}

async function getAICourse(req, res) {
  const { id } = req.params;
  const doc = await AiCourse.findById(id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.student.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ course: sanitize(doc) });
}

module.exports = { generateAICourse, listMyAICourses, getAICourse };