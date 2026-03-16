pnpm build
pushd .\examples/sprite_writeFile
pnpm i
node --cpu-prof --enable-source-maps --cpu-prof-dir=./profiles './node_modules/@11ty/eleventy/cmd.cjs'
popd
