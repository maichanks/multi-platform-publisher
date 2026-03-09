# 平台集成实施计划

**文档签名**: maichanks <hankan1993@gmail.com>

## 总体概览

支持平台分为三类：

| 类别 | 平台 | 集成方式 | 难度 |
|------|------|----------|------|
| API类 | Twitter, Reddit, LinkedIn, YouTube | 官方API | 低-中 |
| 浏览器自动化类 | 小红书, 抖音 | Puppeteer + MCP | 高 |
| 扩展考虑 | Facebook, Instagram, TikTok, Weibo | API/浏览器 | 中-高 |

**Phase 1 优先实现**:
1. Twitter (API简单，用户量大)
2. Reddit (API简单，测试流程)
3. LinkedIn (API规范，企业用户)
4. 小红书 (中国用户刚需)
5. 抖音 (中国用户刚需)
6. YouTube (视频重点)

**Phase 2 (v1.5+)**:
- Facebook, Instagram (需要Business Account)
- TikTok (API限制严格)
- Weibo (API可选，浏览器备选)

## 统一抽象层设计

所有平台实现相同的接口:

```typescript
// src/platforms/platform.interface.ts
export interface IPlatformAdapter {
  readonly platform: SocialPlatform;
  
  // 认证
  connect(options: ConnectOptions): Promise<ConnectResult>;
  verifyConnection(accountId: string): Promise<VerificationResult>;
  disconnect(accountId: string): Promise<void>;
  refreshToken(accountId: string): Promise<void>;
  
  // 内容发布
  publish(accountId: string, content: PlatformContent, options?: PublishOptions): Promise<PublishResult>;
  uploadMedia(accountId: string, media: MediaFile[]): Promise<MediaUploadResult[]>;
  
  // 查询
  getAccountInfo(accountId: string): Promise<AccountInfo>;
  getRateLimits(accountId: string): Promise<RateLimitInfo>;
  
  // 合规检查（平台特定规则）
  validateContent(content: PlatformContent): Promise<ValidationResult[]>;
  
  // 删除内容
  deletePost(accountId: string, platformPostId: string): Promise<void>;
}

export interface PlatformContent {
  text: string;           // 适配后的正文
  media: MediaAttachment[]; // 媒体文件
  hashtags: string[];     // 标签
  mentionUsers?: string[]; // @提及
  location?: Location;    // 地理位置
  visibility?: 'public' | 'private' | 'friends';
}
```

**好处**:
- 主发布引擎调用统一接口，平台无关
- 新增平台只需实现接口，无需改动核心逻辑
- 易于Mock测试和模拟模式

---

## 平台详细实现

### 1. Twitter / X

| 项目 | 详情 |
|------|------|
| API | Twitter API v2 (OAuth 2.0 PKCE) |
| 文档 | https://developer.twitter.com/en/docs/twitter-api |
| 配额 | 1500 posts/15分钟（Basic tier $100/月） |
| 支持内容 | 文字（280字符）、图片（≤5MB）、视频（≤512MB） |
| 特殊功能 | 投票、话题标签、提及、地理位置 |

#### 认证流程

1. **应用注册**: 创建Twitter Developer Project，设置OAuth 2.0 callback URL
2. **PKCE流**:
   - 生成`code_verifier` (43-128 chars)
   - 计算`code_challenge` = BASE64URL(SHA256(code_verifier))
   - 重定向用户到 `https://twitter.com/i/oauth2/authorize?...&code_challenge=...`
   - 用户授权后回调到前端，获取`code`和`state`
   - 后端用`code` + `code_verifier` 交换 `access_token` + `refresh_token`
3. **令牌存储**: `SocialAccount`表的加密字段存储

**NestJS服务端实现**:

