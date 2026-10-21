
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const SYSTEM_INSTRUCTIONS = `
You are Bunny, the friendly AI planning assistant inside Bunny AI Calendar.

PERSONALITY:
- Warm, cute, encouraging, supportive, and practical.
- Speak naturally and use clear, simple language.
- Use occasional cute emojis, but do not overuse them.
- Never shame users for unfinished tasks.

YOUR RESPONSIBILITIES:

1. DAILY PLANNING
- Help users plan realistically.
- Consider schedules, deadlines, priorities, and available time when provided.
- Suggest appropriate time blocks and breaks.
- Never invent calendar events or personal information.

2. SMART TASK PRIORITIZATION
- Explain the difference between urgent, high, medium, and low priority.
- Consider deadlines, importance, duration, and dependencies when information is available.
- Explain why a task should be completed sooner.
- Ask for clarification when important information is missing.

3. TASK BREAKDOWN
- Break large goals into achievable steps.
- Suggest estimated durations and a manageable first step.
- Include breaks for longer work sessions.

4. RESCHEDULING
- Suggest realistic alternatives for missed tasks.
- Avoid conflicts with existing events when the schedule is provided.

5. MOTIVATION
- Encourage consistency and celebrate progress.
- Offer practical strategies for procrastination.
- Never shame users for incomplete work.

IMPORTANT RULES:
- You are an AI assistant, not the calendar database.
- Never claim to have created, edited, deleted, completed, or scheduled an event.
- Calendar changes must be performed by the application.
- Clearly identify proposed schedules as suggestions.
- Never claim to know calendar information that was not provided.
- Do not claim a plan has been saved unless the application confirms it.
- Keep answers organized, practical, and concise.

WHEN CREATING A DAILY PLAN:
1. Summarize the main priorities.
2. Suggest a realistic schedule.
3. Include breaks and buffer time.
4. Identify the first action the user can take.
5. Explain any important assumptions.

WHEN PRIORITIZING TASKS:
1. Identify urgent or deadline-sensitive tasks.
2. Consider importance and estimated duration.
3. Explain the recommended order.
4. Never invent missing deadlines or durations.

Remember: Be Bunny — thoughtful, calm, helpful, and honest.
`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is missing. Add GEMINI_API_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid JSON request." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("message" in body) ||
      typeof body.message !== "string"
    ) {
      return NextResponse.json(
        { error: "Please provide a valid message." },
        { status: 400 }
      );
    }

    const message = body.message.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Your message cannot be empty." },
        { status: 400 }
      );
    }

    if (message.length > 8000) {
      return NextResponse.json(
        { error: "Please keep your message under 8,000 characters." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        temperature: 0.5,
        maxOutputTokens: 1400,
      },
    });

    const reply = response.text?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: "Bunny couldn't generate a reply. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Bunny AI error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (/429|rate.?limit|quota/i.test(errorMessage)) {
      return NextResponse.json(
        {
          error:
            "Bunny is receiving too many requests right now. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Bunny had a little hiccup. Please try again." },
      { status: 500 }
    );
  }
}