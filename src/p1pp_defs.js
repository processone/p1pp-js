var WEB_SOCKET_DEBUG = false;
var WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = true;

var P1PP = function(params){
  this.jid= null;        //for non-anonymous connections
  this.password= null;   //
  this.connection= null; // the strophe connection
  this.params= null;     // merge between default params and user provided params
  this.timeout_id= null;  // points to the timeout function triggering the BOSH connection 
                          //if WS connection failed
  this.retries=0;        // How many retries already ?
  this.closing=false;
  this.defaults= { 
      flash_location: "WebSocketMain.swf",
      domain: "p1pp.net",
      ws_url: "ws://p1pp.net:5280/xmpp",
      bosh_url: "ws://p1pp.net:5280/http-bind",
      connect_timeout: 15000, //How long should we wait before trying BOSH ?
      connect_delay: 0,     //Connection will not be done before this number of ms
      connect_retry: 10,     //Connection max attempts
      rebind: true,         // attempt to reuse previous connection
      debug: false,         // Dump traffic in console
      num_old: 0,         // How many old items should be fetch ?
      on_strophe_event: function(){},  // Connect callback. if additional XMPP exchanges are to be done with the server.
      on_login_required: null,
      publish: function(){}, // User provided call back.Called everytime an event is published.
      retract: function(){}, //  User provided call back. Called when an item is retracted.
      on_disconnected: function(){}, // User Provided callback
      on_connected: function(){},
      cookie_opts: {},
      nodes: []
  };
  var merge = function (o,ob) {var i = 0;for (var z in ob) {if (ob.hasOwnProperty(z)) {o[z] = ob[z];}}return o;}
  this.params = merge(this.defaults, params);
  if(!this.params.pubsub_domain){
    this.params.pubsub_domain = "pubsub."+this.params.domain;
  }

  var nodes = this.params.nodes;
  if(nodes.length > 0){
    this.scope = MD5.hexdigest(nodes.join("-"));
  }
  
  if (!window.console || !window.console.log || !window.console.error) {
    this.console = {log: function(){ }, error: function(){ }};
  } else {
    if(this.params.debug){
      this.console = window.console;
    }    
  }
  if(this.params.debug){
    window.WEB_SOCKET_DEBUG = true;
  }
  window.WEB_SOCKET_SWF_LOCATION=this.params.flash_location;
  //initializing flash websockets (if necessary)
  if(window.WebSocket && window.WebSocket.__initialize){
    window.WebSocket.__initialize();
  }
  return this;
}
/**
 * Connects to server and subscribes to select channels.
 * @param {Object} params JSON object with configuration options (see below for attributes)
 * @returns {Object} the P1PP instance used for the connection
 *
 * <h2>Parameters and their default value</h2>                                                                                   
 * jid: ""  if set, will connect with this JID and password instead anonymous                                                                                                        
 * password: ""   see above                                                                                                                                                          
 * ws_url:  "ws://gitlive.com:5280/xmpp",   websocket URL                                                                                                                            
 * bosh_url: "http://gitlive.com:5280/http-bind",   BOSH URL                                                                                                                         
 * domain: "gitlive.com",	  Domain to logon to                                                                                                                                       
 * rebind: true,   should use rebind if possible                                                                                                                                     
 * nodes: [],    list of nodes to subscribe to                                                                                                                                       
 * num_old: 0,   maximum number of old items to fetch                                                                                                                                
 * flash_location: "WebSocketMain.swf",   Location of the WebSocket flash file. Can be an URL                                                                                        
 * connect_delay: 0   The client will attempt connection after this milliseconds                                                                                                     
 * connect_timeout: 3000   How long should we wait before fallback to BOSH  ,                                                                                                        
 * connect_retry: 10,  How many times should we try connecting                                                                                                                       
 * pubsub_domain: "pubsub.gitlive.com",   pubsub service url. defaults to pubsub.domain                                                                                              
 * debug: false, 	  Will dump traffic in console if true..                                                                                                                           
 * publish: function(){},   publish callback                                                                                                                                         
 * retract: function(){}   retract callback                                                                                                                                          
 * on_strophe_event: function(){}   Access to StropheJS API events                                                                                                                   
 * cookie_opts: {path: false, domain: false, expire:false, secure: false}   cookies options if cookies are used                                                                      
 *
 */
