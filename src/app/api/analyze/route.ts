import { NextRequest, NextResponse } from 'next/server'

export interface AnalyzeResponse {
  type: 'idea' | 'complaint' | 'news' | 'link' | 'confusion'
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

    const text = content.trim()
    const textLower = text.toLowerCase()
    
    let type: AnalyzeResponse['type'] = 'idea'
    let typeReason = '自动识别'
    
    // 检测链接
    if (textLower.includes('http://') || textLower.includes('https://') || textLower.includes('www.') || /^https?:\/\//.test(text)) {
      type = 'link'
      typeReason = '包含链接'
    }
    // 检测牢骚/负面情绪
    else if (/烦|气死|怒|讨厌|吐槽|抱怨|累死|压力|崩溃|郁闷|无语|愤怒|恶心|心累/.test(text)) {
      type = 'complaint'
      typeReason = '情绪表达'
    }
    // 检测困惑/问题
    else if (/\?|？|怎么|为什么|如何|什么|求助|不懂|困惑|疑问|请教|怎么办|咋办|能不能|可以吗/.test(text)) {
      type = 'confusion'
      typeReason = '疑问句式'
    }
    // 检测资讯/新闻
    else if (/新闻|报道|文章|教程|学习|发现|推荐|分享|阅读|笔记|摘录|资料|干货/.test(text)) {
      type = 'news'
      typeReason = '资讯内容'
    }
    // 默认灵感
    else {
      type = 'idea'
      typeReason = '灵感记录'
    }

    // 提取标签
    const tags: string[] = []
    const keywords = text.match(/[\u4e00-\u9fa5]{2,4}/g) || []
    const uniqueKeywords = [...new Set(keywords)].slice(0, 3)
    tags.push(...uniqueKeywords)

    // 根据类型给出建议
    const suggestions: Record<string, string> = {
      idea: '这是个好想法，可以进一步细化行动计划',
      complaint: '记录情绪是很好的释放方式，保持积极心态',
      confusion: '可以把问题拆解成小问题逐一解决',
      news: '值得收藏，后续可以深入学习',
      link: '记得设置提醒，稍后细读'
    }

    return NextResponse.json({
      type,
      typeReason,
      tags,
      suggestions: suggestions[type]
    })
  } catch (error) {
    console.error('分析错误:', error)
    return NextResponse.json({ error: '分析失败' }, { status: 500 })
  }
}
