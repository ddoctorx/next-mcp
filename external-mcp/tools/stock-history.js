/**
 * 股票历史数据查询工具
 */
const yahooFinance = require('yahoo-finance2').default;

// 工具描述
const description = '获取股票的历史价格和交易数据';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
      description: '股票代码，例如 AAPL、MSFT、BABA 等',
    },
    interval: {
      type: 'string',
      description: '数据间隔：1d(每日), 1wk(每周), 1mo(每月)',
      enum: ['1d', '1wk', '1mo'],
      default: '1d',
    },
    period: {
      type: 'string',
      description:
        '要查询的时间范围：1w(一周), 1m(一个月), 3m(三个月), 6m(六个月), 1y(一年), 5y(五年), max(最大)',
      enum: ['1w', '1m', '3m', '6m', '1y', '5y', 'max'],
      default: '1m',
    },
  },
  required: ['symbol'],
};

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

// 尝试刷新Yahoo Finance API的crumb和cookie
const refreshCrumbAndCookie = async () => {
  try {
    console.log('尝试刷新Yahoo Finance API的crumb和cookie...');
    // 通过简单请求触发crumb刷新
    const dummyResult = await yahooFinance.search('AAPL');
    console.log('触发crumb刷新成功');
    return true;
  } catch (error) {
    console.error('刷新Yahoo Finance API的crumb失败:', error);
    return false;
  }
};

// 计算开始日期
function calculatePeriod(periodKey) {
  const now = new Date();
  let startDate;

  switch (periodKey) {
    case '1w':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case '1m':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case '3m':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case '6m':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      break;
    case '1y':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case '5y':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 5);
      break;
    case 'max':
      startDate = new Date('1970-01-01'); // 使用远的日期来代表最大范围
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1); // 默认一个月
  }

  return {
    period1: startDate,
    period2: now,
  };
}

/**
 * 执行工具
 * @param {Object} params - 调用参数
 * @param {string} params.symbol - 股票代码
 * @param {string} [params.interval='1d'] - 数据间隔
 * @param {string} [params.period='1m'] - 查询时间范围
 * @returns {Promise<Object>} 获取结果
 */
async function execute(params = {}) {
  const { symbol, interval = '1d', period = '1m' } = params;

  if (!symbol) {
    // 如果没有提供股票代码，返回示例
    return {
      error: '缺少必要参数',
      message: '请提供有效的股票代码(symbol)',
      examples: ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'BABA'],
      supportedIntervals: ['1d', '1wk', '1mo'],
      supportedPeriods: ['1w', '1m', '3m', '6m', '1y', '5y', 'max'],
      isExample: true,
    };
  }

  try {
    // 根据period参数计算日期范围
    const { period1, period2 } = calculatePeriod(period);

    // 构建请求选项
    const queryOptions = {
      period1,
      period2,
      interval,
      ...yahooFinanceConfig,
    };

    let historicalData;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // 调用Yahoo Finance API获取历史数据
        historicalData = await yahooFinance.historical(symbol, queryOptions);
        break; // 成功获取数据，跳出循环
      } catch (error) {
        retryCount++;
        console.log(`获取历史数据失败(尝试 ${retryCount}/${maxRetries}): ${error.message}`);

        // 如果是认证错误，尝试刷新crumb
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized') ||
          error.message.includes('Invalid Crumb')
        ) {
          console.log('检测到crumb错误，尝试刷新...');
          await refreshCrumbAndCookie();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        } else if (retryCount >= maxRetries) {
          // 达到最大重试次数，抛出错误
          throw error;
        } else {
          // 其他错误，等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    if (!historicalData || historicalData.length === 0) {
      throw new Error(`未找到股票代码 ${symbol} 的历史数据`);
    }

    // 计算一些统计数据
    let totalVolume = 0;
    let highestPrice = -Infinity;
    let lowestPrice = Infinity;

    historicalData.forEach(item => {
      totalVolume += item.volume || 0;
      highestPrice = Math.max(highestPrice, item.high || 0);
      lowestPrice = Math.min(lowestPrice, item.low || Number.MAX_VALUE);
    });

    // 格式化日期
    const periodFromStr = period1.toISOString().split('T')[0];
    const periodToStr = period2.toISOString().split('T')[0];

    // 返回处理后的结果
    return {
      symbol,
      interval,
      period,
      dateRange: {
        from: periodFromStr,
        to: periodToStr,
      },
      dataPoints: historicalData.length,
      statistics: {
        totalVolume,
        highestPrice,
        lowestPrice,
        priceRange: highestPrice - lowestPrice,
      },
      data: historicalData,
      fetchTime: new Date().toISOString(),
      source: 'Yahoo Finance API',
    };
  } catch (error) {
    console.error(`获取股票${symbol}的历史数据失败:`, error);

    return {
      error: '获取历史数据失败',
      message: error.message,
      symbol,
      interval,
      period,
    };
  }
}

module.exports = {
  description,
  parameters,
  execute,
};
