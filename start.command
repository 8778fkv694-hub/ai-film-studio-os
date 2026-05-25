#!/bin/bash

# ==============================================================================
# AI Film Studio OS - 启动启动器 (.command)
# ==============================================================================

# 设置终端标题
echo -ne "\033]0;AI Film Studio OS Launcher\007"

# 切换到脚本所在目录，确保相对路径运行正确
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# 定义颜色
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
MAGENTA='\033[1;35m'
CYAN='\033[1;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'
ITALIC='\033[3m'

# 检查 Node.js 状态
check_environment() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ 错误: 未检测到 Node.js 安装。${NC}"
        echo -e "本系统依赖 Node.js (v18+)，请先前往官网下载安装: ${BLUE}https://nodejs.org/${NC}"
        echo ""
        read -p "按回车键退出..."
        exit 1
    fi
    
    # 自动安装 core tools 依赖
    if [ ! -d "tools/node_modules" ]; then
        echo -e "${YELLOW}📦 首次运行，正在自动安装核心工具 (Core Tools) 依赖...${NC}"
        npm --prefix tools install
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ 依赖安装失败，请检查网络连接或运行环境。${NC}"
            read -p "按回车键退出..."
            exit 1
        fi
        echo -e "${GREEN}✅ 核心工具依赖安装完成！${NC}\n"
    fi

    # 自动安装 Web UI 依赖
    if [ ! -d "ui/node_modules" ]; then
        echo -e "${YELLOW}📦 首次运行，正在自动安装 Web 看板 (UI) 依赖...${NC}"
        npm --prefix ui install
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ 依赖安装失败，请检查网络连接或运行环境。${NC}"
            read -p "按回车键退出..."
            exit 1
        fi
        echo -e "${GREEN}✅ Web 看板依赖安装完成！${NC}\n"
    fi
}

resolve_active_project() {
    node -e "const fs=require('fs'),path=require('path');const root=process.cwd();let d=null;try{d=JSON.parse(fs.readFileSync(path.join(root,'projects.json'),'utf8'))}catch{}function p(id){if(!id||!/^[A-Za-z0-9_-]+$/.test(id))return null;const dir=path.join(root,'projects',id);return fs.existsSync(path.join(dir,'project.json'))?dir:null}const active=p(d&&d.activeProjectId)||(d&&d.projects||[]).map(x=>p(x.id)).find(Boolean)||'';process.stdout.write(active)"
}

# 显示主菜单
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "  █████╗ ██╗    ███████╗██╗██╗     ███╗   ███╗    ██████╗ ███████╗"
    echo " ██╔══██╗██║    ██╔════╝██║██║     ████╗ ████║    ██╔══██╗██╔════╝"
    echo " ███████║██║    █████╗  ██║██║     ██╔████╔██║    ██║  ██║███████╗"
    echo " ██╔══██║██║    ██╔══╝  ██║██║     ██║╚██╔╝██║    ██║  ██║╚════██║"
    echo " ██║  ██║██║    ██║     ██║███████╗██║ ╚═╝ ██║    ██████╔╝███████║"
    echo " ╚═╝  ╚═╝╚═╝    ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝    ╚═════╝ ╚══════╝"
    echo -e "${NC}"
    echo -e "${MAGENTA}✨ ───────────────── AI 影视工作室操作系统 ───────────────── ✨${NC}"
    echo -e "       ${ITALIC}像写代码一样做电影 (Make movies like writing code)${NC}"
    echo ""
    echo -e "${WHITE}🏠 当前目录: ${GREEN}$PWD${NC}"
    if [ -n "$PROJECT_DIR" ]; then
        echo -e "${WHITE}🎞️  活动项目: ${GREEN}$PROJECT_DIR${NC}"
    fi
    echo -e "${WHITE}🟢 Node.js 版本: ${GREEN}$(node -v)${NC}"
    echo ""
    echo -e "${BLUE}🤖 [请选择操作]:${NC}"
    echo -e "  ${GREEN}[1]${NC} 🚀 启动 Web 看板 (Launch Web UI)"
    echo -e "  ${GREEN}[2]${NC} 🛡️  运行静态安全检查 (Run Pre-flight Validation & Lint)"
    echo -e "  ${GREEN}[3]${NC} 📝 解析剧本草稿 (Split Script into Shots)"
    echo -e "  ${GREEN}[4]${NC} 🖼️  编译分镜与图片提示词包 (Compile Image Prompts)"
    echo -e "  ${GREEN}[5]${NC} 🗣️  生成配音 (Generate TTS Dialogues)"
    echo -e "  ${GREEN}[6]${NC} 🎬 编译最终视频提示词 (Compile Video Prompts)"
    echo -e "  ${GREEN}[7]${NC} 🛠️  运行后期修复工单 (Process Fixups)"
    echo -e "  ${GREEN}[8]${NC} 🌾 生成演示 Demo 数据种子 (Seed Demo Data)"
    echo -e "  ${GREEN}[9]${NC} 🩺  一键健康检查 (Run check-all)"
    echo -e "  ${RED}[0]${NC} ❌ 退出 (Exit)"
    echo ""
    echo -e "${MAGENTA}✨ ────────────────────────────────────────────────────────── ✨${NC}"
    echo -n "👉 请输入选项 (0-9): "
}