```typescript
// twitter.adapter.ts
@Injectable()
export class TwitterAdapter implements IPlatformAdapter {
  constructor(private readonly http: HttpService, private readonly crypto: CryptoService) {}
  
  async connect(options: ConnectOptions): Promise<ConnectResult> {
    const codeVerifier = this.crypto.generateCodeVerifier();
    const codeChallenge = await this.crypto.hashCodeChallenge(codeVerifier);
    
    const state = crypto.randomUUID();
    // 缓存codeVerifier + state到Redis，有效期10分钟
    await this.redis.setex(`twitter:connect:${state}`, 600, codeVerifier);
    
    const authUrl = `https://twitter.com/i/oauth2/authorize?client_id=${options.clientId}&redirect_uri=${options.redirectUri}&scope=tweet.write+users.read+offline.access&response_type=code&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    
    return { authUrl, expiresIn: 600 };
  }
  
  async verifyConnection(data: VerifyData): Promise<VerificationResult> {
    // 从Redis取codeVerifier
    const codeVerifier = await this.redis.get(`twitter:connect:${data.state}`);
    if (!codeVerifier) throw new Error('Session expired');
    
    // 交换令牌
    const tokenResponse = await this.http.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
      client_id: process.env.OAUTH_TWITTER_CLIENT_ID!,
      grant_type: 'authorization_code',
      code: data.code,
      redirect_uri: process.env.OAUTH_REDIRECT_URI!,
      code_verifier: codeVerifier,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).toPromise();
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // 加密存储到DB
    await this.socialAccountRepo.create({
      platform: 'twitter',
      accessTokenEncrypted: await this.crypto.encrypt(access_token),
      refreshTokenEncrypted: refresh_token ? await this.crypto.encrypt(refresh_token) : null,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      status: 'connected',
    });
    
    return { success: true };
  }
  
  async publish(accountId: string, content: PlatformContent): Promise<PublishResult> {
    const account = await this.socialAccountRepo.findById(accountId);
    const accessToken = await this.crypto.decrypt(account.accessTokenEncrypted);
    
    // 媒体上传（如有）
    let mediaIds: string[] = [];
    if (content.media.length > 0) {
      mediaIds = await this.uploadMedia(accountId, content.media);
    }
    
    // 构建推文JSON
    const tweet: any = {
      text: this.truncateText(content.text, 280),  // Twitter字符限制（媒体占23字符）
    };
    
    if (mediaIds.length > 0) {
      tweet.media = { media_ids: mediaIds };
    }
    
    if (content.hashtags.length > 0) {
      // hashtags已经在text中，无需单独字段
    }
    
    // 发布请求
    const response = await this.http.post('https://api.twitter.com/2/tweets', tweet, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).toPromise();
    
    const tweetData = response.data.data;
    
    return {
      platformPostId: tweetData.id,
      postUrl: `https://twitter.com/user/status/${tweetData.id}`,
      publishedAt: new Date(tweetData.created_at),
    };
  }
  
  async uploadMedia(accountId: string, media: MediaAttachment[]): Promise<string[]> {
    const account = await this.socialAccountRepo.findById(accountId);
    const accessToken = await this.crypto.decrypt(account.accessTokenEncrypted);
    
    const mediaIds: string[] = [];
    
    for (const file of media) {
      // 1. 初始化上传 (INIT)
      const initRes = await this.http.post(
        'https://upload.twitter.com/1.1/media/upload.json',
        new URLSearchParams({
          command: 'INIT',
          'total_bytes': file.size.toString(),
          'media_type': file.type,  // image/jpeg, video/mp4
        }).toString(),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).toPromise();
      
      const mediaId = initRes.data.media_id_string;
      
      // 2. 分块上传APPEND（大文件）
      const chunkSize = 5 * 1024 * 1024; // 5MB
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        const chunk = file.buffer.slice(offset, offset + chunkSize);
        await this.http.post(
          'https://upload.twitter.com/1.1/media/upload.json',
          new FormData()
            .append('command', 'APPEND')
            .append('media_id', mediaId)
            .append('segment_index', Math.floor(offset / chunkSize).toString())
            .append('media', chunk, { filename: file.filename, contentType: file.type }),
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).toPromise();
      }
      
      // 3. 完成上传FINALIZE
      await this.http.post(
        'https://upload.twitter.com/1.1/media/upload.json',
        new URLSearchParams({
          command: 'FINALIZE',
          media_id: mediaId,
        }).toString(),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).toPromise();
      
      mediaIds.push(mediaId);
    }
    
    return mediaIds;
  }
  
  async getRateLimits(accountId: string): Promise<RateLimitInfo> {
    // Twitter API v2 不直接返回剩余配额，需根据响应头计算
    // 或者调用GET /2/application/rate_limit_status (部分endpoint)
    return {
      remaining: 1500, // 需从实际发布后响应头X-Rate-Limit-Remaining更新
      resetAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟窗口
    };
  }
}
```

#### 速率限制处理

**策略**:
- 每发布一次，读取响应头`x-rate-limit-remaining`更新`SocialAccount.rateLimitRemaining`
- 剩余配额<100时告警
- 达到限制时，Bull队列自动延迟 (`delayUntil` = 重置时间)
- 指数退避重试: `maxAttempts=3, backoff=exponential`

#### 错误处理

| 错误码 | 含义 | 处理 |
|--------|------|------|
| 429 | 频率限制 | 等待`x-rate-limit-reset`后重试 |
| 403 | 账户封禁/权限不足 | 标记`SocialAccount.status = 'error'`，通知人工 |
| 401 | 令牌失效 | 调用`refreshToken`自动刷新 |
| 413 | 媒体过大 | 压缩媒体或拒绝发布 |
| 422 | 内容违规（敏感词） | 触发合规扫描 |

#### 预估工作量: **3天**

- Day1: OAuth2 PKCE认证 + 令牌存储
- Day2: 发布 + 媒体上传（分块）
- Day3: 错误处理 + 限流 + 测试

---

### 2. Reddit

| 项目 | 详情 |
|------|------|
| API | Reddit API (OAuth2 script) |
| 文档 | https://www.reddit.com/dev/api |
| 配额 | 60 requests/minute (JSON responses), 无每日上限 |
| 支持内容 | 文本（40000字符）、图片（Reddit-hosted or Imgur）、链接 |
| 特殊功能 | Subreddit规则、 flair、投票、NSFW标记 |

#### 认证流程

**脚本应用模式** (适合Bot发布):

1. 在Reddit创建App，类型为"script"
2. 使用`username` + `password` + `client_id` + `client_secret` 获取OAuth2 token
3. Token有效期2小时，需定期刷新

**NestJS实现**:

```typescript
// reddit.adapter.ts
async connect(options: ConnectOptions): Promise<ConnectResult> {
  // Reddit script模式需要用户名密码（应用专用账号）
  const token = await this.http.post('https://www.reddit.com/api/v1/access_token', 
    new URLSearchParams({
      grant_type: 'password',
      username: options.username,
      password: options.password,
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${options.clientId}:${options.clientSecret}`),
      },
    }
  ).toPromise();
  
  const { access_token, expires_in } = tokenResponse.data;
  
  await this.socialAccountRepo.create({
    platform: 'reddit',
    platformUsername: options.username,
    accessTokenEncrypted: await this.crypto.encrypt(access_token),
    tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
    status: 'connected',
  });
  
  return { success: true };
}
```

#### 发布内容

Reddit API [`/api/submit`](https://www.reddit.com/dev/api#POST_api_submit):

```typescript
async publish(accountId: string, content: PlatformContent): Promise<PublishResult> {
  const account = await this.socialAccountRepo.findById(accountId);
  const accessToken = await this.crypto.decrypt(account.accessTokenEncrypted);
  
  // 获取目标Subreddit（从content.tags[0]或metadata）
  const subreddit = content.tags[0] || 'test'; // 必须指定subreddit
  
  const params = new URLSearchParams({
    api_type: 'json',  // JSON响应
    kind: 'self',      // text post（或'link'）
    title: this.truncateText(content.text, 300),  // Reddit标题最长300字符
    text: content.text,  // 正文（超过文本阈值则提示）
    subreddit: subreddit,
  });
  
  // 如果有图片，需先上传到imgur或reddit gallery
  if (content.media.length > 0) {
    // Reddit图片发布流程：
    // 1. 上传到Reddit媒体代理（/api/media/asset）或Imgur
    // 2. 提交kind='image'的post，包含media_id
  }
  
  const response = await this.http.post(
    'https://oauth.reddit.com/api/submit',
    params.toString(),
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  ).toPromise();
  
  const postData = response.data.json.data;
  
  return {
    platformPostId: postData.id,
    postUrl: `https://reddit.com${postData.permalink}`,
    publishedAt: new Date(postData.created_utc * 1000),
  };
}
```

#### Subreddit规则处理

每个subreddit有自定义规则（sidebar）：

- **自动检查**: 发布前调用`/r/{subreddit}/about/rules`获取规则
- **禁用词过滤**: 检查标题/正文是否包含subreddit的banned words
- **Flair要求**: 某些subreddit强制选择flair标签，需预处理

```typescript
async validateContent(content: PlatformContent, subreddit: string): Promise<ValidationResult[]> {
  const rules = await this.fetchSubredditRules(subreddit);
  const violations: ValidationResult[] = [];
  
  // 检查标题长度
  if (content.text.length > 300) {
    violations.push({
      rule: 'title_length',
      message: `标题超过300字符限制（当前${content.text.length}）`,
      severity: 'error',
    });
  }
  
  // 检查禁用词
  const bannedWords = rules.bannedWords || [];
  for (const word of bannedWords) {
    if (content.text.includes(word)) {
      violations.push({
        rule: 'banned_word',
        message: `内容包含禁用词: ${word}`,
        severity: 'error',
      });
    }
  }
  
  return violations;
}
```

#### 错误处理

| 错误 | 处理 |
|------|------|
| 403 FORBIDDEN | Subreddit禁止用户发帖，标记`SocialAccount.status = 'error'` |
| 429 TOO_MANY_REQUESTS | 60次/分钟限制，Bull队列延迟 |
| 400 BAD_REQUEST | 内容违规（NSFW等），记录失败原因 |

#### 预估工作量: **2天**

- Day1: OAuth2 script认证 + 令牌刷新
- Day2: 发布 + Subreddit规则处理 + 测试

---

### 3. LinkedIn

| 项目 | 详情 |
|------|------|
| API | LinkedIn Marketing Developer Platform (v2) |
| 文档 | https://learn.microsoft.com/en-us/linkedin/marketing/ |
| 配额 | 100 posts/day per member, 1000 requests/day per app |
| 支持内容 | 文字、单图（≤5MB）、多图（≤9张）、视频（≤5GB，专业版）、文章链接 |
| 特殊功能 | Hashtag、提及、职业内容优化 |

#### 认证流程

LinkedIn使用标准OAuth 2.0 Authorization Code Flow:

1. 注册LinkedIn App，设置OAuth 2.0 redirect URL
2. 请求权限: `r_liteprofile`, `w_member_social`
3. 授权后获取`code`，交换`access_token`
4. Token有效期60天，需刷新

**注意**: LinkedIn审核严格，需提交用例说明。个人账号开发受限，建议申请Marketing Developer Platform访问（需企业资质）。

#### 发布内容

API端点: `POST /ugcPosts` (用户生成内容) 或 `POST /shares` (简单分享)

**支持多种格式**:
- `urn:li:share:` - 简单文本分享
- `urn:li:article:` - 文章链接分享
- `urn:li:image:` + `urn:li:video:` - 媒体内容

```typescript
async publish(accountId: string, content: PlatformContent): Promise<PublishResult> {
  const account = await this.socialAccountRepo.findById(accountId);
  const accessToken = await this.crypto.decrypt(account.accessTokenEncrypted);
  
  // 1. 获取用户profile URN (如urn:li:person:xxx)
  const profileRes = await this.http.get('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).toPromise();
  const authorUrn = `urn:li:person:${profileRes.data.id}`;
  
  // 2. 上传媒体（如有）
  let imageUrn: string | undefined;
  if (content.media.length > 0 && content.media[0].type === 'image') {
    imageUrn = await this.uploadImage(accountId, content.media[0]);
  }
  
  // 3. 创建post
  const post: any = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: this.truncateText(content.text, 3000) }, // LinkedIn允许3000字符
        shareMediaCategory: imageUrn ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  
  if (imageUrn) {
    post.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      description: { text: content.summary || '' },
      media: imageUrn,
    }];
  }
  
  // 4. 添加话题标签（需格式化为话题链接）
  if (content.hashtags.length > 0) {
    post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text += 
      '\n\n' + content.hashtags.map(tag => `#${tag}`).join(' ');
  }
  
  const response = await this.http.post('https://api.linkedin.com/rest/ugcPosts', post, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  }).toPromise();
  
  return {
    platformPostId: response.data.id,
    postUrl: `https://www.linkedin.com/feed/update/${response.data.id}/`,
    publishedAt: new Date(),
  };
}
```

#### 媒体上传流程

LinkedIn的图片上传多步骤:

1. `POST /assets?action=registerUpload` 获取上传URL
2. `PUT` 二进制数据到返回的uploadUrl (需Content-Type: multipart/form-data)
3. 返回`asset` URN（如`urn:li:image:xxx`）
4. 发布post引用该URN

**视频上传**需分块，更复杂。

#### 错误处理

| 错误 | 处理 |
|------|------|
| 403 | 用户未授权`w_member_social`范围，需重新授权 |
| 429 | 配额耗尽，告警并升级套餐 |
| 400 | 内容不符合LinkedIn政策（过度营销），记录失败 |
| 401 | 令牌过期，刷新失败则标记账号状态 |

#### 预估工作量: **3天**

- Day1: OAuth2 认证 + 用户profile获取
- Day2: 文字发布 + 图片上传
- Day3: 错误处理 + 配额管理 + 测试

---

### 4. YouTube

| 项目 | 详情 |
|------|------|
| API | YouTube Data API v3 |
| 文档 | https://developers.google.com/youtube/v3 |
| 配额 | 10,000 units/day（默认），可申请增加 |
| 成本 | API调用计费，upload视频消耗1600 units |
| 支持内容 | 视频（≤256GB，≤12小时）、标题、描述、标签、缩略图 |
| 特殊功能 | 播放列表、隐私设置（public/unlisted/private）、年龄限制、 monetization |

#### 认证流程

Google OAuth 2.0 (与YouTube Data API scope):

- 范围: `https://www.googleapis.com/auth/youtube.upload`, `youtube.force-ssl`
- 流程: Authorization Code Flow

