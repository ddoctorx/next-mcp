/**
 * 股票期权工具 - 使用yahoo-finance2库获取特定股票的期权信息
 */

// 设置环境变量以抑制Yahoo Finance的调查通知
process.env.SUPPRESS_SURVEY_NOTIFICATIONS = true;

const yahooFinance = require('yahoo-finance2').default;

// 配置Yahoo Finance API - 防爬虫请求头
const yahooFinanceConfig = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Connection: 'keep-alive',
    'Cache-Control': 'max-age=0',
    Referer: 'https://finance.yahoo.com/',
    Origin: 'https://finance.yahoo.com',
  },
  validation: false, // 禁用结果验证以避免错误
  maxRetries: 3, // 请求失败时重试次数
  timeout: 10000, // 请求超时时间（毫秒）
};

// 抑制Yahoo Finance的问卷调查通知
yahooFinance.suppressNotices(['yahooSurvey']);

// 设置Yahoo Finance默认选项
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
    enabled: false, // 全局禁用验证
    strict: false, // 禁用严格模式
  },
});

// 刷新cookie和crumb的函数，用于处理授权失败
async function refreshCrumbAndCookie() {
  try {
    // 通过简单请求触发crumb刷新
    await yahooFinance.search('AAPL');
    console.log('成功刷新Yahoo Finance的cookie和crumb');
    return true;
  } catch (error) {
    console.error('刷新Yahoo Finance的cookie和crumb失败', error);
    return false;
  }
}

// 简化期权数据的函数
function simplifyOptionsData(optionsData, formatted = false) {
  if (!optionsData || !optionsData.options || optionsData.options.length === 0) {
    return { error: '未找到期权数据' };
  }

  // 提取可用的到期日期
  const expirationDates = optionsData.expirationDates.map(
    timestamp => new Date(timestamp).toISOString().split('T')[0],
  );

  // 提取当前期权链
  const currentOptions = optionsData.options[0];

  // 如果用户请求格式化数据，返回完整格式
  if (formatted) {
    return {
      symbol: optionsData.underlyingSymbol,
      expirationDates,
      currentExpirationDate: new Date(currentOptions.expirationDate).toISOString().split('T')[0],
      calls: currentOptions.calls.map(call => ({
        contractSymbol: call.contractSymbol,
        strike: call.strike,
        lastPrice: call.lastPrice,
        change: call.change,
        percentChange: call.percentChange,
        volume: call.volume,
        openInterest: call.openInterest,
        bid: call.bid,
        ask: call.ask,
        impliedVolatility: call.impliedVolatility,
        inTheMoney: call.inTheMoney,
      })),
      puts: currentOptions.puts.map(put => ({
        contractSymbol: put.contractSymbol,
        strike: put.strike,
        lastPrice: put.lastPrice,
        change: put.change,
        percentChange: put.percentChange,
        volume: put.volume,
        openInterest: put.openInterest,
        bid: put.bid,
        ask: put.ask,
        impliedVolatility: put.impliedVolatility,
        inTheMoney: put.inTheMoney,
      })),
    };
  }

  // 返回简化的数据结构
  return {
    symbol: optionsData.underlyingSymbol,
    expirationDates,
    currentExpirationDate: new Date(currentOptions.expirationDate).toISOString().split('T')[0],
    calls: currentOptions.calls.slice(0, 5).map(call => ({
      strike: call.strike,
      lastPrice: call.lastPrice,
      change: call.change,
      volume: call.volume || 'N/A',
      openInterest: call.openInterest || 'N/A',
    })),
    puts: currentOptions.puts.slice(0, 5).map(put => ({
      strike: put.strike,
      lastPrice: put.lastPrice,
      change: put.change,
      volume: put.volume || 'N/A',
      openInterest: put.openInterest || 'N/A',
    })),
  };
}

// 定义股票期权工具
const stockOptionsTool = {
  name: 'stock-options',
  description: '获取特定股票的期权信息，包括看涨和看跌期权的价格、成交量和未平仓合约数',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: '股票代码，例如AAPL、MSFT、GOOGL等',
      },
      date: {
        type: 'string',
        description: '可选参数，期权到期日期，格式为YYYY-MM-DD或时间戳',
      },
      formatted: {
        type: 'boolean',
        description: '可选参数，是否返回格式化的详细数据',
      },
      region: {
        type: 'string',
        description: '可选参数，区域代码，默认为US',
      },
      lang: {
        type: 'string',
        description: '可选参数，语言代码，默认为en-US',
      },
    },
    required: ['symbol'],
  },

  async execute(params) {
    try {
      // 获取参数
      const { symbol, date, formatted = false, region = 'US', lang = 'en-US' } = params;

      // 验证股票代码
      if (!symbol) {
        return {
          error: '缺少必要参数',
          message: '请提供股票代码 (symbol)',
        };
      }

      // 构建请求选项，使用预定义的配置
      const queryOptions = {
        ...yahooFinanceConfig,
        formatted: Boolean(formatted),
        lang,
        region,
      };

      // 如果提供了日期参数，添加到请求选项中
      if (date) {
        queryOptions.date = date;
      }

      console.log(`尝试获取 ${symbol} 的期权数据`);

      // 获取期权数据
      let result;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // 调用Yahoo Finance API获取期权数据
          result = await yahooFinance.options(symbol, queryOptions);
          break; // 成功获取数据，跳出循环
        } catch (error) {
          retryCount++;
          console.log(`获取期权数据失败(尝试 ${retryCount}/${maxRetries}): ${error.message}`);

          // 如果是认证错误，尝试刷新crumb
          if (
            error.message.includes('401') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('Invalid Crumb')
          ) {
            console.log('检测到crumb错误，尝试刷新...');
            await refreshCrumbAndCookie();
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
          } else if (error.message && error.message.includes('Unsupported date type')) {
            // 处理日期格式错误
            return {
              error: '日期格式错误',
              message: '提供的日期格式无效，请使用YYYY-MM-DD格式或UNIX时间戳',
            };
          } else if (retryCount >= maxRetries) {
            // 达到最大重试次数，抛出错误
            throw error;
          } else {
            // 其他错误，等待后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      // 处理结果为空的情况
      if (!result || !result.options || result.options.length === 0) {
        return {
          error: '未找到数据',
          message: `未找到股票代码 ${symbol} 的期权数据`,
        };
      }

      // 简化期权数据
      const simplifiedData = simplifyOptionsData(result, formatted);

      // 返回结果
      return {
        symbol,
        date: date || '当前',
        formatted: Boolean(formatted),
        fetchTime: new Date().toISOString(),
        ...simplifiedData,
      };
    } catch (error) {
      console.error('获取期权数据失败:', error);
      return {
        error: '获取数据失败',
        message: error.message || '无法获取期权数据',
      };
    }
  },
};

module.exports = stockOptionsTool;
