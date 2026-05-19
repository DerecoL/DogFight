# DogFight 上线准备缺口清单

本文档用于记录从当前仓库状态到真实腾讯云上线之间还需要补齐的事项。当前仓库已经具备 GitHub Actions、Docker Compose、PostgreSQL、Caddy 和备份脚本，但真实服务器和密钥信息不应写入仓库。

## 当前已具备

- GitHub Actions 部署 workflow：`.github/workflows/deploy.yml`。
- 生产 Docker Compose 服务：`postgres`、`api`、`caddy`。
- PostgreSQL 持久化数据卷：`postgres_data`。
- Prisma PostgreSQL schema 和迁移脚本。
- `.env.example` 生产环境变量模板。
- PostgreSQL 手动备份脚本和每日 cron 安装脚本。
- 部署结构测试：`src/deployment.structure.test.ts`。

## 需要补齐的真实配置

- [ ] GitHub remote：当前本地仓库尚未配置可见 remote，需要确认真实 GitHub 仓库地址。
- [ ] GitHub 主分支：当前 workflow 默认部署 `main`，需要确认最终生产分支仍为 `main`。
- [ ] 腾讯云服务器公网 IPv4：用于 `SERVER_HOST` 和域名解析。
- [ ] SSH 登录用户：通常为 `ubuntu`，但需要以实际服务器为准。
- [ ] SSH 私钥：用于 GitHub Actions 登录服务器，保存到 `SERVER_SSH_KEY`。
- [ ] GitHub 仓库读取 token：保存到 `DEPLOY_REPO_TOKEN`，用于服务器拉取私有仓库。
- [ ] 部署目录：默认 `/opt/dogfight`，需要确认服务器上不会与其他项目冲突。
- [ ] 生产域名：用于 `DOMAIN` 和 DNS `A` 记录。
- [ ] ICP 备案状态：如果面向中国大陆公网访问，需要确认备案完成。
- [ ] 生产数据库密码：生成强密码，并同时写入 `POSTGRES_PASSWORD` 和 `DATABASE_URL`。
- [ ] JWT 密钥：生成长随机 `JWT_SECRET`，不要复用开发环境值。
- [ ] `PRODUCTION_ENV`：把完整 `.env.production` 内容保存到 GitHub Secret。
- [ ] 备份保留策略：当前默认保留 7 天，需要确认是否改为 14 天、30 天或异地备份。

## 执行顺序

1. 在 GitHub 创建或确认 DogFight 私有仓库。
2. 在本地设置 remote，并确认能 push 到目标仓库。
3. 在腾讯云创建 Ubuntu 22.04 Lighthouse 服务器。
4. 配置服务器 SSH 登录和安全组，至少开放 `80`、`443`。
5. 将域名 `A` 记录指向服务器公网 IPv4。
6. 在服务器执行 `deploy/bootstrap-ubuntu.sh`，准备 Docker 环境和 `/opt/dogfight`。
7. 在 GitHub repository secrets 中配置 `SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY`、`DEPLOY_PATH`、`DEPLOY_REPO_TOKEN`、`PRODUCTION_ENV`。
8. 手动触发 GitHub Actions `Deploy` workflow。
9. 在服务器执行 `docker compose --env-file .env.production ps`，确认 `postgres`、`api`、`caddy` 正常。
10. 请求 `https://真实域名/api/health`，确认 API 健康检查可访问。
11. 执行一次手动备份，确认 `/opt/dogfight/backups` 生成 SQL 文件。
12. 再安装每日备份 cron。

## 生产数据安全规则

- 不要提交 `.env.production`、数据库备份、SSH 私钥或生产密码。
- 不要在生产服务器执行会删除 Docker volume 的清理命令，尤其是针对 `postgres_data` 的删除。
- 部署更新使用 `docker compose up -d --build`；不要用会重建并删除 volume 的命令。
- 恢复数据库前先在测试环境验证备份文件可用。
- 修改备份保留天数前，先确认服务器磁盘容量和数据恢复目标。

