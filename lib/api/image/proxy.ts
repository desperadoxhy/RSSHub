import type { RouteHandler } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';

import { ofetch } from '@/utils/ofetch';

// 常见防盗链网站的 referer 映射
const REFERER_MAP: Record<string, string> = {
    'sspai.com': 'https://sspai.com/',
    'cdnfile.sspai.com': 'https://sspai.com/',
    'cdn.sspai.com': 'https://sspai.com/',
    'jianshu.com': 'https://jianshu.com/',
    'jianshu.io': 'https://jianshu.io/',
    'zhihu.com': 'https://www.zhihu.com/',
    'zhimg.com': 'https://www.zhihu.com/',
    'bilibili.com': 'https://www.bilibili.com/',
    'biliapi.com': 'https://www.bilibili.com/',
    'hdslb.com': 'https://www.bilibili.com/',
    'weibo.com': 'https://weibo.com/',
    'weibo.cn': 'https://weibo.cn/',
    'weibocdn.com': 'https://weibo.com/',
    'sinaimg.cn': 'https://weibo.com/',
    'douban.com': 'https://douban.com/',
    'doubanio.com': 'https://douban.com/',
    'segmentfault.com': 'https://segmentfault.com/',
    'juejin.cn': 'https://juejin.cn/',
    'csdn.net': 'https://csdn.net/',
    'oschina.net': 'https://oschina.net/',
    'infoq.cn': 'https://infoq.cn/',
    'infoq.com': 'https://infoq.com/',
    '36kr.com': 'https://36kr.com/',
    '36krcdn.com': 'https://36kr.com/',
    'tmtpost.com': 'https://tmtpost.com/',
    'geekpark.net': 'https://geekpark.net/',
    'ifanr.com': 'https://ifanr.com/',
    'pingwest.com': 'https://pingwest.com/',
    'huxiu.com': 'https://huxiu.com/',
    'thepaper.cn': 'https://thepaper.cn/',
    'infzm.com': 'https://infzm.com/',
    'guancha.cn': 'https://guancha.cn/',
    'people.com.cn': 'https://people.com.cn/',
    'xinhuanet.com': 'https://xinhuanet.com/',
    'cctv.com': 'https://cctv.com/',
    'ctrip.com': 'https://ctrip.com/',
    'dianping.com': 'https://dianping.com/',
    'meituan.com': 'https://meituan.com/',
    'taobao.com': 'https://taobao.com/',
    'jd.com': 'https://jd.com/',
    'tmall.com': 'https://tmall.com/',
    'xiaohongshu.com': 'https://xiaohongshu.com/',
    'xiaohongshu.com': 'https://xiaohongshu.com/',
    'toutiao.com': 'https://toutiao.com/',
    '163.com': 'https://www.163.com/',
    'qq.com': 'https://qq.com/',
    'sina.com.cn': 'https://sina.com.cn/',
    'sohu.com': 'https://sohu.com/',
    'ifeng.com': 'https://ifeng.com/',
    'smzdm.com': 'https://smzdm.com/',
};

// 根据 URL 的 hostname 获取对应的 referer
function getReferer(imageUrl: string): string {
    try {
        const url = new URL(imageUrl);
        const hostname = url.hostname;

        // 精确匹配
        if (REFERER_MAP[hostname]) {
            return REFERER_MAP[hostname];
        }

        // 域名匹配（例如 cdn.sspai.com 匹配 sspai.com）
        for (const [domain, referer] of Object.entries(REFERER_MAP)) {
            if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                return referer;
            }
        }

        // 默认使用图片 URL 的 origin 作为 referer
        return url.origin;
    } catch {
        return '';
    }
}

const QuerySchema = z.object({
    url: z.string().url().openapi({
        example: 'https://cdnfile.sspai.com/2026/04/30/article/xxx.png',
        description: 'Image URL to proxy',
    }),
});

const route = createRoute({
    method: 'get',
    path: '/image',
    description: 'Proxy image with proper referer to bypass hotlink protection',
    tags: ['Proxy'],
    request: {
        query: QuerySchema,
    },
    responses: {
        200: {
            description: 'Image content',
            content: {
                'image/*': {
                    schema: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        },
        400: {
            description: 'Invalid URL',
        },
        404: {
            description: 'Image not found',
        },
    },
});

const handler: RouteHandler<typeof route> = async (ctx) => {
    const { url: imageUrl } = ctx.req.valid('query');

    const referer = getReferer(imageUrl);

    try {
        const response = await ofetch(imageUrl, {
            headers: {
                Referer: referer,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            responseType: 'arrayBuffer',
        });

        // 设置响应头
        const contentType = response.headers?.get('content-type') || 'image/jpeg';
        ctx.header('Content-Type', contentType);
        ctx.header('Cache-Control', 'public, max-age=31536000');
        ctx.header('X-Referer', referer);

        return ctx.body(response);
    } catch (error: any) {
        return ctx.json({ error: 'Failed to fetch image', message: error?.message || 'Unknown error' }, 404);
    }
};

export { handler, route };
