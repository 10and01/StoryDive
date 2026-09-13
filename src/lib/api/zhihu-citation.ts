// 知乎真实回答引用（客户端形状）：NPC/刘看山气泡下方的引用 chip 数据。
// 服务端检索结果随 AI 响应返回；链接永远是平台返回的真实 URL，不由 LLM 生成。

export interface ZhihuCitation {
  n: number;
  title: string;
  contentText?: string;
  url: string;
  voteUpCount: number;
  authorName: string;
  authorAvatar?: string;
  contentType?: string;
}