#### 视频上传（异步长耗时）

YouTube视频上传耗时较长（分钟~小时级），需使用**异步任务**。

**上传步骤**:

1. **初始化上传**: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable`
   - 返回`Location`头（上传URI）
   - 消耗1600 units（无论视频大小）

2. **分块上传**: `PUT` 到`Location` URI，支持断点续传
   - chunk size: 256KB - 几十MB（建议8MB）
   - 每次上传后服务器返回进度

3. **设置元数据**: 同时发送视频标题、描述、标签、隐私状态

```typescript
async uploadVideo(accountId: string, file: MediaAttachment, metadata: VideoMetadata): Promise<string> {
  const account = await this.socialAccountRepo.findById(accountId);
  const accessToken = await this.crypto.decrypt(account.accessTokenEncrypted);
  
  // 1. Initialize resumable upload
  const initRes = await this.http.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable',
    {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
      },
      status: {
        privacyStatus: metadata.privacy || 'private',
        selfDeclaredMadeForKids: false,
      },
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': file.size.toString(),
        'X-Upload-Content-Type': file.type,
      },
    }
  ).toPromise();
  
  const uploadUrl = initRes.headers.location;
  if (!uploadUrl) throw new Error('Failed to get upload URL');
  
  // 2. 分块上传
  const chunkSize = 8 * 1024 * 1024; // 8MB
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.buffer.slice(offset, offset + chunkSize);
    const end = Math.min(offset + chunkSize - 1, file.size - 1);
    
    await this.http.put(uploadUrl, chunk, {
      headers: {
        'Content-Range': `bytes ${offset}-${end}/${file.size}`,
        'Content-Length': (end - offset + 1).toString(),
      },
    }).toPromise();
    
    offset = end + 1;
  }
  
  // 3. 上传完成，响应包含videoId
  // Google返回200 OK + video resource JSON
  // 需要解析响应体获取videoId
  // (实际代码需处理各种状态码和重试)
  
  return videoId; // 如 "dQw4w9WgXcQ"
}
```

#### 配额管理

YouTube API配额消耗（每日10k units）:

| API调用 | Units | 频率 |
|---------|-------|------|
| videos.insert (upload) | 1600 | 每视频 |
| videos.list (metadata) | 1-3 | 读取 |
| search.list | 100 | 搜索 |
| captions.insert | 50 | 字幕 |

**降级策略**:

- 检测剩余配额: `POST https://www.googleapis.com/youtube/v3/activities?part=id` 消耗1 unit看是否配额不足
- 配额不足时，切换到`private`隐私（不公开）或队列等待次日
- 优先上传高质量视频（用户指定优先级）

