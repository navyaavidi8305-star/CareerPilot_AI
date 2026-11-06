🌟 Overview

CareerPilot AI is a full-stack, AI-powered career guidance platform that brings multiple career development tools together in one integrated application.

Students and job seekers often struggle to understand which career opportunities match their current skills, what they need to learn, how to prepare for technical interviews, and how to track their progress.

CareerPilot AI addresses these challenges through intelligent resume analysis, ATS scoring, skill gap identification, career recommendations, personalized learning roadmaps, AI-powered interview preparation, and interactive knowledge graphs.

Instead of providing generic career advice, the platform aims to deliver personalized insights based on an individual's educational background, skills, experience, career interests, and professional goals.

🎯 Vision

To build an intelligent career ecosystem that helps individuals move from their current skill level to career readiness through personalized AI-driven guidance.

❗ Problem Statement

Students and fresh graduates face several challenges when preparing for employment:

Lack of clarity about suitable career paths.

Difficulty understanding resume quality and ATS compatibility.

Limited awareness of the skills required for specific job roles.

Difficulty identifying the gap between existing and required skills.

Lack of structured and personalized learning plans.

Limited opportunities for realistic interview practice.

Difficulty finding relevant learning resources in their preferred language.

Lack of a clear understanding of relationships between skills, technologies, and career opportunities.

Traditional career guidance solutions often address these problems separately.

CareerPilot AI aims to bring these essential career development activities into a unified intelligent platform.

💡 Our Solution

CareerPilot AI provides an integrated career development environment where users can:

Analyze their resumes and understand their career readiness.

Discover suitable career opportunities based on their skills.

Identify missing skills for their target job roles.

Generate personalized learning roadmaps.

Explore learning resources based on preferred languages.

Practice interviews with an AI-powered interview coach.

Interact with an AI career assistant.

Explore relationships between skills and career paths through an interactive knowledge graph.

Track learning progress and career development activities.

✨ Key Features

1. 📄 AI Resume Analysis & ATS Scoring

Analyze uploaded resumes using AI-powered resume processing.

Features:

Upload resumes in PDF and DOCX formats.

Extract relevant information from uploaded documents.

Generate an overall resume score.

Evaluate ATS compatibility.

Identify resume strengths and weaknesses.

Analyze career readiness and employability.

Receive suggestions for improving resume quality.

2. 🎯 Intelligent Career Recommendations

Discover career opportunities aligned with individual skills, qualifications, and interests.

Features:

Personalized career recommendations.

Career-role matching percentage.

Required skill identification.

Industry demand insights.

Salary-related insights.

Career growth potential.

Explanations for recommended career paths.

3. 🔍 AI-Based Skill Gap Analysis

Understand the difference between existing skills and the skills required for a target career.

Features:

Identify existing skills.

Analyze missing or underdeveloped skills.

Compare current and required skill levels.

Categorize skill gaps based on priority.

Recommend skills to learn.

Track progress toward closing identified skill gaps.

4. 🗺️ Personalized Learning Roadmap

Create a structured learning journey based on career goals and individual preferences.

Features:

Personalized learning roadmaps.

Daily, weekly, and monthly learning tasks.

Priority-based task organization.

Skill development tracking.

Learning milestones.

Task completion management.

Progress monitoring.

5. 📚 Language-Based Learning Resources

Make learning more accessible by helping users discover educational videos based on their preferred language.

Features:

Explore different technical and non-technical subjects.

Select a preferred learning language, such as English, Telugu, or Hindi.

Discover relevant YouTube learning resources.

Find resources according to learning levels.

Organize learning around subjects and topics.

Track learning progress.

The goal is to make quality learning resources accessible to students regardless of their preferred language.

6. 🎤 AI Interview Coach

Prepare for technical and HR interviews through AI-assisted interview practice.

Features:

Practice technical, HR, coding, and mock interviews.

Generate role-oriented interview questions.

Customize interview difficulty.

Submit answers and receive AI-generated feedback.

Evaluate technical accuracy.

Assess communication and clarity.

Identify strengths and weak areas.

Receive improvement suggestions.

Track interview performance.

7. 🧠 Interactive Career Knowledge Graph

Explore the connections between career roles, skills, technologies, and learning paths through interactive visualizations.

Features:

Visual representation of career-related knowledge.

Explore relationships between skills and job roles.

Understand skill dependencies.

Discover technologies associated with career paths.

Navigate connected knowledge nodes.

Explore career development relationships visually.

The knowledge graph uses D3.js for interactive data visualization.

8. 🤖 AI Career Assistant

An intelligent conversational assistant designed to help users with career-related questions.

Features:

Career guidance and recommendations.

Resume-related assistance.

Skill development suggestions.

Interview preparation support.

Learning-related queries.

Contextual career guidance.

Conversation history management.

9. 📊 Career Dashboard & Progress Tracking

A centralized dashboard for monitoring career development.

Features:

Resume analysis summaries.

Career recommendations.

Skill gap overview.

Learning progress.

Roadmap status.

Interview performance.

Notifications and important updates.

10. 🔐 Authentication & User Management

Secure account management and personalized user experiences.

Features:

User registration and login.

Password hashing.

JWT-based authentication.

Google OAuth support.

User profile management.

Session management.

Email verification and password recovery workflows.

🔄 Application Workflow

The following workflow illustrates the overall CareerPilot AI user journey.

flowchart TD
    A["User Registration / Login"] --> B["CareerPilot AI Dashboard"]
    B --> C["Upload Resume"]
    C --> D["AI Resume Analysis"]
    D --> E["ATS & Resume Scores"]
    E --> F["Career Recommendations"]
    F --> G["Skill Gap Analysis"]
    G --> H["Personalized Learning Roadmap"]
    H --> I["Language-Based Learning"]
    I --> J["Track Learning Progress"]
    J --> K["AI Interview Coach"]
    K --> L["Interview Feedback & Evaluation"]
    L --> M["Career Knowledge Graph"]
    M --> N["AI Career Assistant"]
    N --> O["Continuous Career Development"]

🛠️ Technology Stack

Frontend

Technology

Purpose

React.js 18

Component-based user interface

TypeScript

Type-safe application development

Vite

Frontend development and build tooling

Tailwind CSS

Styling and responsive layouts

React Router DOM

Client-side navigation

Zustand

State management

Axios

API communication

D3.js

Interactive knowledge graph

Recharts

Data visualization

Lucide React

Icons

React Hook Form

Form management

Backend

Technology

Purpose

Node.js

JavaScript runtime

Express.js

Backend API framework

TypeScript

Backend type safety

Prisma ORM

Database access and management

Socket.IO

Real-time communication

Multer

File upload handling

PDF Parse

PDF text extraction

Mammoth

DOCX text extraction

Zod

Data validation

Database

Technology

Purpose

SQLite

Relational database

Prisma

Database ORM and schema management

Artificial Intelligence

Technology

Purpose

Google Gemini API

AI-powered career assistance and analysis

OpenAI API

AI-powered intelligent application features

Authentication & Security

JSON Web Tokens (JWT)

bcryptjs password hashing

Google OAuth 2.0

Helmet security middleware

Express Rate Limit

CORS configuration

📁 Project Structure

CareerPilot_AI/
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── config/
│   │   ├── index.ts
│   │   └── seed.ts
│   │
│   ├── uploads/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── utils/
│   │   └── main.tsx
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md

👩‍💻 Developer

Avidi Venkata Narasamma

Computer Science and Engineering

GitHub: @navyaavidi8305-star

Project Repository: CareerPilot_AI
