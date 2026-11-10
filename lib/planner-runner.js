import { buildPlannerContext, generatePlannerAnalysis } from "@/lib/planner-assistant";
import { AiError, createAiFetch } from "@/lib/ai-config.mjs";

export function plannerContext(body) {
  const context = buildPlannerContext({ activeType: String(body.activeType || ""), form: body.form && typeof body.form === "object" ? body.form : {} });
  if (!context.destinations.length && !context.formSnapshot.sourceContent) throw new AiError("至少先补一个目的地、想去的点，或贴入已有行程内容。");
  return context;
}
export async function runPlanner(context, config) {
  // Planning does not launch desktop price scrapers. Live inventory stays in the booking API.
  const hotelSignals = [], flightSignals = [];
  const analysis = await generatePlannerAnalysis({ context, hotelSignals, flightQueries: context.flightQueries, flightSignals, fetchImpl: createAiFetch(config), apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
  return { context, hotelSignals, flightQueries: context.flightQueries, flightSignals, analysis, provider: config.provider, model: config.model, notice: "AI 建议未包含实时报价或库存，请到预订页查询。" };
}
