import fs from 'fs';

// 定义要删除的文件夹和文件列表
const pathsToDelete = [
    'dist',
    'types',
    'src/temp',
    'src/index.js'
];

console.log('开始清理...');

pathsToDelete.forEach(path => {
    try {
        fs.rmSync(path, { recursive: true, force: true });
        console.log(`✅ 成功删除: ${path}`);
    } catch (err) {
        console.error(`❌ 删除 ${path} 时出错:`, err);
    }
});

console.log('清理完成!');