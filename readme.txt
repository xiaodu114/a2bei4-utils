！！！写在最前面： dist 、 types 、 /src/temp 、 /src/index.js 是构建过程中生成的，可以利用 clean-pack-generate.js 删除

-->  官方 npm 仓库地址： https://registry.npmjs.org/
-->  阿里云 npm 仓库地址： https://registry.npmmirror.com/
-->  --registry 显示指定的仓库地址，如：http://192.168.x.x:4873


0、首次安装依赖
pnpm i -D @rollup/plugin-commonjs @rollup/plugin-node-resolve @rollup/plugin-terser prettier rollup rollup-plugin-dts rollup-plugin-filesize typescript

1、如果没有用户，先注册用户
pnpm adduser --registry https://registry.npmjs.org/

2、用户登录
pnpm login --registry https://registry.npmjs.org/

3、发布
pnpm publish --registry https://registry.npmjs.org/

4、撤销发布
pnpm unpublish a2bei4-utils --force --registry https://registry.npmjs.org/
