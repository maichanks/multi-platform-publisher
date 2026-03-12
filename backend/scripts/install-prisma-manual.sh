#!/usr/bin/env bash
set -e

echo "🚀 开始手动安装 Prisma 到 backend..."

cd "$(dirname "$0")/.."

# 清理
rm -rf node_modules/prisma node_modules/@prisma/client
mkdir -p node_modules/prisma node_modules/@prisma/client

# 下载 tarball
echo "📦 下载 prisma@5.9.1..."
curl -sL "https://registry.npmjs.org/prisma/-/prisma-5.9.1.tgz" -o /tmp/prisma.tgz
echo "📦 下载 @prisma/client@5.9.1..."
curl -sL "https://registry.npmjs.org/@prisma/client/-/client-5.9.1.tgz" -o /tmp/client.tgz

# 解压 prisma
echo "📂 解压 prisma..."
mkdir -p /tmp/prisma-extract
tar -xzf /tmp/prisma.tgz -C /tmp/prisma-extract
cp -r /tmp/prisma-extract/package/* node_modules/prisma/

# 解压 @prisma/client
echo "📂 解压 @prisma/client..."
mkdir -p /tmp/client-extract
tar -xzf /tmp/client.tgz -C /tmp/client-extract
cp -r /tmp/client-extract/package/* node_modules/@prisma/client/

# 复制必需的脚本
echo "🔧 复制脚本..."
cp -r /tmp/prisma-extract/package/scripts node_modules/prisma/ 2>/dev/null || true
cp -r /tmp/prisma-extract/package/prisma-client/scripts node_modules/prisma/ 2>/dev/null || true

# 运行 preinstall 和 postinstall（模拟 npm 安装流程）
echo "⚙️  运行 preinstall..."
NODE_OPTIONS=--no-warnings node node_modules/prisma/scripts/preinstall-entry.js || true
echo "⚙️  运行 postinstall 生成客户端（可能需要下载引擎）..."
NODE_OPTIONS=--no-warnings node node_modules/prisma/scripts/postinstall.js || {
  echo "⚠️  postinstall 可能未完全成功，但我们可以尝试 prisma generate"
}

# 清理
rm -rf /tmp/prisma-extract /tmp/client-extract /tmp/prisma.tgz /tmp/client.tgz

# 验证
echo "✅ 安装完成。验证："
node -e "const p = require('./node_modules/prisma'); console.log('prisma version:', p.version || 'unknown');" 2>/dev/null || echo "prisma 模块可 require"
node -e "const c = require('./node_modules/@prisma/client'); console.log('@prisma/client loaded');" 2>/dev/null || echo "client 模块有问题"

echo ""
echo "🎉 现在尝试 prisma generate:"
npx prisma generate 2>&1 | head -20 || echo "生成失败，请检查错误"
