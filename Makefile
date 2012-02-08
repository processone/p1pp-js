all: p1pp.js

JS_FILES=\
	src/p1pp_defs.js \
	src/flash-websocket/swfobject.js \
	src/flash-websocket/web_socket.js \
	src/strophe/strophe.js \
	src/strophe/strophe.bosh.js \
	src/strophe/strophe.pubsub.js \
	src/strophe/strophe.roster.js \
	src/strophe/strophe.websocket.js \
	src/p1pp.js

GOOGLE_CC = compiler.jar
JAVA = java

p1pp.js: $(JS_FILES)
	@cat $(JS_FILES) > p1pp.js

p1pp.js.min: p1pp.js
	@$(JAVA) -jar $(GOOGLE_CC)  p1pp.js >p1pp.js.min