import { NextRequest, NextResponse } from "next/server";
import {
  ANTHROPIC_MODEL,
  extractJson,
  getAnthropicClient,
} from "@/lib/anthropicServer";
import { FoodEstimate } from "@/lib/types";

export const runtime = "nodejs";

interface EstimateFoodBody {
  itemName?: string;
  imageBase64?: string;
  mediaType?: string;
}

const SYSTEM_PROMPT = `You are a nutrition estimation assistant embedded in a personal fitness tracker.
Given either a text description of a food item, or a photo (nutrition label or a plate of food), estimate calories and protein.
- If a nutrition label is visible, read serving size and macros directly from the label.
- If it's a photo of a plate/meal, visually estimate portion size and compute a reasonable calorie/protein estimate.
- If given only typed text with no numbers, estimate typical calories/protein for that food and a typical portion.
Respond with ONLY a JSON object, no markdown fences, no extra prose, in this exact shape:
{"item": string, "calories": number, "protein_g": number, "confidence_note": string}
confidence_note should be a brief (<25 words) note on your confidence and any assumptions made (e.g. portion size assumed).`;

export async function POST(req: NextRequest) {
  let body: EstimateFoodBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.itemName && !body.imageBase64) {
    return NextResponse.json(
      { error: "Provide itemName or imageBase64" },
      { status: 400 }
    );
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server not configured" },
      { status: 503 }
    );
  }

  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
      }
  > = [];

  if (body.imageBase64) {
    const mediaType = (body.mediaType || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: body.imageBase64 },
    });
    content.push({
      type: "text",
      text: body.itemName
        ? `This photo is labeled "${body.itemName}" by the user. Estimate calories and protein.`
        : "Estimate calories and protein for this photo (nutrition label or plate of food).",
    });
  } else {
    content.push({
      type: "text",
      text: `Estimate calories and protein for this food item: "${body.itemName}"`,
    });
  }

  const attempt = async (): Promise<FoodEstimate> => {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from model");
    }
    return extractJson<FoodEstimate>(textBlock.text);
  };

  try {
    const estimate = await attempt();
    return NextResponse.json(estimate);
  } catch {
    try {
      const estimate = await attempt();
      return NextResponse.json(estimate);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Could not get a structured estimate from the model. Enter calories/protein manually.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }
  }
}
