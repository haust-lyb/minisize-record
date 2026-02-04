# GitHub Actions 构建配置说明

## 已配置的自动构建

当前项目已配置 GitHub Actions 自动构建，会在以下情况触发：
- 代码推送到 `main`、`master` 或 `develop` 分支
- 创建 Pull Request 到 `main` 或 `master` 分支

## 构建目标

### macOS (ARM64)
- **运行环境**：macOS-latest (Apple Silicon)
- **输出格式**：DMG 和 ZIP
- **架构**：ARM64 (Apple Silicon)

### Windows (x64) 
- **运行环境**：Windows-latest
- **输出格式**：NSIS 安装包
- **架构**：x64

## 构建产物

构建完成后，产物会上传到 GitHub Actions artifacts：
- **macOS ARM64**：`macos-arm64-build`
- **Windows x64**：`windows-x64-build`
- **保留时间**：30天

## 可选配置（如需代码签名）

如需对应用进行代码签名，请在 GitHub Secrets 中添加：
- `CSC_LINK`：证书文件（或 p12 文件）
- `CSC_KEY_PASSWORD`：证书密码

## 手动触发发布

如需创建正式发布版本：
1. 在 GitHub 上创建标签：`git tag v1.0.0 && git push origin v1.0.0`
2. Actions 会自动创建 Release 并上传构建产物

## 查看构建状态

访问 GitHub 仓库的 Actions 页面查看构建进度和结果。