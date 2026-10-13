# TestAssess — Online Test & Assessment Platform

A full-stack web app where **teachers** create and grade tests and **students**
log in to take them. Built with Node.js, Express, MongoDB (Mongoose), JWT
auth and bcryptjs — the same stack used in Nagrik Setu and CyberShield.

## Features

**Teacher (admin) module**
- Register/login as a teacher
- Create classes — each class gets a unique join code to share with students
- Build tests with MCQ, short-answer and essay questions, set duration and
  an availability window
- Publish/unpublish tests
- View all submissions for a test; MCQs are auto-graded instantly, short
  answer/essay questions are graded manually with marks entered per question
- Class-level analytics: average score and grade distribution per test

**Student module**
- Register with the class join code from their teacher, then log in
- See all published tests available to their class
- Take a test with a countdown timer that **auto-submits when time runs out**
  (persists across refreshes via localStorage, keyed to the test start time)
- View their own results — instant for MCQ-only tests, or "awaiting grading"
  until the teacher grades subjective answers

## Tech stack

- **Backend:** Node.js, Express, MongoDB Atlas, Mongoose
- **Auth:** JWT (jsonwebtoken) + bcryptjs for password hashing
- **Frontend:** Plain HTML/CSS/JS served as static files by Express (no build step)

## Project structure

```
test-assessment-app/
├── config/db.js              MongoDB connection
├── models/                   User, Class, Test, Submission schemas
├── middleware/auth.js        JWT verification + role guard
├── controllers/               auth / teacher / student business logic
├── routes/                    /api/auth, /api/teacher, /api/student
├── utils/grading.js          percentage → letter grade, grading helpers
├── public/                    all frontend pages, css, js
└── server.js
```

## Local setup

```bash
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run dev             # nodemon, or `npm start` for plain node
```

Visit `http://localhost:5000`.

## Environment variables (.env)

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/testAssessmentDB
JWT_SECRET=<a long random string>
JWT_EXPIRES_IN=7d
```

## Deploying (Render, same as your previous projects)

1. Push this project to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install`  ·  Start command: `npm start`
4. Add the environment variables from `.env` in Render's dashboard.
5. Use a MongoDB Atlas cluster (free tier is fine) and whitelist `0.0.0.0/0`
   for Render's IPs, or use Atlas's "allow access from anywhere" for testing.

## How grading works

- **MCQ:** graded automatically on submit by comparing the student's chosen
  option text to `correctAnswer` (case-insensitive).
- **Short answer / essay:** stored as `marksAwarded: null` until the teacher
  enters marks on the Test Results page. A submission's overall `status`
  flips from `pending_review` to `graded` once every question has marks.
- **Letter grade:** computed from the percentage score once fully graded
  (A+ 90+, A 80+, B 70+, C 60+, D 50+, E 40+, F below 40) — see
  `utils/grading.js` if you want to change the boundaries.

## Notes / next steps you might want

- Add password reset (currently none — teachers/students just re-register with a new email).
- Add CSV export of class results.
- Add pagination if a class grows very large.
- Swap the timer's `localStorage` persistence for a server-side `startedAt`
  timestamp (stored on first fetch of the test) if you want it to survive
  a student switching devices mid-test.
