# DogFight 腾讯云部署与运维说明

本文档记录当前仓库已经落地的生产部署方案。默认架构是：工程代码放在 GitHub，腾讯云服务器运行 Docker Compose，玩家账号和游戏过程数据保存在服务器上的 PostgreSQL 数据卷中。

## 部署架构

生产环境由三组 Docker Compose 服务组成：

- `postgres`：PostgreSQL 16，保存玩家账号、局内进度、物品实例、幽灵快照和战斗日志。
- `api`：Fastify API，容器内监听 `4000`，通过 Caddy 对外提供 `/api/*`。
- `caddy`：HTTPS 入口，托管 Vite 前端静态文件，并反向代理 `/api/*` 到 `api:4000`。

对应工程文件：

- `.github/workflows/deploy.yml`：GitHub Actions 部署入口。
- `compose.yml`：生产服务、数据卷和依赖关系。
- `Dockerfile`：构建 API 镜像和 Caddy 静态站点镜像。
- `Caddyfile`：HTTPS、前端路由回退和 API 反向代理。
- `prisma/schema.prisma`：PostgreSQL 数据模型。
- `deploy/backup-postgres.sh`：手动或定时备份 PostgreSQL。
- `deploy/install-backup-cron.sh`：安装每日备份 cron。

## 数据边界

GitHub 只保存工程内容，包括源代码、部署脚本、迁移文件和文档。不要把真实 `.env.production`、数据库备份、SSH 私钥或生产密码提交到 GitHub。

腾讯云服务器保存运行时数据：

- `User`：玩家账号、密码哈希、昵称。
- `Run`：玩家当前局内进度、胜负、回合、金币、商店状态、最近战斗。
- `ItemInstance`：玩家局内物品实例和棋盘位置。
- `GhostSnapshot`：匹配用的玩家或种子幽灵快照。
- `BattleLog`：战斗结果和战斗过程日志。

PostgreSQL 数据通过 `compose.yml` 中的 `postgres_data:/var/lib/postgresql/data` 持久化。只要不删除 Docker volume，重新部署应用镜像不会清空玩家数据。

## 首次服务器准备

默认服务器系统为腾讯云 Lighthouse 上的 Ubuntu 22.04。首次准备时在服务器执行：

```bash
sudo sh deploy/bootstrap-ubuntu.sh
sudo mkdir -p /opt/dogfight
sudo chown "$USER:$USER" /opt/dogfight
```

然后把 GitHub 仓库 clone 到 `/opt/dogfight`，并基于 `.env.example` 创建生产环境变量文件 `.env.production`。

生产环境变量至少包含：

```env
NODE_ENV=production
DOMAIN=your-domain.example

POSTGRES_DB=dogfight
POSTGRES_USER=dogfight
POSTGRES_PASSWORD=replace-with-a-strong-password
DATABASE_URL=postgresql://dogfight:replace-with-a-strong-password@postgres:5432/dogfight?schema=public

JWT_SECRET=replace-with-a-long-random-secret
```

`POSTGRES_PASSWORD` 和 `JWT_SECRET` 必须使用长随机值，不要复用示例值。

## DNS 和防火墙

上线前需要完成：

- 域名 `A` 记录指向腾讯云服务器公网 IPv4。
- 腾讯云安全组或防火墙开放 `80` 和 `443`。
- 如果域名在中国大陆访问，按腾讯云和监管要求完成 ICP 备案。
- `DOMAIN` 环境变量填写真实域名，不要包含协议前缀。

## GitHub Secrets

在 GitHub 仓库中配置以下 repository secrets：

- `SERVER_HOST`：腾讯云服务器公网 IPv4。
- `SERVER_USER`：SSH 用户，通常是 `ubuntu`。
- `SERVER_SSH_KEY`：可以登录服务器的 SSH 私钥。
- `DEPLOY_PATH`：默认 `/opt/dogfight`。
- `DEPLOY_REPO_TOKEN`：可选。公开仓库可以不填；如果仓库改为私有，则填写有仓库读取权限的 GitHub token。
- `PRODUCTION_ENV`：完整 `.env.production` 内容。

当前 workflow 会在推送到 `main` 或手动触发时执行：

1. SSH 登录腾讯云服务器。
2. 如果 `DEPLOY_PATH` 下还没有仓库，就从 GitHub clone。
3. 如果已经存在仓库，就 fetch `main` 并 `git reset --hard origin/main`。
4. 写入 GitHub Secret 中的 `PRODUCTION_ENV` 到 `.env.production`。
5. 执行 `docker compose up -d --build`。
6. 输出 `docker compose ps` 便于检查服务状态。

## 部署验证

推送到 `main` 后，或在 GitHub Actions 页面手动运行 `Deploy` workflow。部署完成后在服务器检查：

```bash
cd /opt/dogfight
docker compose --env-file .env.production ps
curl https://your-domain.example/api/health
```

本地验证部署资产时运行：

```bash
npm test -- src/deployment.structure.test.ts
npm run build
```

## 备份与恢复

安装每日备份 cron：

```bash
cd /opt/dogfight
sudo sh deploy/install-backup-cron.sh
```

默认每天凌晨 `03:17` 在服务器执行 PostgreSQL 备份，备份目录为 `/opt/dogfight/backups`。备份文件名形如 `dogfight-YYYYMMDD-HHMMSS.sql`，脚本会删除超过 7 天的 `dogfight-*.sql` 文件。

手动备份：

```bash
cd /opt/dogfight
BACKUP_DIR=/opt/dogfight/backups sh deploy/backup-postgres.sh
ls -lh /opt/dogfight/backups
```

恢复前必须先确认目标数据库和备份文件，避免覆盖生产数据。推荐恢复到临时数据库或测试服务器验证，再决定是否恢复生产库。当前仓库只有备份脚本，没有自动恢复脚本；生产恢复流程应单独评审后执行。

## 常见故障

- GitHub Actions SSH 失败：检查 `SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY` 是否匹配服务器登录方式。
- clone 私有仓库失败：检查 `DEPLOY_REPO_TOKEN` 是否有仓库读取权限，token 是否过期。
- API 提示数据库不可用：检查 `.env.production` 中 `DATABASE_URL`、`POSTGRES_USER`、`POSTGRES_DB`、`POSTGRES_PASSWORD` 是否一致，并查看 `docker compose ps` 中 `postgres` 健康状态。
- HTTPS 无法访问：检查域名解析、防火墙 `80/443`、`DOMAIN` 环境变量和 Caddy 容器日志。
- 玩家数据丢失风险：不要执行删除 `postgres_data` volume 的命令；部署应用时使用 `docker compose up -d --build`，不要清理生产数据卷。
