import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export interface AnalyzeResponse {
  type: 'idea' | 'complaint' | 'confusion' | 'news' | 'link'
  typeReason: string
  tags: string[]
  suggestions: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一个智能内容分类助手。分析用户输入的内容，返回 JSON 格式（只返回 JSON）：
{
  "type": "idea|complaint|confusion|news|link",
  "typeReason": "简短理由（5字以内）",
  "tags": ["标签1", "标签2", "标签3"],
  "suggestions": "实用建议（30字以内）"
}

类型判断规则（按优先级）：
1. link(链接)：包含 http/https 开头的网址
2. complaint(牢骚)：表达不满、抱怨、吐槽、负面情绪
3. confusion(困惑)：提出问题、困惑、求助
4. news(资讯)：新闻标题、文章摘要、知识要点
5. idea(灵感)：创意想法、灵感记录、新点子、计划

标签提取规则：
- 提取 3-5 个关键词
- 标签简洁（2-6个字）
- 关注：主题词、动作词、领域词`
        },
        { role: 'user', content: content.trim() }
      ],
      temperature: 0.3,
    })

    const aiResponse = completion.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('AI 未返回有效响应')
    }

    let jsonStr = aiResponse.trim()
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7)
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3)
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3)

    const analysisResult: AnalyzeResponse = JSON.parse(jsonStr.trim())

    const validTypes = ['idea', 'complaint', 'confusion', 'news', 'link']
    if (!validTypes.includes(analysisResult.type)) {
      analysisResult.type = 'idea'
    }
    if (!Array.isArray(analysisResult.tags)) analysisResult.tags = []
    if (!analysisResult.typeReason) analysisResult.typeReason = '自动分类'
    if (!analysisResult.suggestions) analysisResult.suggestions = '这是一条有价值的记录'

    return NextResponse.json(analysisResult)
  } catch (error) {
    console.error('AI 分析错误:', error)
    return NextResponse.json(
      { error: 'AI 分析失败，请稍后重试' },
      { status: 500 }
    )
  }
}
