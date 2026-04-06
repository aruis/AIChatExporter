# AI Chat Exporter

一个用于 Safari 的聊天导出扩展，面向常见 AI 对话网页，支持把当前会话导出为便于归档和分享的文件格式。

## 功能

- 导出当前会话为 Markdown
- 通过排版工作台导出 PNG / PDF
- 尽量保留角色顺序、代码块、列表、表格、引用等结构
- 基于 provider 配置适配多站点 DOM 结构

## 当前支持

- ChatGPT
- Claude
- Gemini
- Perplexity
- Kimi
- 豆包
- 元宝

不同站点的页面结构变化较快，兼容性以实际回归结果为准。

## 项目结构

- `AIChatExporter Extension/Resources/ai_providers.js`
  provider 注册表与默认配置
- `AIChatExporter Extension/Resources/providers/*.js`
  各站点选择器与提取配置
- `AIChatExporter Extension/Resources/content_runtime.js`
  provider 识别、标题与通用运行时逻辑
- `AIChatExporter Extension/Resources/content_markdown_serializer.js`
  DOM 到 Markdown 的序列化
- `AIChatExporter Extension/Resources/content_extractors.js`
  消息根节点提取与对话组装
- `AIChatExporter Extension/Resources/content.js`
  页面侧导出入口
- `AIChatExporter Extension/Resources/popup.js`
  扩展弹窗与工作台交互

## 本地开发

### 运行

1. 用 Xcode 打开 `AIChatExporter.xcodeproj`
2. 运行宿主 App `AIChatExporter`
3. 在 Safari 开启开发者模式并启用扩展
4. 打开目标聊天页面进行调试

### 构建

```bash
xcodebuild -scheme AIChatExporter -project AIChatExporter.xcodeproj -configuration Debug -sdk macosx build CODE_SIGNING_ALLOWED=NO
```

## 添加新站点

优先只新增或修改 provider 配置：

1. 在 `AIChatExporter Extension/Resources/providers/` 新增对应文件
2. 注册 `{ id, name, urlPatterns, profile }`
3. 优先补这些字段：
   - `titleSelectors`
   - `userMessageSelectors`
   - `assistantMessageSelectors`
   - `messageRootSelectors`
   - `contentRootSelectors`
   - `roleAttributes`
   - `roleSelectors`
4. 只有在通用逻辑无法覆盖时，再改提取器或序列化器

## 回归建议

页面结构排查建议优先覆盖这些内容类型：

- 普通问答
- 代码块
- 表格
- 引用
- 数学公式

验证时重点确认：

- 标题不会误取侧边栏历史会话
- `user` / `assistant` 根节点稳定
- 正文不会混入工具栏、复制按钮或提示文案
- 代码块和公式尽量使用原始语义来源而不是渲染文本

## 隐私与仓库约定

- 仓库不提交真实密钥、令牌、私钥或发布账号配置
- 发布侧配置应放在本地环境变量或本地忽略文件中

## 贡献

欢迎提交 issue 和 PR，尤其是：

- 新 provider 接入
- 现有站点 DOM 变更兼容
- Markdown / PNG / PDF 保真度改进
- Safari 兼容性与稳定性修复
