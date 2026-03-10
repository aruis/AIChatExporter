# AI Chat Exporter

一个 Safari 插件（Safari Web Extension）项目，用于将当前 AI 对话导出为多种格式，方便归档、分享与离线阅读。

## 项目说明（简短）

### 目标
在 AI 对话页面中，一键导出当前会话为：
- 长截图（PNG）
- PDF
- Markdown（`.md`）

### 预期体验
- 在插件弹窗中一键导出 Markdown，或打开“排版导出工作台”导出 PNG/PDF
- 导出内容尽量还原对话结构（角色、顺序、代码块、列表等）
- 支持中文/英文常见内容场景

## 开发任务计划

## Provider 扩展（多 AI 平台）

当前已将站点识别与页面结构配置抽象到：
- `AIChatExporter Extension/Resources/ai_providers.js`（注册表入口与默认配置）
- `AIChatExporter Extension/Resources/providers/*.js`（各 provider 独立配置）

内容提取逻辑已拆分为模块化层次：
- `AIChatExporter Extension/Resources/content_runtime.js`（provider/runtime 基础能力）
- `AIChatExporter Extension/Resources/content_markdown_serializer.js`（DOM -> Markdown 序列化）
- `AIChatExporter Extension/Resources/content_extractors.js`（消息提取与 Markdown 组装）
- `AIChatExporter Extension/Resources/content.js`（消息路由与导出编排）

新增平台时，优先只改 provider 配置：
1. 在 `PROVIDERS` 追加 `{ id, name, urlPatterns, profile }`
2. 若 DOM 结构接近现有平台，仅补 `profile.messageRootSelectors`、`profile.contentRootSelectors`
3. 若需要特殊策略，再在 `content.js` 增加 provider-specific 逻辑（尽量少）

推荐优先使用的 profile 字段：
- `titleStrategy`
  - `selectors-first`
  - `document-first`
  - `document-only`
- `titleSelectors`
- `userMessageSelectors`
- `assistantMessageSelectors`
- `messageRootSelectors`
  - 当 user / assistant 无法稳定拆开时再用
- `contentRootSelectors`
- `roleAttributes`
- `roleSelectors`
- `userRoleHints`

当前默认策略已经支持：
- 按 URL 自动匹配 provider
- 按 provider 的选择器提取标题、消息节点与正文节点
- 按 provider 的角色属性识别 `user/assistant/tool`

### Provider 图标维护

provider 图标统一落本地资源目录：
- `AIChatExporter Extension/Resources/images/providers/`

同步脚本：
- `scripts/sync_provider_icons.py`

用途：
- 从社区维护的品牌资源拉取 SVG
- 保持扩展继续使用本地静态资源，不依赖运行时 CDN

执行方式：
```bash
python3 scripts/sync_provider_icons.py
```

仅同步单个 provider：
```bash
python3 scripts/sync_provider_icons.py --provider perplexity
```

### 当前平台状态（以 `ai_providers.js` 与手工验证为准）
- Kimi：已接入（`kimi.com`），待继续回归验证
- ChatGPT：已接入（`chatgpt.com`、`chat.openai.com`）
- Claude：已接入（`claude.ai`），需继续回归验证
- Gemini：已接入（`gemini.google.com`、`aistudio.google.com`）
- Perplexity：已验证可用（`perplexity.ai`、`www.perplexity.ai`）

## 当前进度（2026-03-01）
- 已完成：Popup 双路径入口（Markdown 一键导出 + 排版导出工作台）
- 已完成：Markdown 导出（可直接下载 `.md`）
- 已完成：导出工作台页（所见即所得预览）
- 已完成：3 套对话框样式 + 3 套背景样式（PNG/PDF 共用配置）
- 已完成：PNG 导出（基于工作台预览舞台滚动拼接）
- 已完成：PDF 最小可用（工作台预览舞台 + 打印面板存储为 PDF）
- 已完成：样式偏好记忆（记住上次选择）
- 进行中：工作台导出稳定性回归（不同尺寸/缩放/超长会话）

### 阶段 1：需求与技术验证
- 明确“当前对话”的 DOM 范围与选择器策略
- 验证三种导出路径的可行性：截图、PDF、Markdown
- 定义最小可用版本（MVP）功能边界

