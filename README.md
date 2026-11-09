# Quizmos

Turn your notes into a study reviewer. Upload a PDF, Word, PowerPoint, or text file (or paste your notes) and get a quiz and flashcards, generated in your browser (with optional AI for smarter questions).

**Live demo:** _add your Vercel link here_

## Features

- Reads PDF, DOCX, PPTX, TXT, and MD files, or pasted text
- Quiz with scoring, keyboard shortcuts, a results screen, and "retry the ones I missed"
- Free method: multiple choice with an explanation quoted from your notes
- AI mode adds true or false, select-all-that-apply, and enumeration (type the list from memory) questions
- Flashcards that flip in 3D; shuffle and step through (arrow keys work)
- Choose how many questions: 5, 10, 25, or a custom amount from 1 to 50
- Edit mode to remove questions that came out wrong
- Export: print or save as a PDF (questions, then an answer key), or download the flashcards for Anki or Quizlet
- History: every reviewer you make is saved in your browser (questions only, not your file), so you can reopen it later. Back up / Restore moves them to another device
- Private by default: files are read on your device and never uploaded (unless you turn on AI)
- Optional AI mode: shared access code from the site owner, or your own free Gemini API key, for better, teacher-style questions

## How it works

By default everything runs in your browser and no AI is involved. Questions come from pattern matching (`lib/generate.ts`):

1. **Definitions:** lines shaped like "X is …", "X refers to …", "Term: meaning", or "Term - meaning" become term-and-definition questions. Slide headings (like "Causes"), exercises, formulas, bullet lists, and cut-off lines are filtered out.
2. **Wrong answers come from the same notes:** other terms or other definitions from your lesson, so the choices look like they belong together.
3. **Fill in the blank:** a defined term that shows up in another sentence is blanked out. For ordinary paragraphs, a name or number is blanked instead, with other names or numbers from the notes as the choices.

Text is pulled out of files in `lib/read-file.ts` using pdf.js, mammoth, and JSZip, which are loaded from cdnjs only when needed. Optional AI mode (below) is the only part that sends anything off your device.

## Optional AI mode

Click the key icon in the top bar (it opens on hover) and switch on "Smarter questions with AI". There are two ways it can work:

1. **Shared key (best for friends).** You, the site owner, keep your Gemini key on the server. Friends only type the access code you give them; no API keys, no accounts. Their notes go browser → your server → Google.
2. **Bring your own key (advanced).** Anyone can instead paste their own free Gemini key from Google AI Studio. That key stays in their browser and is sent only to Google. This is also what the site falls back to if you haven't set up the shared key.

If an AI request fails, the app falls back to the free method. Model names are listed in `lib/ai.ts`.

### Setting up the shared key

1. Get a key at https://aistudio.google.com/apikey. In Google AI Studio / Cloud, set a quota or spending limit on it.
2. Add these environment variables (Vercel: Project → Settings → Environment Variables; local: copy `.env.example` to `.env.local`):
   - `GEMINI_API_KEY`: your key
   - `ACCESS_CODE`: any passcode you'll share with friends
   - `RATE_LIMIT_PER_DAY`: optional, default 10 per person per day
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: optional, but recommended on Vercel so the daily limit is reliable (the free Upstash tier is plenty). Without them the limit is a best-effort in-memory counter that can reset.
3. Redeploy. The access-code box appears automatically once both `GEMINI_API_KEY` and `ACCESS_CODE` are set.

Never prefix these variables with `NEXT_PUBLIC_` and never commit them. Everyone shares one free-tier quota, so many people at once can hit Google's rate limits; the app then falls back to the free method. On Gemini's free tier, Google may use inputs to improve its products; a paid key avoids that.

### Abuse protection

- **Access code guessing:** after 5 wrong codes in an hour, that IP address is blocked until the hour is up. The right code is refused too while blocked.
- **Daily limit:** each person gets `RATE_LIMIT_PER_DAY` AI reviewers. A request that fails (Google is down, a model times out) gives its slot back.
- **Timeouts:** each Gemini attempt gets 18 seconds before the next model is tried, so all three models fit inside the server's 60-second limit.
- People on the same network (a school, for example) share one IP address, so they share these limits.
- Both counters use Upstash when it's configured, and an in-memory fallback otherwise.

## Limitations

- Works best on structured notes with clear definitions; flowing paragraphs give weaker questions.
- Scanned PDFs (images of pages) can't be read without OCR.
- History is stored in the browser (localStorage), so it is per device and browser, and clearing site data erases it. Use Back up to keep a copy. Real accounts would need a database.

## Project structure

```
app/          page, layout, and the /api/generate server route
components/   upload card, AI key menu, history, quiz, flashcards, question editor
lib/          file reading and question generation
```

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Built with

Next.js, TypeScript, Tailwind CSS. Space theme: a CSS starfield with cursor parallax (`components/cosmos.tsx`), cursor-following light on hover (`.spot` in `app/globals.css`), and Poppins via `next/font`.
