import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRemindersRouter } from './src/server/remindersCron';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Assistant Endpoint for "مكتبتي" (Ask Library Sources)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { question, teacherName, subject, sources } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'السؤال مطلوب.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'لم يتم العثور على مفتاح الذكاء الاصطناعي (GEMINI_API_KEY).',
      });
    }

    const systemInstruction = `أنت المساعد الذكي التربوي المتقدم لمنصة "سند المعلم".
مهمتك تقديم إجابات وشروح تعليمية وتدريسية فائقة الجودة للأستاذ/ة ${teacherName || 'المعلم'} في مادة (${subject || 'المادة التعليمية'}).
- إذا كانت هناك مصادر أو كتب مرفوعة من قبل المعلم، اعتمد عليها بدقة في إجابتك وأشر إلى الدروس والوحدات ذات الصلة.
- اشرح المفاهيم بأسلوب تربوي ممتع وبسيط ومناسب للطلاب، مع أمثلة تطبيقية وأسئلة تدريبية إذا لزم الأمر.
- نسق إجابتك باستخدام القوائم النقطية، العناوين الفرعية، والعلامات التوضيحية لتكون سهلة القراءة ومريحة للمعلم.`;

    let promptContext = question.trim();

    if (sources && Array.isArray(sources) && sources.length > 0) {
      const formattedSources = sources
        .map(
          (s: any, idx: number) =>
            `[المصدر ${idx + 1}: ${s.title || 'مصدر بدون عنوان'} (النوع: ${s.type || 'مستند'})]\n${s.content || ''}`
        )
        .join('\n\n---\n\n');

      promptContext = `المصادر والكتب والمناهج الدراسية المرفوعة من قبل المعلم:
${formattedSources}

===============================
سؤال المعلم:
${question}

يرجى الإجابة بدقة مع الاستناد المباشر للمصادر والمناهج المرفوعة أعلاه ومساعدة المعلم في تقديم أفضل شرح لطلابه.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptContext,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text || 'لم يتم استلام نص من نموذج الذكاء الاصطناعي.';
    return res.json({ answer });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({
      error: error?.message || 'حدث خطأ أثناء معالجة السؤال بواسطة الذكاء الاصطناعي.',
    });
  }
});

// Automated 15-Minute Class Reminders & WhatsApp/Notifications API Route
app.use('/api/reminders', createRemindersRouter());

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