### 阶段 2：核心能力开发（MVP）
- 提取对话数据（消息角色、文本、代码块、时间顺序）
- 实现 Markdown 导出（基础格式、代码块保真）
- 实现长截图导出（滚动拼接或整页渲染方案）
- 实现 PDF 导出（基于渲染结果或打印能力）

### 阶段 3：插件交互与文件输出
- 完成 popup 界面：格式选择、导出按钮、状态提示
- 串联 content/background/popup 通信流程
- 处理文件命名、下载触发、异常提示

### 阶段 4：兼容性与质量
- 适配不同对话长度（短会话/超长会话）
- 检查代码块、表格、数学公式等内容在各格式中的表现
- 进行 Safari 端自测与回归测试，修复稳定性问题

### 阶段 5：发布准备
- 完善权限说明与隐私说明
- 优化图标、文案与错误提示
- 补充使用说明与演示截图

## MVP 验收标准（建议）
- 能稳定导出当前页面完整可见对话
- 三种格式均可成功生成并下载
- Markdown 中代码块与段落结构清晰可读
- 长会话导出失败率可接受，且有明确错误提示

## 下一步（短期）
- 做新导出舞台稳定性回归：不同窗口尺寸、不同缩放比例、超长会话
- 提升 Markdown 保真度：列表/表格/引用/公式
- 评估 PDF 程序化导出（替代打印面板）

## Logo 生成（国内供应商适配）

项目新增脚本：`scripts/logo_provider_adapter.py`  
用途：通过“OpenAI 兼容图片生成接口”统一生成 Logo，可对接国内供应商。

### 1) 通义（Qwen 兼容模式）
```bash
export DASHSCOPE_API_KEY='your_key'
export DASHSCOPE_BASE_URL='https://your-compatible-endpoint/v1'
export DASHSCOPE_IMAGE_MODEL='your_image_model'

python3 scripts/logo_provider_adapter.py \
  --provider qwen \
  --n 4 \
  --out-dir output/imagegen
```

### 2) 豆包/Ark（兼容模式）
```bash
export ARK_API_KEY='your_key'
# 可不设置，默认就是官方：
# https://ark.cn-beijing.volces.com
export ARK_BASE_URL='https://ark.cn-beijing.volces.com'
export ARK_IMAGE_MODEL='doubao-seedream-5-0-260128'

python3 scripts/logo_provider_adapter.py \
  --provider doubao \
  --size 2K \
  --response-format url \
  --sequential-image-generation disabled \
  --stream false \
  --watermark true \
  --n 4 \
  --out-dir output/imagegen
```

### 3) 自定义兼容供应商
```bash
export IMAGE_API_KEY='your_key'
export IMAGE_API_BASE_URL='https://your-compatible-endpoint/v1'
export IMAGE_API_MODEL='your_image_model'

python3 scripts/logo_provider_adapter.py \
  --provider compatible \
  --prompt "Design a modern minimal app logo for AIChatExporter" \
  --n 4
```

### 说明
- `doubao` 模式默认请求路径：`https://ark.cn-beijing.volces.com/api/v3/images/generations`
- 其它兼容模式默认请求路径：`{BASE_URL}/images/generations`
- 输出默认写入：`output/imagegen/`
- 可先用 `--dry-run` 检查请求体，不发网络请求
- 如某供应商字段和 OpenAI 兼容协议不一致，需要按该供应商文档微调脚本

## App Store Connect 元数据维护（fastlane deliver）

已内置最小可用配置：
- `Gemfile`
- `fastlane/Appfile`
- `fastlane/Fastfile`
- `fastlane/metadata/en-US/*`
- `fastlane/metadata/zh-Hans/*`
- `fastlane/api_key.json.example`

### 初始化
```bash
bundle install
cp fastlane/api_key.json.example fastlane/api_key.json
```

### 从 ASC 拉取现有文案
```bash
bundle exec fastlane fetch_metadata api_key_path:fastlane/api_key.json
```

### 上传本地文案到 ASC（不上传二进制）
```bash
bundle exec fastlane sync_metadata api_key_path:fastlane/api_key.json
```

说明：
- 当前配置绑定 `app_identifier: net.ximatai.aichatexporter`
- `apple_id: 6760020874`
- `fastlane/api_key.json` 已加入 `.gitignore`
