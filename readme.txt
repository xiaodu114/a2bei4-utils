0、首次安装依赖
pnpm i -D @rollup/plugin-commonjs @rollup/plugin-node-resolve @rollup/plugin-terser prettier rollup rollup-plugin-dts rollup-plugin-filesize typescript

-->  --registry 私有仓库地址

1、如果没有用户，先注册用户
pnpm adduser --registry http://192.168.x.x:4873

2、用户登录
pnpm login --registry http://192.168.x.x:4873

3、发布
pnpm publish --registry http://192.168.x.x:4873

4、撤销发布
pnpm unpublish @a2bei4/utils --force --registry http://192.168.x.x:4873