Strophe.addConnectionPlugin("xdomainrequest", {
	init: function () {
		if (window.XDomainRequest) {
			Strophe.debug("using XdomainRequest for IE");
			
			// override thee send method to fire readystate 2
			XDomainRequest.prototype.oldsend = XDomainRequest.prototype.send;
			XDomainRequest.prototype.send = function() {
				XDomainRequest.prototype.oldsend.apply(this, arguments);
				this.readyState = 2;
				try {
					this.onreadystatechange();
				} catch (e) {}
			};
			
			// replace Strophe.Request._newXHR with the xdomainrequest version
			Strophe.Request.prototype._newXHR = function () {
				var fireReadyStateChange = function (xhr, status) {
					xhr.status = status;
					xhr.readyState = 4;
					try {
						xhr.onreadystatechange();
					} catch (e) {}
				};
				var xhr = new XDomainRequest();
				
				xhr.readyState = 0;
				xhr.onreadystatechange = this.func.prependArg(this);
				xhr.onload = function () {
					xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
					xmlDoc.async = "false";
					xmlDoc.loadXML(xhr.responseText);
					xhr.responseXML = xmlDoc;
					fireReadyStateChange(xhr, 200);
				};
				xhr.onerror = function () {
					fireReadyStateChange(xhr, 500);
				};
				xhr.ontimeout = function () {
					fireReadyStateChange(xhr, 500);
				};
				return xhr;
			}
			
		} else {
			Strophe.error("XDomainRequest not found. Falling back to native XHR implementation.");
		}
	}
});
