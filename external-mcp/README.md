# external-mcp-service

这是一个基于 stdio 的 MCP（Message Computation Provider）示例服务，可以与支持 MCP 协议的客户端集成。

## 安装方式

### 通过 npm 全局安装

```bash
# 全局安装
npm install -g external-mcp-service

# 然后可以直接运行
external-mcp
```

### 通过 npx 临时运行

```bash
npx external-mcp-service
```

### 本地测试安装

如果你想在发布前测试，可以使用:

```bash
# 打包
npm pack

# 全局安装本地包
npm install -g external-mcp-service-1.0.0.tgz

# 或者在MCP客户端中使用
# 命令: npx <本地路径>/external-mcp-service-1.0.0.tgz
```

### 在 MCP 客户端中使用

在 MCP 客户端的"添加 MCP"界面中：

```
名称: 外部MCP工具
类型: stdio
命令: npx external-mcp-service
```

## 支持的工具

该 MCP 服务提供以下工具：

1. **图像生成工具 (image-gen)** - 生成各种描述性图像
2. **翻译工具 (translation)** - 将文本在多种语言之间翻译
3. **数据分析工具 (analysis)** - 分析数据并生成统计报告
4. **股票工具** - 股票市场数据工具
   - **股票报价 (stock-quote)** - 获取股票的实时报价
   - **股票历史 (stock-history)** - 获取股票的历史数据
   - **市场热门 (market-trending)** - 获取市场热门股票
   - **股票搜索 (stock-search)** - 查找股票信息
5. **Twitter 工具** - Twitter 数据获取工具
   - **推文获取 (twitter-feed)** - 获取特定用户的最新推文

## 本地开发与测试

克隆项目后:

```bash
# 安装依赖
npm install

# 启动MCP服务
npm start
```

## 工具参数说明

### 图像生成工具 (image-gen)

```json
{
  "prompt": "一只可爱的猫",
  "count": 2
}
```

### 翻译工具 (translation)

```json
{
  "text": "你好",
  "sourceLanguage": "zh",
  "targetLanguage": "en"
}
```

### 数据分析工具 (analysis)

```json
{
  "data": [1, 2, 3, 4, 5, "文本"],
  "type": "general"
}
```

### 股票报价工具 (stock-quote)

```json
{
  "symbol": "AAPL",
  "region": "US"
}
```

### Twitter 推文获取工具 (twitter-feed)

```json
{
  "username": "elonmusk",
  "count": 5,
  "includeReplies": false,
  "includeRetweets": true
}
```

## MCP 协议说明

该服务实现了基本的 MCP 协议，通过 stdin/stdout 进行通信：

1. 服务启动时发送初始化响应，包含可用工具列表
2. 接收 JSON 格式的工具调用请求
3. 返回 JSON 格式的调用结果

所有请求和响应都是单行 JSON 对象。

## 发布到 npm

如果您想将修改后的版本发布到 npm：

```bash
# 更新版本号
npm version patch  # 或 minor 或 major

# 登录npm
npm login

# 发布
npm publish
```

## 许可证

MIT