P1PP.connect = function(params){
    if(!this.push_client){
      this.push_client = new P1PP(params);
      this.push_client.connect();
    } else if(this.push_client.connection.connected == false){
      this.push_client.connect();
    }
    return this.push_client;
  }
  
/**
 * Disconnect client
 */
P1PP.disconnect = function(){
    var that = this;
    this.push_client.disconnect()
  }
/**
 * Subscribe to a channel or channels
 * @param channels a string or an array of string each being a node to subscribe to
 */
P1PP.subscribeToNode = function(channels){
  if(this.push_client){
    if(typeof channels === "string"){
      channels = [channels];
    }
    var nodes = this.push_client.params.nodes;
    this.merge(nodes, channels)
    if(nodes.length > 0){
      this.push_client.scope = MD5.hexdigest(nodes.join("-"));
    }
    this.push_client.subscribe(channels)
  }
}
/**
 * Unsubscribe from a channel or channels
 * @param channels a string or an array of string each being a node to unsubscribe from
 */
P1PP.unsubscribeFromNode = function(channels){
  if(this.push_client){
    if(typeof channels === "string"){
      channels = [channels];
    }
    var nodes = P1PP.diff(this.push_client.params.nodes, channel);
    if(nodes.length > 0){
      this.push_client.scope = MD5.hexdigest(nodes.join("-"));
    }
    this.push_client.unsubscribe(channels)
  }
}

/**
 * Publishes data under given node
 *
 * @param {String} node - Name of node which should be used for
 *   publishing
 * @param {String} id - Id of published data, if null random name is
 *   generated
 * @param {DOMElement} data - Data to store
 * @param {Function} callback - Callback called with (id, status_code)
 *   after receiving response from server, status_code "ok" is used for
 *   successfull operation
 * @returns null if connection is not yet established, Id of published data otherwise
 */
P1PP.publish = function(node, id, value, callback) {
    if (this.push_client)
        return this.push_client._publish(node, id, value, callback);
    return null;
},

/**
 * Publishes data under given node
 *
 * @param {String} node - Name of node which should be used for
 *   publishing
 * @param {String} id - Id of published data, if null random name is
 *   generated
 * @param {DOMElement} data - Data to store
 * @param {Function} callback - Callback called with (id, status_code)
 *   after receiving response from server, status_code "ok" is used for
 *   successfull operation
 * @returns Id of published data
 */
P1PP.deleteNode = function(node, callback) {
    if (this.push_client)
        return this.push_client._deleteNode(node, callback);
    return null;
},

P1PP.COOKIE = "session"; // Cookie or sessionstorage key used to store attach or fast rebind data.
P1PP.couldRebind = function(){
   var protocols = ["WEBSOCKET", "BOSH"];
   for(p in protocols){
     var key = P1PP.COOKIE+ "_" + protocols[p];
      if(window.sessionStorage){
          return !!sessionStorage[key];
        } else {
          return !!this.cookie(key);
        }
     }
   }

/** 
 * merges two arrays
 * Taken from jQuery 1.5
 */
P1PP.merge = function( first, second ) {
  		var i = first.length,
  			j = 0;
  		if ( typeof second.length === "number" ) {
  			for ( var l = second.length; j < l; j++ ) {
  				first[ i++ ] = second[ j ];
  			}
  		} else {
  			while ( second[j] !== undefined ) {
  				first[ i++ ] = second[ j++ ];
  			}
  		}
  		first.length = i;
  		return first;
  	}
/**
 * Array diff
 */
P1PP.diff = function(first, second){
      return first.filter(function(i) {return !(second.indexOf(i) > -1);});
    }
