import { promises as fs } from "fs";

// 定义要删除的文件夹和文件列表
const pathsToDelete = ["dist", "types", "src/temp", "src/index.js"];

// 定义一个异步的清理函数 (语法和之前一样)
async function cleanup() {
    console.log("开始异步清理...");
    for (const itemPath of pathsToDelete) {
        try {
            // 先检查文件或文件夹是否存在
            await fs.access(itemPath);
            // 如果存在，则执行删除
            await fs.rm(itemPath, { recursive: true });
            console.log(`✅ 成功删除: ${itemPath}`);
        } catch (error) {
            if (error.code === "ENOENT") {
                console.log(`⚠️  未找到，跳过: ${itemPath}`);
            } else {
                console.error(`❌ 处理 ${itemPath} 时出错:`, error);
            }
        }
    }
    console.log("异步清理完成!");
}

// 调用异步函数
cleanup();
