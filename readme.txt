！！！写在最前面： dist 、 types 、 /src/temp 、 /src/index.js 是构建过程中生成的，可以利用 clean-pack-generate.js 删除

-->  官方 npm 仓库地址： https://registry.npmjs.org/
-->  阿里云 npm 仓库地址： https://registry.npmmirror.com/
-->  --registry 显示指定的仓库地址，如： http://192.168.x.x:4873

0、清理
    # 清理 pnpm 缓存
    pnpm store prune

    # 删除 node_modules 和 lock 文件：
    #   使用 PowerShell 原生命令，-ErrorAction SilentlyContinue 可以防止路径不存在时报错
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules, pnpm-lock.yaml

    #   使用 CMD 原生命令，/s 表示递归删除，/q 表示安静模式，不提示确认
    rmdir /s /q node_modules & del /f pnpm-lock.yaml

1、首次安装依赖
    pnpm i -D @rollup/plugin-commonjs @rollup/plugin-node-resolve @rollup/plugin-terser prettier rollup rollup-plugin-dts rollup-plugin-filesize typescript

2、如果没有用户，先注册用户
    pnpm adduser --registry https://registry.npmjs.org/

3、用户登录
    pnpm login --registry https://registry.npmjs.org/

4、发布
    pnpm publish --registry https://registry.npmjs.org/

5、撤销发布
    pnpm unpublish a2bei4-utils --force --registry https://registry.npmjs.org/
