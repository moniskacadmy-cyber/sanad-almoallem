// Smart preparation: prompt builders + validation (pure, tested). Runs as native ESM on Vercel.

export const PREP_MODES = [
  'handout_explain',
  'handout_review',
  'handout_exam_night',
  'handout_unit_summary',
  'formatter',
  'lesson_studio',
  'exam_paper',
  'exam_electronic',
  'video_script',
] as const;
export type PrepMode = (typeof PREP_MODES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MAX_TEXT = 12000;

const diffLabel: Record<Difficulty, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب (تفكير عليا)' };

export interface PrepInput {
  mode: PrepMode;
  topic: string;
  text: string;
  grade: string;
  difficulty: Difficulty;
  count: number;
}

export function parsePrepInput(body: Record<string, unknown>): { ok: true; value: PrepInput } | { ok: false; error: string } {
  const mode = body.mode as PrepMode;
  if (!(PREP_MODES as readonly string[]).includes(mode)) return { ok: false, error: 'نوع التحضير غير صالح.' };
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 200) : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length > MAX_TEXT) return { ok: false, error: `النص طويل جدًا (الحد ${MAX_TEXT} حرف).` };
  if (!topic && text.length < 20) return { ok: false, error: 'اكتب موضوع الدرس أو الصق نص الدرس.' };
  if (mode === 'formatter' && text.length < 20) return { ok: false, error: 'الصق النص المراد تنسيقه.' };
  const grade = typeof body.grade === 'string' ? body.grade.trim().slice(0, 60) : '';
  const difficulty = (DIFFICULTIES as readonly string[]).includes(body.difficulty as string) ? (body.difficulty as Difficulty) : 'medium';
  const n = Number(body.count);
  const count = Number.isFinite(n) ? Math.min(30, Math.max(3, Math.round(n))) : 10;
  return { ok: true, value: { mode, topic, text, grade, difficulty, count } };
}

const base = (i: PrepInput, subject: string) =>
  `المادة: ${subject || 'عامة'}\nالصف/المرحلة: ${i.grade || 'غير محدد'}\nموضوع الدرس: ${i.topic || '(مذكور في النص)'}${
    i.text ? `\n\nنص/محتوى الدرس المرجعي (اعتمد عليه ولا تخترع معلومات خارجه):\n"""\n${i.text}\n"""` : ''
  }`;

export const PREP_SYSTEM =
  'أنت مساعد تحضير تربوي لمعلم خصوصي عربي. اكتب بالعربية الفصحى المبسطة، بتنسيق Markdown نظيف (عناوين ## وقوائم وترقيم)، بدقة علمية، وبدون مقدمات أو خاتمات زائدة عن المطلوب.';

export function buildPrepPrompt(i: PrepInput, subject: string): string {
  const b = base(i, subject);
  switch (i.mode) {
    case 'handout_explain':
      return `${b}\n\nأعد ملزمة شرح كاملة: أهداف الدرس، تمهيد، شرح مفصل بأمثلة محلولة، ملاحظات هامة، ثم تدريبات متدرجة (${i.count} سؤال) بإجاباتها في النهاية.`;
    case 'handout_review':
      return `${b}\n\nأعد ملزمة مراجعة مركزة: أهم القواعد والمفاهيم في نقاط، جدول مقارنات إن لزم، أخطاء شائعة، ثم ${i.count} سؤال مراجعة متنوع بإجاباته.`;
    case 'handout_exam_night':
      return `${b}\n\nأعد ملزمة "ليلة الامتحان": خلاصة في صفحة واحدة، أهم القوانين/الأفكار المتوقعة في الامتحان، نصائح زمنية، وأسئلة سريعة متوقعة (${i.count}) بإجاباتها المختصرة.`;
    case 'handout_unit_summary':
      return `${b}\n\nأعد ملخص وحدة منظم: خريطة الأفكار الرئيسية، تعريفات، قوانين، أمثلة قصيرة، وملخص من 5 نقاط في النهاية.`;
    case 'formatter':
      return `${b}\n\nأعد تنسيق النص المرجعي أعلاه كدرس منسق: عنوان رئيسي، عناوين فرعية مرقمة، قوائم نقطية، وتمييز المصطلحات المهمة بخط عريض. لا تغيّر المعلومات ولا تضف محتوى جديدًا، وأصلح الأخطاء الإملائية فقط.`;
    case 'lesson_studio':
      return `${b}\n\nمن هذا الدرس أنشئ:\n# أولاً: الشرح الكامل\n(أهداف، شرح مبسط بأمثلة، ملخص)\n# ثانيًا: الامتحان الكامل بثلاثة مستويات\nلكل مستوى (سهل / متوسط / صعب) ${Math.max(3, Math.round(i.count / 3))} أسئلة متنوعة (اختيار من متعدد وصح/خطأ وأسئلة مقالية قصيرة)، ثم نموذج الإجابة لكل مستوى.`;
    case 'exam_paper':
      return `${b}\n\nمستوى الصعوبة: ${diffLabel[i.difficulty]}.\nأعد امتحانًا ورقيًا جاهزًا للطباعة: ترويسة (اسم الطالب، التاريخ، الدرجة)، ${i.count} سؤالًا موزعة على أقسام (اختيار من متعدد، صح/خطأ، أكمل، مقالي) مع درجة لكل سؤال، ثم صفحة منفصلة بعنوان "نموذج الإجابة".`;
    case 'exam_electronic':
      return `${b}\n\nمستوى الصعوبة: ${diffLabel[i.difficulty]}.\nأعد ${i.count} سؤال اختيار من متعدد فقط. أخرج JSON صالحًا فقط بدون أي نص أو علامات Markdown، على هذا الشكل بالضبط:\n[{"q":"نص السؤال","options":["أ","ب","ج","د"],"answer":0,"explain":"شرح مختصر للإجابة"}]\nحيث answer هو رقم الخيار الصحيح بدءًا من 0.`;
    case 'video_script':
      return `${b}\n\nأعد خطة فيديو تعليمي قصير (5-8 دقائق): عنوان جذاب، قصة/مشهد افتتاحي، سيناريو مقسم لمشاهد مع الزمن التقريبي والنص المنطوق واللقطات المقترحة، ثم 5 أسئلة تفاعلية تُعرض أثناء الفيديو وفي نهايته.`;
  }
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

/** Extracts and validates the quiz JSON from a model answer. Throws if unusable. */
export function parseQuizJson(raw: string): QuizQuestion[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('الرد لا يحتوي على أسئلة.');
  const arr = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error('صيغة الأسئلة غير صالحة.');
  const out: QuizQuestion[] = [];
  for (const x of arr) {
    const options = Array.isArray(x?.options) ? x.options.map((o: unknown) => String(o).slice(0, 200)).slice(0, 6) : [];
    const answer = Number(x?.answer);
    if (typeof x?.q !== 'string' || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    out.push({ q: x.q.slice(0, 500), options, answer, explain: typeof x.explain === 'string' ? x.explain.slice(0, 400) : '' });
  }
  if (out.length === 0) throw new Error('لم أستطع قراءة الأسئلة، حاول مرة أخرى.');
  return out;
}
