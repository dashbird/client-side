.PHONY: cksum package deploy
default: package

CKSUM_SCRIPT:=md5sum index.zip | awk '{ print $$1 }'

package:
	zip -r index.zip index.js node_modules package.json package-lock.js

cksum:
	cp index.zip index_$(shell $(CKSUM_SCRIPT)).zip
	echo index_$(shell $(CKSUM_SCRIPT)).zip > latest

deploy: package cksum
	aws s3 cp index.zip s3://dashbird-subscriber/
	aws s3 cp index_$(shell $(CKSUM_SCRIPT)).zip s3://dashbird-subscriber/
	aws s3 cp latest s3://dashbird-subscriber/