#### 发布后流程

1. **设置缩略图** (可选): `POST /thumbnails/set` (消耗50 units)
2. **添加到播放列表** (可选)
3. **等待视频处理**: 上传完成→YouTube转码→需额外时间（几分钟到几小时）
   - API轮询`videos.list(part=processingDetails)`检查`processingStatus`
   - 一旦`status = 'processed'`，才可标记发布成功

#### 错误处理

| 错误 | 处理 |
|------|------|
| 403 (quotaExceeded) | 配额耗尽，等待次日或升级Google Cloud配额 |
| 400 (invalidVideo) | 视频格式不支持（需MP4/H.264），拒绝并通知 |
| 500/503 | YouTube服务不可用，指数退避重试 |
| 401 | OAuth令牌失效，刷新 |

#### 预估工作量: **5天**

- Day1: OAuth2 + 配额监控
- Day2-3: 分块上传实现、断点续传
- Day4: 元数据、缩略图、播放列表
- Day5: 处理状态轮询、错误处理、测试

---

### 5. 小红书 (Xiaohongshu)

| 项目 | 详情 |
|------|------|
| API | 无公开API，必须浏览器自动化（MCP） |
| 文档 | 无官方文档，需逆向分析Web端 |
| 登录方式 | 微信扫码 + 短信验证（可能） |
| 支持内容 | 图片（9:16竖图，≤9张）、短视频（15秒）、文字（1000字） |
| 特殊限制 | 高强度反爬虫、频繁验证码、账号限流 |
| 特殊处理 | Stealth mode、IP轮换、行为模拟 |

