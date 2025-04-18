/**
 * Twitter推文获取工具
 * 获取指定用户的最新推文
 */
const axios = require('axios');

// 工具描述
const description = '获取指定Twitter(X)用户的最新推文';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      description: 'Twitter用户名(不含@符号)，例如：elonmusk, realDonaldTrump',
    },
    count: {
      type: 'integer',
      description: '要获取的推文数量',
      minimum: 1,
      maximum: 20,
      default: 5,
    },
    includeReplies: {
      type: 'boolean',
      description: '是否包含回复内容',
      default: false,
    },
    includeRetweets: {
      type: 'boolean',
      description: '是否包含转发内容',
      default: true,
    },
  },
  required: ['username'],
};

// API端点配置
const API_ENDPOINTS = [
  'https://api.r2tapi.com/twitter/user-tweets', // 不需要API密钥的第三方API服务
  'https://nitter-scraper-api.onrender.com/tweets', // 备用API
];

/**
 * 执行工具
 * @param {Object} params - 调用参数
 * @param {string} params.username - Twitter用户名
 * @param {number} [params.count=5] - 获取推文数量
 * @param {boolean} [params.includeReplies=false] - 是否包含回复
 * @param {boolean} [params.includeRetweets=true] - 是否包含转发
 * @returns {Promise<Object>} 获取结果
 */
async function execute(params = {}) {
  const { username, count = 5, includeReplies = false, includeRetweets = true } = params;

  if (!username) {
    // 如果没有提供用户名，返回提示信息
    return {
      error: '缺少必要参数',
      message: '请提供Twitter用户名(username)',
      examples: ['elonmusk', 'realDonaldTrump', 'BarackObama', 'BillGates', 'NASA'],
      isExample: true,
    };
  }

  if (count < 1 || count > 20) {
    return {
      error: '参数错误',
      message: 'count参数必须在1-20之间',
      username,
    };
  }

  try {
    // 尝试从每个API端点获取数据，直到成功
    let result = null;
    let error = null;

    for (const endpoint of API_ENDPOINTS) {
      try {
        console.log(`尝试从 ${endpoint} 获取 ${username} 的推文`);

        const response = await axios.get(endpoint, {
          params: {
            username,
            limit: count,
            include_replies: includeReplies,
            include_retweets: includeRetweets,
          },
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: 10000,
        });

        if (response.data) {
          result = response.data;
          break;
        }
      } catch (err) {
        console.error(`API ${endpoint} 获取失败:`, err.message);
        error = err;
      }
    }

    // 如果所有API端点都失败
    if (!result) {
      throw error || new Error('所有API端点都无法获取数据');
    }

    // 处理并返回结果
    const processedResult = processTweets(result, username);

    return {
      username,
      count: processedResult.tweets.length,
      tweets: processedResult.tweets,
      fetchTime: new Date().toISOString(),
      source: processedResult.source || 'Twitter API',
    };
  } catch (error) {
    console.error(`获取 ${username} 推文失败:`, error);

    // 如果API调用失败，返回模拟数据（仅作为备用）
    if (username.toLowerCase() === 'realdonaldtrump') {
      return {
        username,
        count: 3,
        tweets: [
          {
            id: 'simulated1',
            text: 'MAKE AMERICA GREAT AGAIN!',
            created_at: new Date().toISOString(),
            likes: 154000,
            retweets: 32000,
            isSimulated: true,
          },
          {
            id: 'simulated2',
            text: 'THE RADICAL LEFT IS DESTROYING OUR NATION. VOTE! #MAGA',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            likes: 125000,
            retweets: 28000,
            isSimulated: true,
          },
          {
            id: 'simulated3',
            text: 'The economy is booming like never before. Jobs! Jobs! Jobs!',
            created_at: new Date(Date.now() - 172800000).toISOString(),
            likes: 98000,
            retweets: 23000,
            isSimulated: true,
          },
        ],
        fetchTime: new Date().toISOString(),
        source: 'Simulated Data',
        message: '注意：真实API获取失败，返回模拟数据',
        error: error.message,
      };
    } else {
      return {
        error: '获取推文失败',
        message: error.message,
        username,
      };
    }
  }
}

/**
 * 处理不同格式的推文数据
 * @param {Object} data - API返回的原始数据
 * @param {string} username - 用户名
 * @returns {Object} 标准化的推文数据
 */
function processTweets(data, username) {
  // 检测数据格式并标准化
  let tweets = [];
  let source = 'Twitter API';

  if (Array.isArray(data)) {
    // 第一种API格式：直接返回推文数组
    tweets = data.map(tweet => ({
      id: tweet.id || tweet.tweet_id || tweet._id,
      text: tweet.text || tweet.content || tweet.tweet,
      created_at: tweet.created_at || tweet.date || new Date().toISOString(),
      likes: tweet.likes || tweet.favorite_count || 0,
      retweets: tweet.retweets || tweet.retweet_count || 0,
      media: tweet.media || tweet.images || [],
      url: tweet.url || `https://twitter.com/${username}/status/${tweet.id}`,
    }));
    source = 'R2T API';
  } else if (data.tweets && Array.isArray(data.tweets)) {
    // 第二种API格式：具有tweets属性的对象
    tweets = data.tweets.map(tweet => ({
      id: tweet.id || tweet.tweet_id,
      text: tweet.text || tweet.content,
      created_at: tweet.created_at || tweet.date,
      likes: tweet.likes || tweet.favorite_count || 0,
      retweets: tweet.retweets || tweet.retweet_count || 0,
      media: tweet.media || tweet.images || [],
      url: tweet.url || `https://twitter.com/${username}/status/${tweet.id}`,
    }));
    source = 'Nitter API';
  } else if (data.data && Array.isArray(data.data)) {
    // 第三种API格式：具有data属性的对象
    tweets = data.data.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      url: `https://twitter.com/${username}/status/${tweet.id}`,
    }));
    source = 'Twitter Official API';
  }

  return {
    tweets,
    source,
  };
}

module.exports = {
  description,
  parameters,
  execute,
};
