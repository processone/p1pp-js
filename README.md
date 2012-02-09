# About P1PP


P1PP is a simple-to-use javascript client for connecting to an XMPP pubsub service. It will use WebSockets if possible or degrade to BOSH.

## Building

In the Makefile, if you want to use minification, set GOOGLE_CC and JAVA variables to correct locations

Then typing ``make`` will generate P1PP.js file and ``make minified`` minified version of that file: P1PP.js.min

## Usage


### P1PP.connect()


This function connects to server and allows you to pass configuration parameters used by other functions.

Example:

    P1PP.connect({
      jid: 'myaccount@test.server.com',
      password: '*****',
      domain: 'test.server.com',
      nodes: ['my-test-node'],
      debug: true
    })

You can pass those parameters to alter library configuration:

* **jid** - JID of account to used (optional). If none is passed anonymous connection will be performed.

* **password** - password for used account (optional). This field is only required when jid is passed as well.

* **ws_url** - Url to websocket service. Default value is "ws://p1pp.net:5280/xmpp"

* **bosh_url** - Url to http-bind service. Default value is "ws://p1pp.net:5280/http-bind"

* **domain** - Domain used by xmpp server. Default value is "p1pp.net"

* **rebind** - Should be set to true if fast rebind should be used when reconnecting to server

* **flash_location** - Path to place where flash helper script is available, defaults to "WebSocketMain.swf"

* **nodes** - List of nodes to subscribe to

* **num_old** - Maximum number of old items to fetch

* **connect_delay** - Wait this much milliseconds before starting connecting to server. Default value is 0

* **connect_retry** - How much times reconnection should be tried before failing completely

* **connect_timeout** - Time in milliseconds before reconnections

* **debug** - If set to true debug messages will be delivered using console.info interface

* **publish** - Callback function called when new value was published in any of subscribed node.
  This function should have signature similar to ``function(id, value, node, timestamp)``, where
  ``id`` is a string identifying received value, ``value`` received content as DOM element,
  ``node`` contains name of updated node, ``delay`` is time stamp of date when node was published, may be ``null``.

* **retract** - Callback called when value was deleted from one of subscribed node, this callback should be
  function with this signature ``function(id, node)``, ``id`` is a string identifying retracted value, and
  ``node`` is a node name where retracted value was stored

* **on_strophe_event** - Callback called when underlying strophe connection state is changed, it's called with one of
  Strophe.Status.* values as argument.


### P1PP.disconnect()


Closes connection to server

Example:

    P1PP.disconnect()


### P1PP.subscribeToNode()


Subscribes to new node or nodes

Example:

    P1PP.subscribeToNode(['timer@test.server.com/timer1', 'timer@test.server.com/timer2'])

This function takes list of strings with nodes, of single string with node as its argument

### P1PP.unsubscribeFromNode()

Stop subscribing to changes performed in node or nodes

Example:

    P1PP.unsubscribeFromNode(['timer@test.server.com/timer1', 'timer@test.server.com/timer2'])

This function takes list of strings with nodes, of single string with node as its argument


### P1PP.publish()


Publish new data in node

Example:

    P1PP.publish('timer', timer_event_id, timer_event_value, my_publish_callback)

This function takes 3 or 4 arguments, as first argument string with name of node should be passed.
Second argument is used as identifier of value to send, when ``null`` is used, random name is generated.
Third argument should be DOM element with stored value.
Fourth should be callback, it's called when server request store operation finished, it's called with two
arguments, identifier of stored value, and success (value "ok") or error code as second parameter.

This function returns identifier used to store value, it's equal to second value passed to this function,
or generated value if ``null`` was passed to function.


### P1PP.deleteNode()


Deletes node from server

Example:

    P1PP.deleteNode('geolocation@test.server.com/locations', my_delete_callback)

Takes string with name of node to delete, and optional callback function called when operation finishes.
Callback is called with "ok" when operation was completed successfully, or string with error code otherwise.



## Third party libraries used


StropheJS is licensed under the MIT license, except for the embedded files
base64.js and md5.js, which are licensed as public domain and
BSD.
Canonical repository is https://github.com/metajack/strophejs

--------------

FABridge, embedded with web-socket-js license:
Copyright 2006 Adobe Systems Incorporated

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.


THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

--------------

web-socket-js is licensed under New BSD License.
Canonical repository is https://github.com/gimite/web-socket-js