#### 架构选择

使用 **Puppeteer + MCP (Multi-agent Control Protocol)** 模拟真人操作:

- **为什么不用官方API?** 小红书未开放内容发布API，企业对接需商务合作
- **MCP vs 直接Puppeteer**: MCP是浏览器控制协议，通过WebSocket连接浏览器实例，适合分布式和集群

**部署方式**:
- 单服务器运行多个无头Chrome实例（每账号1个）
- 使用`puppeteer-cluster`管理浏览器池
- 通过独立服务`xhs-mcp-server`暴露WebSocket端口，供后端调用

#### 认证流程 (扫码登录)

1. 后端启动Puppeteer访问小红书Web登录页 (`https://www.xiaohongshu.com/login`)
2. 等待二维码显示，获取二维码URL
3. 后端返回`qr_code_url`给前端，显示二维码
4. 用户扫码（微信）后，Puppeteer监听`localStorage`或Cookie变化检测登录
5. 登录成功，提取`session_token`或cookies，加密存储到`SocialAccount.sessionData`

```typescript
async connect(options: ConnectOptions): Promise<ConnectResult> {
  // 1. 启动浏览器（无头模式 + stealth）
  const browser = await this.launchBrowser();
  const page = await browser.newPage();
  
  await page.goto('https://www.xiaohongshu.com/login', { waitUntil: 'networkidle2' });
  
  // 2. 等待二维码出现
  await page.waitForSelector('.qr-code img', { timeout: 30000 });
  const qrCodeUrl = await page.$eval('.qr-code img', img => img.src);
  
  // 3. 缓存session用于后续验证
  const sessionId = crypto.randomUUID();
  await this.redis.setex(`xhs:session:${sessionId}`, 300, JSON.stringify({ browserId: browser.id() }));
  
  // 4. 异步等待用户扫码登录（轮询会话状态）
  this.checkLoginStatus(browser, sessionId); // 后台任务
  
  return { 
    success: true, 
    qrCodeUrl, 
    sessionToken: sessionId, 
    expiresIn: 300 
  };
}

async checkLoginStatus(browser: Browser, sessionId: string): Promise<void> {
  const page = (await browser.pages())[0];
  
  // 轮询检测登录状态
  for (let i = 0; i < 60; i++) {
    const loggedIn = await page.evaluate(() => {
      // 通过页面元素或localStorage判断登录状态
      return !!document.querySelector('.user-avatar') || localStorage.getItem('XHS-SESSION');
    });
    
    if (loggedIn) {
      // 提取cookies和localStorage
      const cookies = await page.cookies();
      const localStorageData = await page.evaluate(() => {
        const data: Record<string,string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) data[key] = localStorage.getItem(key) || '';
        }
        return data;
      });
      
      // 加密存储到DB
      await this.socialAccountRepo.create({
        platform: 'xiaohongshu',
        sessionData: { cookies, localStorage: localStorageData },
        status: 'connected',
      });
      
      await browser.close();
      return;
    }
    
    await delay(5000);
  }
  
  await browser.close();
  throw new Error('Login timeout');
}
```

