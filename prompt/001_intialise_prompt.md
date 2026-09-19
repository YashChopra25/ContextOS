Build a modern SaaS web application called **ContextOS**.

### Product

ContextOS is a **Universal Context Layer for developer and hackathon platforms**. It combines platform activity and external professional information to create a structured, continuously updated context profile for each person.

The core architecture is:

**Platform Data + GitHub/Web Data → Context Engine → User Context → AI Agent / Search / Matching**

This should NOT look like a generic ChatGPT clone. The AI chat is only the interface for querying the underlying Context Layer.

---

### Main Dashboard

Create a clean developer-focused dashboard with:

* ContextOS logo/name
* Navigation: **Overview, People, Activity, Matches, AI Agent**
* Main search/AI input:
  **"Ask anything about your developer community..."**

Example queries:

* "Is Yash Chopra in our platform?"
* "Tell me about Yash Chopra"
* "Find developers with Solana experience"
* "Who has built blockchain projects?"

Show recent people and recent activity below the search.

---

### AI Agent

Create a conversational **Context Agent** that can query both internal ContextOS data and external web information.

Use **Tavily** for external web search.

Environment variables:

```env
TAVILY_API_KEY=
DATABASE_URL=
```

All API keys must remain server-side. Never expose them through `NEXT_PUBLIC_*`.

The agent should decide whether a query requires:

* ContextOS database
* Tavily web search
* Both

For example:

**"Is Yash Chopra in our platform?"**

→ Search ContextOS.

**"What projects has Yash built?"**

→ Search ContextOS context and activity.

**"Tell me about Yash's recent Web3 work."**

→ Combine ContextOS + Tavily.

Show the processing states:

**Searching ContextOS → Searching web → Synthesizing context**

Responses should display the answer along with **Evidence** and **Sources**.

---

### Person Lookup & Tracking

If the user searches:

**"Is Yash Chopra in our platform?"**

If found:

Show:

**Yash Chopra — Found in platform**

Display a quick context summary:

* Role
* Technical skills
* Projects
* Hackathons
* Recent activity
* Connected sources

CTA:

**View Context Profile**

If not found:

Show:

**Yash Chopra isn't currently in your platform.**

Then:

**Would you like to add and track Yash?**

Buttons:

**Add & Track** / **Cancel**

---

### Add & Track

Create a simple modal/wizard:

**Build Yash's Context**

Fields:

* Name
* GitHub URL
* LinkedIn URL
* Portfolio URL

At least one professional source is required.

CTA:

**Start Tracking**

Show progress:

1. Resolving identity
2. Collecting data
3. Extracting signals
4. Building context profile

Finish with:

**Context profile created successfully.**

---

### Context Profile

Create a detailed person page containing:

**Overview**

AI-generated summary of the person.

**Technical Skills**

Example:

* Solana — High confidence
* Rust — High confidence
* React — High confidence
* Next.js — Medium confidence

Each skill can show its evidence.

**Projects**

Project name, technologies, description, source and date.

**Platform Activity**

Hackathons, project submissions, teams, comments, mentorship and other activity in a timeline.

**GitHub Activity**

Repositories, languages, commits, recent activity and projects.

**Context Signals**

Show structured signals such as:

* Technical focus
* Collaboration
* Activity level
* Hackathon experience
* Professional interests

Every important signal should have an **evidence/source** indicator.

---

### People

Create a searchable people directory with:

* Name
* Role
* Skills
* Projects
* Hackathons
* Activity
* Context status
* Connected sources

Filters for skills, activity, platform users and tracked people.

---

### Matching

Create a simple **Matches** page where an organizer can enter something like:

> Find developers for a Solana hackathon with React experience.

Show relevant developers with an explanation based on their context and evidence.

This is a downstream feature of the Context Layer, not the core system.

---

### Visual Design

Use a premium developer-tool aesthetic inspired by products like Linear, Vercel and GitHub.

* Clean typography
* Neutral backgrounds
* Subtle borders
* Rounded cards
* Compact information density
* Minimal animations
* Dark/light mode
* Responsive design
* Professional dashboards
* Avoid excessive gradients and glassmorphism

Use **Next.js + TypeScript + Tailwind CSS + shadcn/ui**.

Start with realistic mock data and frontend state, but structure the application so the real database, Context Engine, OpenAI and Tavily APIs can be connected later.

The most important concept to communicate visually is:

**Data → Context → Intelligence**

rather than simply:

**User → Chatbot**
