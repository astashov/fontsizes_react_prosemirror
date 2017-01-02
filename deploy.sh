#!/bin/sh

cp ./node_modules/systemjs/dist/system.js ./dist
cp ./index_prod.html ./dist/index.html
cp ./styles.css ./dist
rake s3_deployer:deploy