#### 发布流程

小红书Web发布页: `https://www.xiaohongshu.com/publish`

步骤:

1. 导航到发布页
2. 上传图片（拖拽或点击上传）
3. 填写标题（≤30字符）、正文（≤1000字）
4. 选择标签（最多10个）、话题
5. 点击发布

```typescript
async publish(accountId: string, content: PlatformContent): Promise<PublishResult> {
  const account = await this.socialAccountRepo.findById(accountId);
  const sessionData = account.sessionData as SessionData;
  
  // 1. 启动浏览器并恢复会话（cookies + localStorage）
  const browser = await this.launchBrowser();
  const page = await browser.newPage();
  
  // 注入cookies
  await page.setCookie(...sessionData.cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
  })));
  
  // 恢复localStorage
  await page.evaluate((ls) => {
    for (const [key, value] of Object.entries(ls)) {
      localStorage.setItem(key, value);
    }
  }, sessionData.localStorage);
  
  // 2. 访问发布页
  await page.goto('https://www.xiaohongshu.com/publish', { waitUntil: 'networkidle2' });
  
  // 3. 上传图片（处理文件输入）
  for (const media of content.media) {
    const input = await page.waitForSelector('input[type="file"]');
    await input.uploadFile(media.path); // 需提前下载到本地
  }
  
  // 4. 填写标题和正文
  await page.type('.title-input', this.truncateText(content.text, 30));
  await page.type('.content-textarea', content.text);
  
  // 5. 添加标签
  for (const tag of content.hashtags) {
    await page.click('.tag-add-button');
    await page.type('.tag-input', tag);
    await page.keyboard.press('Enter');
  }
  
  // 6. 点击发布按钮
  await page.click('.publish-button');
  
  // 7. 等待发布成功提示
  await page.waitForSelector('.success-message', { timeout: 60000 });
  
  // 8. 提取发布后URL
  const postUrl = await page.url(); // 或从页面元素获取
  
  await browser.close();
  
  return { platformPostId: extractId(postUrl), postUrl, publishedAt: new Date() };
}
```

#### 反检测与风险控制

**Stealth插件配置**:

```typescript
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // 可选，性能更好但稳定性降低
  ],
});
await use(StealthPlugin());
```

**行为模拟**:

- 鼠标移动轨迹：贝塞尔曲线，随机抖动
- 点击间隔：100-300ms随机延迟
- 页面滚动：逐步滚动，非直接跳转

**IP轮换策略**:

- 为每个账号分配独立代理（ residential proxies recommended）
- 失败重试时切换IP
- 相同IP每日发布上限5条，超过即封禁风险高

```typescript
async launchBrowser(proxy?: string) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ];
  
  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }
  
  return await puppeteer.launch({ headless: 'new', args });
}
```

#### 验证码处理

小红书频繁触发验证码:

- **自动识别**: 接入第三方打码平台（2Captcha, CapMonster）
- **手动干预**: 验证失败时暂停队列，通知人工扫码/输入
- **预防**: 模拟人类行为减少触发

```typescript
async handleCaptcha(page: Page): Promise<boolean> {
  const captchaElement = await page.$('.captcha-image');
  if (!captchaElement) return true;
  
  // 截取验证码图片
  const buffer = await captchaElement.screenshot();
  
  // 调用打码服务
  const captchaText = await this.captchaSolver.solve(buffer);
  
  // 输入并提交
  await page.type('.captcha-input', captchaText);
  await page.click('.captcha-submit');
  
  // 验证是否通过
  await page.waitForTimeout(3000);
  return !await page.$('.captcha-image'); // 验证码消失
}
```

