# Quizmos

Turn your notes into a study reviewer. Upload a PDF, Word, PowerPoint, or text file (or paste your notes) and get a quiz and flashcards, all generated in your browser.

**Live demo:** _add your Vercel link here_

## Features

- Reads PDF, DOCX, PPTX, TXT, and MD files, or pasted text
- Quiz with scoring, keyboard shortcuts, a results screen, and "retry the ones I missed"
- Free method: multiple choice with an explanation quoted from your notes
- AI mode adds true or false, select-all-that-apply, and enumeration (type the list from memory) questions
- Flashcards that flip in 3D; shuffle and step through (arrow keys work)
- Choose how many questions: 5, 10, 25, or a custom amount from 1 to 50
- Edit mode to remove questions that came out wrong
- History: every reviewer you make is saved in your browser (questions only, not your file), so you can reopen it later. Back up / Restore moves them to another device
- Private by default: files are read on your device and never uploaded (unless you turn on AI)
- Optional AI mode: shared access code from the site owner, or your own free Gemini API key, for better, teacher-style questions

## How it works

There is no AI and no API key. Questions come from plain pattern matching (`lib/generate.ts`):

1. **Definitions:** sentences shaped like "X is …", "X refers to …", or "Term: explanation" become term-and-definition questions.
2. **Fill in the blank:** frequently repeated keywords are blanked out of sentences, with other keywords from the same notes as the wrong choices.

Text is pulled out of files in `lib/read-file.ts` using pdf.js, mammoth, and JSZip, which are loaded from cdnjs only when needed.

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

Next.js, TypeScript, Tailwind CSS. Space theme: a CSS starfield with cursor parallax (`components/cosmos.tsx`), cursor-following light on hover (`.spot` in `app/globals.css`), and Space Grotesk via `next/font`.
