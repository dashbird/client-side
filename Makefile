default: package

package: 
	zip -r index.zip index.js node_modules package.json package-lock.js

deploy: package
	aws s3 cp index.zip s3://subscriber-lambda/