#### 预估工作量: **10天**

- Day1-2: 登录流程（扫码 + Cookies/Storage恢复）
- Day3-4: 发布流程自动化（图片上传、表单填写）
- Day5: Stealth配置、行为模拟
- Day6-7: 验证码处理、错误重试
- Day8-9: 多账号隔离、代理池集成
- Day10: 端到端测试、稳定性调优

---

### 6. 抖音 (Douyin)

| 项目 | 详情 |
|------|------|
| API | 无公开API（除企业开放平台，要求高） |
| 登录方式 | 手机号 + 验证码 / 扫码（抖音火山版） |
| 支持内容 | 视频（9:16，≤15分钟 或 移动端限制更严）、图片、文字 |
| 特殊限制 | 移动端优先（Web功能有限）、设备指纹、风控严格 |
| 特殊处理 | Mobile emulation、地理位置模拟、设备信息随机化 |

#### 架构差异

抖音Web版功能受限，**必须模拟移动端**:

- 使用`puppeteer`的`{isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)...'}`
- 视口设置：`{width: 390, height: 844, deviceScaleFactor: 3}` (iPhone 14 Pro)
- 启用`touch`事件

```typescript
async launchDouyinBrowser(proxy?: string): Promise<Browser> {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ];
  
  if (proxy) args.push(`--proxy-server=${proxy}`);
  
  return await puppeteer.launch({
    headless: 'new',
    args,
    defaultViewport: {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
}
```

#### 登录流程

抖音Web登录 (`https://www.douyin.com/login`):

1. 选择"扫码登录"（显示二维码）
2. 用户打开抖音App扫码授权
3. Web端检测登录状态

**注意**: 抖音扫码登录需要账号已绑定手机号，新注册账号可能受限。

```typescript
async connectDouyin(options: ConnectOptions): Promise<ConnectResult> {
  const browser = await this.launchDouyinBrowser();
  const page = await browser.newPage();
  
  await page.goto('https://www.douyin.com/login', { waitUntil: 'networkidle2' });
  
  // 等待二维码出现
  await page.waitForSelector('.qrcode-img', { timeout: 30000 });
  const qrCodeUrl = await page.$eval('.qrcode-img', img => img.src);
  
  // 轮询登录状态
  const sessionId = crypto.randomUUID();
  await this.redis.setex(`douyin:session:${sessionId}`, 300, browser.id());
  
  // 后台任务检测登录
  this.checkDouyinLogin(page, sessionId);
  
  return { qrCodeUrl, sessionToken: sessionId, expiresIn: 300 };
}
```

#### 视频发布流程

抖音Web发布 (`https://www.douyin.com/upload`):

1. 点击上传按钮，选择视频文件（本地路径）
2. 预览编辑器（可裁剪、加滤镜、加音乐）
3. 填写描述（≤500字符）、添加话题（#...）
4. 选择封面、设置可见性（公开/私密）
5. 点击"发布"

**挑战**: Web版编辑器是React SPA，需模拟复杂交互（拖拽、进度条、选择音乐）。

```typescript
async publishDouyin(accountId: string, content: PlatformContent): Promise<PublishResult> {
  const account = await this.socialAccountRepo.findById(accountId);
  const sessionData = account.sessionData;
  
  const browser = await this.launchDouyinBrowser();
  const page = await browser.newPage();
  
  // 恢复会话
  await page.setCookie(...sessionData.cookies);
  
  await page.goto('https://www.douyin.com/upload', { waitUntil: 'networkidle2' });
  
  // 上传视频文件
  const videoInput = await page.waitForSelector('input[type="file"][accept*="video"]');
  await videoInput.uploadFile(content.media[0].path);
  
  // 等待视频处理完成（进度条消失）
  await page.waitForFunction(() => !document.querySelector('.upload-progress'), { timeout: 300000 });
  
  // 填写描述
  await page.click('.description-editor');
  await page.type('.description-editor', content.text);
  
  // 添加话题
  for (const tag of content.hashtags) {
    await page.type('.topic-input', `#${tag}`);
    await page.keyboard.press('Enter');
  }
  
  // 发布按钮
  await page.click('.publish-button');
  
  // 等待成功
  await page.waitForSelector('.publish-success', { timeout: 60000 });
  
  const postUrl = await page.url();
  await browser.close();
  
  return { platformPostId: extractId(postUrl), postUrl, publishedAt: new Date() };
}
```

#### 风控规避

抖音风控极严，需注意:

- **设备指纹**: 每账号固定设备（同一浏览器实例长期使用）
- **行为频率**: 单账号每日发布≤3条，间隔>6小时
- **IP地址**: 必须为中国大陆IP（境外无法访问），需 residential proxy
- **视频去重**: 同一视频多次发布易被识别
- **音频版权**: 背景音乐需使用抖音曲库，未授权音乐可能下架

#### 预估工作量: **10天**

- Day1-2: 移动端模拟 + 扫码登录
- Day3-5: 视频上传流程自动化（编辑器交互复杂）
- Day6: 风控规避（IP代理、行为模拟）
- Day7-8: 错误处理、重试机制
- Day9-10: 稳定性测试、多账号管理

---

## 跨平台通用特性

### 媒体处理管道

多种媒体格式需统一处理:

```typescript
// 预处理流程
async processMedia(original: MediaFile): Promise<ProcessedMedia[]> {
  // 1. 格式转换
  // - 小红书: JPEG/PNG (9:16), MP4 (H.264, 9:16)
  // - TikTok: 相同
  // - Twitter: JPEG/PNG/MP4 (landscape allowed)
  
  // 2. 压缩
  // 图片 ≤5MB (jpeg quality 85)
  // 视频 ≤512MB (H.264 1080p)
  
  // 3. 缩略图生成（视频）
  // FFmpeg: ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 thumb.jpg
  
  // 4. 水印去除（如需要）
  // 小红书/抖音需去除平台水印（使用puppeteer截屏时可能带水印）
  
  return processed;
}
```

使用`fluent-ffmpeg`库进行视频处理。

### 统一错误处理与重试

所有适配器实现相同的错误语义:

```typescript
class PublishError extends Error {
  constructor(
    public platform: SocialPlatform,
    public code: string,
    public message: string,
    public retryable: boolean = true,
    public retryAfter?: number, // 秒
  ) {
    super(message);
  }
}

