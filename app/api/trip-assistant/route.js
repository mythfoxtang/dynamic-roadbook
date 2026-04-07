import { NextResponse } from "next/server";

const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_MODEL = process.env.DASHSCOPE_MODEL || "qwen-plus";

function buildSystemPrompt(context) {
  return [
    "你是一个家庭自驾路书助手，职责是根据当前真实进度帮助用户做规划、判断和总结。",
    "你不能编造没给出的数据；确定性时间计算已由系统完成，你主要负责解释、建议、取舍和沟通表达。",
    "优先回答和当前日期、实时进度、后续路线、是否删减景点、如何向家人汇报相关的问题。",
    "如果用户问规划，先基于当前进度给出务实方案，不要空泛鼓励。",
    "如果信息不足，明确说缺什么，再给保守建议。",
    `当前上下文：${JSON.stringify(context)}`
  ].join("\n");
}

export async function POST(request) {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "服务端未配置 DASHSCOPE_API_KEY" }, { status: 500 });
    }

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const context = body?.context || {};

    const payload = {
      model: DASHSCOPE_MODEL,
      temperature: 0.7,
      messages: [
        { role: "system", content: buildSystemPrompt(context) },
        ...messages.slice(-12).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || "")
        }))
      ]
    };

    const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message || data?.message || "千问请求失败" }, { status: response.status });
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "AI 服务异常" }, { status: 500 });
  }
}