# 运行主逻辑
check_environment
PROJECT_DIR="$(resolve_active_project)"
PROJECT_ARG=()
if [ -n "$PROJECT_DIR" ]; then
    PROJECT_ARG=(--project-dir "$PROJECT_DIR")
fi

while true; do
    show_menu
    read -r opt
    case $opt in
        1)
            echo -e "\n${CYAN}🌍 正在启动 Web 看板...${NC}"
            echo -e "🔗 浏览器将自动打开: ${BLUE}http://localhost:9527${NC}"
            echo -e "💡 停止服务请按快捷键: ${YELLOW}Ctrl + C${NC}"
            echo ""
            # 在后台稍等 2 秒后自动打开浏览器
            (sleep 2 && open http://localhost:9527) &
            
            # 使用 trap 忽略 SIGINT 以便在按下 Ctrl+C 退出开发服务器时能返回主菜单
            trap 'echo -e "\n${GREEN}♻️ 已返回主菜单${NC}"; sleep 1' INT
            npm --prefix ui run dev
            trap - INT
            ;;
        2)
            echo -e "\n${CYAN}🛡️ 正在进行结构校验...${NC}"
            node tools/scripts/validate.js "${PROJECT_ARG[@]}"
            VALIDATE_STATUS=$?
            
            echo -e "\n${CYAN}🛡️ 正在进行逻辑 Lint 检查...${NC}"
            node tools/scripts/lint.js "${PROJECT_ARG[@]}"
            LINT_STATUS=$?
            
            echo ""
            if [ $VALIDATE_STATUS -eq 0 ] && [ $LINT_STATUS -eq 0 ]; then
                echo -e "${GREEN}✅ 恭喜！结构校验与逻辑检查全部通过 (All checks OK)!${NC}"
            else
                echo -e "${RED}❌ 警告：部分检查未通过，请处理上述错误。${NC}"
            fi
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        3)
            echo -e "\n${CYAN}📝 解析剧本草稿...${NC}"
            read -p "请输入剧本文件路径 [默认: docs/script.txt]: " script_path
            if [ -z "$script_path" ]; then
                script_path="docs/script.txt"
            fi

            check_script_path="$script_path"
            if [[ "$script_path" != /* ]] && [ -n "$PROJECT_DIR" ]; then
                check_script_path="$PROJECT_DIR/$script_path"
            fi
            
            if [ ! -f "$check_script_path" ]; then
                echo -e "${RED}❌ 错误: 文件 '$script_path' 不存在！${NC}"
            else
                echo -e "${YELLOW}运行 script-split.js...${NC}"
                node tools/scripts/script-split.js "$script_path" "${PROJECT_ARG[@]}"
                echo -e "\n${GREEN}✅ 剧本拆解完成！${NC}"
                echo -e "💡 提示：分镜草稿已生成在 ${CYAN}shots_draft/${NC} 目录，请确认无误后移动到 ${CYAN}shots/${NC} 目录正式生效。"
            fi
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        4)
            echo -e "\n${CYAN}🖼️  编译分镜与图片提示词包...${NC}"
            node tools/scripts/build-image-prompts.js "${PROJECT_ARG[@]}"
            echo -e "\n${GREEN}✅ 编译完成！${NC}"
            echo -e "产物已输出到: ${CYAN}prompts/image/*.image.json${NC}, ${CYAN}exports/storyboard.csv${NC}, ${CYAN}exports/storyboard.md${NC}"
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        5)
            echo -e "\n${CYAN}🗣️  正在使用 Edge TTS 生成对白配音...${NC}"
            node tools/scripts/gen-tts.js "${PROJECT_ARG[@]}"
            echo -e "\n${GREEN}✅ 配音生成完成！${NC}"
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        6)
            echo -e "\n${CYAN}🎬 编译最终视频提示词...${NC}"
            node tools/scripts/build-prompts.js "${PROJECT_ARG[@]}"
            echo -e "\n${GREEN}✅ 视频提示词编译完成！${NC}"
            echo -e "产物已输出到: ${CYAN}prompts/*.final.json${NC}"
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        7)
            echo -e "\n${CYAN}🛠️  运行后期修复工单...${NC}"
            node tools/scripts/process-fixups.js "${PROJECT_ARG[@]}"
            echo -e "\n${GREEN}✅ 修复任务运行完成！${NC}"
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        8)
            echo -e "\n${CYAN}🌾 正在生成长篇分镜漫画 Demo 的种子数据...${NC}"
            node tools/scripts/seed-long-comic-demo.js
            echo -e "\n${GREEN}✅ 种子数据生成完毕！可以使用 Web UI 进行预览。${NC}"
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        9)
            echo -e "\n${CYAN}🩺 一键健康检查 (check-all)...${NC}"
            echo "请选择检查模式:"
            echo -e "  ${GREEN}[1]${NC} 快速检查 (Quick Check - 只运行校验和提示词构建)"
            echo -e "  ${GREEN}[2]${NC} 完整检查 (Full Check - 包含 UI 构建与 Remotion 准备)"
            echo -n "👉 请输入模式选项 (1-2, 默认 1): "
            read -r mode_opt
            
            CHECK_ARGS=("${PROJECT_ARG[@]}")
            if [ "$mode_opt" != "2" ]; then
                CHECK_ARGS+=(--quick)
                echo -e "\n${YELLOW}正在运行快速健康检查...${NC}"
            else
                echo -e "\n${YELLOW}正在运行完整项目健康检查...${NC}"
            fi
            
            node tools/scripts/check-all.js "${CHECK_ARGS[@]}"
            CHECK_STATUS=$?
            
            echo ""
            if [ $CHECK_STATUS -eq 0 ]; then
                echo -e "${GREEN}✅ 检查通过！项目健康状态 OK。${NC}"
            else
                echo -e "${RED}❌ 检查失败！请处理上方报错。${NC}"
            fi
            echo -e "\n按任意键返回主菜单..."
            read -n 1 -s
            ;;
        0)
            echo -e "\n${GREEN}👋 感谢使用 AI Film Studio OS，再见！${NC}"
            sleep 1
            exit 0
            ;;
        *)
            echo -e "\n${RED}⚠️  无效的选项，请输入 0-8 之间的数字。${NC}"
            sleep 1.5
            ;;
    esac
done