// Bull作业处理
@Process('publish-job', { concurrency: 10 })
async handlePublish(job: Job<PublishJobData>) {
  try {
    const adapter = this.adapterFactory.get(job.data.platform);
    const result = await adapter.publish(job.data.accountId, job.data.content);
    
    await this.publishJobRepo.update(job.id, {
      status: 'completed',
      result,
      completedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof PublishError && error.retryable) {
      // Bull自动重试（配置maxAttempts）
      throw error;
    } else {
      // 不可重试错误（认证失败、内容违规）
      await this.publishJobRepo.update(job.id, {
        status: 'failed',
        result: { success: false, error: error.message },
        completedAt: new Date(),
      });
      
      await this.notifyFailure(job.data);
    }
  }
}
```

### 立即可用的适配器实现

基于开源库加速开发:

- Twitter: `twitter-api-v2` npm包
- Reddit: `snoowrap` npm包（Reddit API wrapper）
- LinkedIn: `linkedin-v2` npm包（社区版）
- YouTube: `googleapis` npm包（官方）
- 小红书/抖音: 无现成库，需自行实现Puppeteer

---

## 开发与测试策略

### Mock模式

所有适配器实现`MockAdapter`，用于开发和CI/CD:

```typescript
class MockAdapter implements IPlatformAdapter {
  platform = 'twitter' as SocialPlatform;
  
  async publish(): Promise<PublishResult> {
    await delay(1000); // 模拟网络延迟
    return {
      platformPostId: `mock_${crypto.randomUUID()}`,
      postUrl: `https://mock.twitter.com/status/123`,
      publishedAt: new Date(),
    };
  }
  
  // 其他方法返回模拟数据...
}
```

### 集成测试

针对真实平台（使用测试账号）:

```typescript
describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter;
  
  beforeAll(async () => {
    // 使用测试账号连接（Test environment）
    adapter = new TwitterAdapter();
    await adapter.connect({
      clientId: process.env.OAUTH_TWITTER_CLIENT_ID!,
      redirectUri: 'http://localhost:5173/oauth/callback',
    });
  });
  
  it('should publish a tweet', async () => {
    const result = await adapter.publish(testAccountId, {
      text: 'Hello from test!',
      media: [],
      hashtags: [],
    });
    
    expect(result.platformPostId).toBeDefined();
    expect(result.postUrl).toContain('twitter.com');
  });
});
```

**注意**: 测试账号需提前申请，避免污染真实数据。

---

## 优先级路线图

| 周次 | 平台 | 状态 |
|------|------|------|
| Week 3 | Twitter, Reddit, LinkedIn | ✅ Phase 1 - API类（简单） |
| Week 4 | 小红书 | 🔧 Phase 1 - 浏览器自动化 |
| Week 5 | 抖音 | 🔧 Phase 1 - 浏览器自动化 |
| Week 5 | YouTube | 🔄 Phase 1 - API但复杂（视频上传） |
| Week 7 | 浏览器自动化框架抽象 | 📦 将小红书/抖音通用逻辑抽取为BaseBrowserAdapter |
| Week 8 | 小红书多账号池优化 | 🚀 支持并发登录 |
| Week 9 | Facebook, Instagram | 🔜 Phase 2 取决于需求 |
| Week 10 | TikTok | 🔜 Phase 2 取决于API开放 |

---

**文档维护**: 后端组  
**最后更新**: 2026-03-09  
**技术负责人**: xiaohongshu/douyin由浏览器自动化小组专项负责
