/**
 * P1PP library
 * Author: Eric Cestari <ecestari@process-one.net>
 *
 * This library will open an XMPP socket using the best transport available.
 * Once connection has been established, it will suscribe to PubSub nodes on the given service
 * For each publication event, it will call the user provided `publish(id, item, delayed)` function.
 *
 */

/**
 * P1PP. The main class
 *
 **/
P1PP.prototype = {
  /**
   * @param {Object} params the configuration parameters. See Readme for usage
   * @param {Boolean} fallback Used internally. if connection fails and timeout code is triggered it will set this to true.
   */
  connect: function(fallback){
    var self = this,
        params = this.params;
    if(!!this.connection && this.connection.connected){
      return;
    }

    this._check_rebind();
    var _connect = function(){
      self.retries ++;
      if (self.retries > params.connectretry){
        self.console.log(params.connectretry + " connect retry exceeded");
        return;
      }
      self.timeout_id = setTimeout(function(){
        self.connect(true);
      }, params.connect_timeout);
      if(!fallback && params.ws_url && window.WebSocket){
        self.current_protocol = "WEBSOCKET";
        self.websocket(); 
      } else { 
        self.current_protocol = "BOSH";
        self.bosh(); 
      }
    };
    // Setting up connection delay
    if((this.retries == 0) && !fallback){
      setTimeout(_connect.bind(this), params.connect_delay);
    } else {
      _connect();
    }
  },
  /**
   * Closes connection to server
   */
  disconnect: function(){
    this.closing=true;
    window.clearTimeout(this.timeout_id);
    this.rebind_delete();
    if(this.connection){
      this.connection.deleteTimedHandler(this.bosh_rebind_id);
      this.connection.disconnect();
    }
  },
  
  /**
   * BOSH connection code.
   * Will attempt to re-attach is param is set and attached value stored on the client.
   */
  bosh: function(){
    try{
      this.connection = new Strophe.Connection(this.params.bosh_url);
      /* Reattach needs to be fixed on BOSH */
      var cookie = this.rebind_fetch();
      if(!!cookie && this.params.rebind){ //there's a cookie
        prev_connection = cookie.split(" ");  
        if(prev_connection[0] == "BOSH"){ //Only BOSH cookies accepted
          this.connection.attach(prev_connection[1],
                      prev_connection[2],
                      prev_connection[3],
                      this.conn_callback.bind(this))
        } else {
          this._transport_connect();
        }
      } else {
          this._transport_connect();
      }
     } catch (e){
        this.connect();
    }

  },

  /**
   * WebSocket connection code
   * Will attempt to use fast rebind is param is set and rebind data is availble on client.
   * @private
   */
  websocket: function(){
    try{
      this.connection = new Strophe.WebSocket(this.params.ws_url);
      var cookie = this.rebind_fetch();
      if(!!cookie && this.params.rebind){ 
        prev_connection = cookie.split(" ");
        this.connection.rebind(prev_connection[1],
                    prev_connection[2],
                    this.conn_callback.bind(this))
      } else {
        this._transport_connect();
      }
    } catch (e){
       this.rebind_delete();
       this.connect();
    }
  },

  _transport_connect: function(){
    var jid = this.params.jid ? this.params.jid : this.params.domain;
    var password = this.params.password ? this.params.password : ""
    this.connection.connect(jid, 
                password, this.conn_callback.bind(this));
  },
  /**
  * Checks if rebind can be safely called
  * Only useful in case of non-anon connections
  */
  _check_rebind: function(){
    if(!this.params.rebind){
      //rebind not active
      return;
    }
    var cookie = this.rebind_fetch();
    if(!!cookie && this.params.jid && this.params.jid !== ""){
      var prev = cookie.split(" ");
      var jid = Strophe.getBareJidFromJid(this.params.jid);
      var prev_jid = Strophe.getBareJidFromJid(cookie.split(" ")[1]);
      if(jid != prev_jid){
        this.rebind_delete();
      }
    }
  },
  /**
   * Main connection callback
   * @param {Integer} status The StropheJS status of the connection.
   * @private
   */
  conn_callback: function(status){
    var that = this;
    if(this.params.debug){
      this.connection.rawOutput = function(elem){
       that.console.log("out -> " + elem);
      }
      this.connection.rawInput = function(elem){
        that.console.log("in <- " + elem);
      }
    }
    // Connection established
    window.clearTimeout(this.timeout_id);
    this.bosh_rebind_id = this.connection.addTimedHandler(2000, function(){
      if(that.current_protocol === "BOSH" && !that.closing){
        var c = ["BOSH", that.connection.jid, that.connection.sid, that.connection.rid].join(" ");
        that.rebind_store(c);
      }
      return true;
    });
    this.params.on_strophe_event(status, this.connection);
    var login_required_cb = function(jid, pass){
      that.params.jid=jid;
      that.params.password=pass;
      that.connect();
    }
    if (status === Strophe.Status.CONNECTED) {
      this.params.on_connected();
      this.retries = 0;
      if(this.params.rebind == true 
        && this.current_protocol == "WEBSOCKET"){
          this.connection.save(function(){
            var id = ["WEBSOCKET",that.connection.jid, that.connection.streamId].join(" ")
            that.rebind_store(id);
          }, function(){});
        } 
      this.subscribe();
    }
    // Connection re-attached (or rebound)
    else if (status === Strophe.Status.ATTACHED){
      // Forcing subscription. there is a problem with rebinding and anon subs in ejabberd
      if(this.current_protocol == "WEBSOCKET"){
        this.subscribe();
      }
      else{
        // For some reason, I have to wait the second HTTP POST to actually get the result.
        // ejabberd says data is sent, the browser says no, it's not.
        // One of them is lying. Or both.
        // In the meantime, a short timeout will do the trick.
        setTimeout(function(){
          nodes = that.params.nodes;
          for(var i in nodes){
            if(typeof nodes[i] == "string"){ // IE6 fix
              // In case of attach, we need to set up the handlers again.
              if(that.params.num_old > 0){
                that.connection.pubsub.items(that.connection.jid, that.params.pubsub_domain, nodes[i], that.params.num_old, function(message){
            			var items = message.getElementsByTagName("item")
            	    for(var i = 0;  i < items.length; i++){
            	      id = items[i].getAttribute("id");
            	      that.params.publish(id, items[i].firstChild);
            	    }
            		})
              }
            }
          }
          that.connection.addHandler(that.on_event.bind(that),
                            null,'message',  null, null, that.params.pubsub_domain);
        }, 100);
        
      }
       
    }
    // Connection problem or reattach failed. Will attempt to reconnect after a random wait
    else if (!this.closing 
            && (status === Strophe.Status.CONNFAIL 
              || status === Strophe.Status.DISCONNECTED)) {
      this.connection.deleteTimedHandler(this.bosh_rebind_id);
      this.rebind_delete();
      //login is required. Give user code a chance to fetch jid and password
      if(!this.params.jid && this.params.login_required){
        this.params.on_login_required(login_required_cb)
      } else {
         var retry_time = Math.round(Math.random() * this.params.connect_timeout * (this.retries+1));
          this.timeout_id = setTimeout(function(){
            that.connect();
          }, retry_time);
      }
    }
    else if (status === Strophe.Status.DISCONNECTED){
      this.connection.reset();
      this.closing = false;
      this.params.on_disconnect();
    }
    // WebSocket rebind failed. Removing user data and reconnecting
    else if (status === Strophe.Status.REBINDFAILED){
      this.rebind_delete();
      this.connection = null;
      this.connect();
    }
    else if (status === Strophe.Status.AUTHFAIL){
      delete this.connection;
      this.params.on_login_required(login_required_cb);
    }
  },
  /**
   * Subscribe to PubSub nodes
   * If num_old is set, fetch older nodes.
   * Warning: The last_published item is delivered twice, if both send_last_item configured on node and num_old >= 1
   * @private
   */
  subscribe: function(nodes){
    if(nodes === undefined){
      nodes = this.params.nodes;
    }
    for(var i in nodes){
      if(typeof nodes[i] == "string"){ // IE6 fix
        if(this.params.num_old > 0){
          var that = this;
          this.connection.pubsub.items(this.connection.jid, this.params.pubsub_domain, nodes[i], this.params.num_old, function(message){
      			var items = message.getElementsByTagName("item")
      	    for(var i = 0;  i < items.length; i++){
      	      id = items[i].getAttribute("id");
      	      that.params.publish(id, items[i].firstChild);
      	    }
      		})
        }
        this.connection.pubsub.subscribe(this.connection.jid, 
                                this.params.pubsub_domain, 
                                nodes[i],[],
                                function(){});
      }
    }
    this.connection.addHandler(this.on_event.bind(this),
                    null,'message',  null, null, this.params.pubsub_domain);
  },

  unsubscribe: function(nodes){
    if(nodes === undefined){
      nodes = this.params.nodes;
    }
    for(var i in nodes){
      if(typeof nodes[i] == "string"){ // IE6 fix
        this.connection.pubsub.unsubscribe(this.connection.jid, 
                                this.params.pubsub_domain, 
                                nodes[i],
                                function(){});
      }
    }
  },

  _extract_error_code: function(stanza) {
    var error = stanza.getElementsByTagNameNS("http://jabber.org/protocol/pubsub#errors", "*");
    
    if (!error.length)
      error = stanza.getElementsByTagNameNS("urn:ietf:params:xml:ns:xmpp-stanzas", "*");

    return error.length ? error[0].localName : null;
  },

  _publish: function(node, id, value, callback) {
    var that = this;

    if (id == null)
      id = this.connection.getUniqueId("publish");
    
    this.connection.pubsub.publish(this.connection.jid, this.params.pubsub_domain,
                                   node, [{id: id, value: [value]}], function(stanza) {
                                      that._done_publish(stanza, callback);
                                   });
    return id;
  },

  _done_publish: function(stanza, callback) {
    var items = stanza.getElementsByTagName("item");
    var id = items.length ? items[0].getAttribute("id") : null;

    if (stanza.getAttribute("type") == "result")
      callback(id, "ok");
    else
      callback(id, this._extract_error_code(stanza) || "error")
  },

  _deleteNode: function(node, callback) {
    var that = this;

    this.connection.pubsub.deleteNode(this.connection.jid, this.params.pubsub_domain,
                                   node, function(stanza) {
                                      that._done_delete(stanza, callback);
                                   });
  },

  _done_delete: function(stanza, callback) {
    if (stanza.getAttribute("type") == "result")
      callback("ok");
    else
      callback(this._extract_error_code(stanza) || "error")
  },

 /**
  * pubsub message handling.
  * Triggered everytime there is an event coming from the server (publication or retraction of items)
  * @param {DOMElement} msg the message from the server
  * @private
  **/
  on_event: function(msg){
    var retracts = msg.getElementsByTagName("retract");
    var length =retracts.length
    for(var i = 0; i < length; i++){
      this.params.retract(retracts[i].getAttribute("id"));
    }
    var delay_time = undefined;
    var delay = msg.getElementsByTagName("delay");
    if(delay.length){
      delay_time = delay[0].getAttribute("stamp");
    }
    var items = msg.getElementsByTagName("items");
    length = items.length;
    var node_name, node_items, ilength;
    for(var i = 0;  i < length; i++){
      node_name = items[i].getAttribute("node");
      node_items = items[i].getElementsByTagName("item");
      ilength = node_items.length;
      for(var i = 0;  i < ilength; i++){
        this.params.publish(node_items[i].getAttribute("id"), 
              node_items[i].firstChild, 
              node_name,
              delay_time);
      }
    }
    return true;
  },

  /**
   * Cookie management code, taken from jquery.cookie.js <https://github.com/carhartl/jquery-cookie>
   * @private
   */
  cookie: function(key, value){
    if (typeof value != 'undefined'){
       options = this.params.cookie_opts;
        if (value === null) {
            value = '';
            options.expires = -1;
        }
        var expires = '';
        if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
            var date;
            if (typeof options.expires == 'number') {
                date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
            } else {
                date = options.expires;
            }
            expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
        }
        // CAUTION: Needed to parenthesize options.path and options.domain
        // in the following expressions, otherwise they evaluate to undefined
        // in the packed version for some reason...
        var path = options.path ? '; path=' + (options.path) : '';
        var domain = options.domain ? '; domain=' + (options.domain) : '';
        var secure = options.secure ? '; secure' : '';
        document.cookie = [key, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
        
     } else { // only name given, get cookie
         var cookieValue = null;
         if (document.cookie && document.cookie != '') {
             var cookies = document.cookie.split(';');
             for (var i = 0; i < cookies.length; i++) {
                 var trim = function( text ) {
                     if ( typeof String.trim === "function" ) {
                         return ( text || "" ).trim();
                     }
                     return (text || "").replace( /^\s\s*/, "" ).replace( /\s\s*$/, "" );
                 }
                 var cookie = trim(cookies[i]);
                 // Does this cookie string begin with the name we want?
                 if (cookie.substring(0, key.length + 1) == (key + '=')) {
                     cookieValue = decodeURIComponent(cookie.substring(key.length + 1));
                     break;
                 }
             }
         }
         return cookieValue;
     }
      
  },  
  /**
   * stores connection information in sessionStorage if available or cookie
   * @private
   */
  rebind_store: function(value){
     var key = this._build_key()
     if(window.sessionStorage){
        sessionStorage[key]=value;
      } else {
        this.cookie(key, value);
      }
  },
  /**
   * deletes connection information in sessionStorage if available or cookie
   * @private
   */
  rebind_delete: function(){
    var key = this._build_key()
     if(window.sessionStorage){
        sessionStorage.removeItem(key)
      } else {
        this.cookie(key, null);
      }
  },
  /**
   * fetchs connection information in sessionStorage if available or cookie
   * @private
   */
  rebind_fetch: function(){
   var key = this._build_key();
   if(window.sessionStorage){
       return sessionStorage[key];
     } else {
       return this.cookie(key);
     }
  },
  /**
   * Build key for protocol.
   * BOSH connections can be scoped, for a different set of nodes
   * Not necessary for WS as the client subscribes on reattach.
   */
  _build_key: function(){
    var key = P1PP.COOKIE+ "_" + this.current_protocol;
    if(this.current_protocol === "BOSH"){
      key = key + "_" + this.scope;
    }
    return key;
  }
};

