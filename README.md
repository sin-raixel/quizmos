# Reviewer Maker

Turn your notes into a study reviewer. Upload a PDF, Word, PowerPoint, or text file (or paste your notes) and get a quiz and flashcards, all generated in your browser.

**Live demo:** _add your Vercel link here_

## Features

- Reads PDF, DOCX, PPTX, TXT, and MD files, or pasted text
- Multiple-choice quiz with scoring and an explanation quoted from your notes
- Flashcards you can flip, shuffle, and step through
- Edit mode to remove questions that came out wrong
- Private by default: files are read on your device and never uploaded
- Optional AI mode: add your own free Gemini API key for better, teacher-style questions

## How it works

There is no AI and no API key. Questions come from plain pattern matching (`lib/generate.ts`):

1. **Definitions:** sentences shaped like "X is …", "X refers to …", or "Term: explanation" become term-and-definition questions.
2. **Fill in the blank:** frequently repeated keywords are blanked out of sentences, with other keywords from the same notes as the wrong choices.

Text is pulled out of files in `lib/read-file.ts` using pdf.js, mammoth, and JSZip, which are loaded from cdnjs only when needed.

## Optional AI mode

Tick "Smarter questions with AI" and paste a free Gemini API key from Google AI Studio. The key stays in your browser and is only sent to Google. With AI on, your notes are sent to Google, so don't use it for private material. If the AI request fails, the app falls back to the free method. Model names are listed in `lib/ai.ts` and can be updated there.

## Limitations

- Works best on structured notes with clear definitions; flowing paragraphs give weaker questions.
- Scanned PDFs (images of pages) can't be read without OCR.
- Nothing is saved between visits yet.

## Project structure

```
app/          page and layout
components/   upload card, quiz, flashcards, question editor
lib/          file reading and question generation
```

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Built with

Next.js, TypeScript, Tailwind CSS.
