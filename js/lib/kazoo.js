(function () {
    var kazoo = {
    		config: {
				paths: {
					AC_OETags: 'js/lib/AC_OETags.js',
					SIPml5: 'js/lib/SIPml-api-1.2.185.js',
					VideoIO11: 'js/lib/VideoIO11'
				},
    		},
    		rtmp: {},
    		webrtc: {}
    	},
    	WS_URL = 'ws://10.26.0.41:8080',
    	RTMP_URL = '10.26.0.41';

	/* params expected
		forceRTMP: Optional, if set to true, will use the flash player no matter what browser is used
		realm: SIP Realm
		privateIdentity: Private Identity
		publicIdentity: Public Identity
		password: SIP Password
		onCall: callback function when a new call is detected
	*/
    kazoo.init = function(params) {
		kazoo.params = params;

		if(kazoo.params.forceRTMP) {
			getRTMP();
		}
		else {
			getSupportedVersion();
		}

		function getSupportedVersion() {
    		if(!window.mozRTCPeerConnection && !navigator.webkitGetUserMedia){
				getRTMP();
			}
			else {
				getSIPml5();
			}
		};

		function getRTMP() {
			function getFlashMovie(movieName) {
    			var isIE = navigator.appName.indexOf("Microsoft") != -1;
    			return (isIE) ? window[movieName] : document[movieName];
			}

			if(getFlashMovie('video1') === undefined) {
				$.getScript(kazoo.config.paths.AC_OETags, function(data, textStatus, jqxhr) {
					var hasProductInstall = DetectFlashVer(6, 0, 65),
                		hasVersion10 = DetectFlashVer(10, 0, 0),
                		hasVersion10_3 = DetectFlashVer(10, 3, 0),
                		hasVersion11 = DetectFlashVer(11, 0, 0);

					var flashHTML = '';

            		if (hasProductInstall && !hasVersion10) {
                		var MMPlayerType = (isIE == true) ? "ActiveX" : "PlugIn";
                		var MMredirectURL = window.location;
                		document.title = document.title.slice(0, 47) + " - Flash Player Installation";
                		var MMdoctitle = document.title;

                		flashHTML = AC_FL_RunContent(
                    		"src", "playerProductInstall",
                    		"FlashVars", "MMredirectURL="+MMredirectURL+'&MMplayerType='+MMPlayerType+'&MMdoctitle='+MMdoctitle+"",
                    		"width", "0",
                    		"height", "0",
                    		"align", "middle",
                        	"wmode", "transparent",
                    		"id", "video1",
                    		"quality", "high",
                    		"bgcolor", "#000000",
                    		"name", "video1",
                    		"allowScriptAccess","always",
                    		"type", "application/x-shockwave-flash",
                    		"pluginspage", "http://www.adobe.com/go/getflashplayer"
                		);
            		}
            		else if (hasVersion10) {
                		 flashHTML = AC_FL_RunContent(
                        		"src", kazoo.config.paths.VideoIO11,
                        		"width", "0",
                        		"height", "0",
                        		"wmode", "transparent",
                        		"align", "middle",
                        		"id", "video1",
                        		"quality", "high",
                        		"bgcolor", "#000000",
                        		"name", "video1",
                        		"allowScriptAccess","always",
                        		"allowFullScreen","true",
                        		"type", "application/x-shockwave-flash",
                        		"pluginspage", "http://www.adobe.com/go/getflashplayer"
                		);
            		}
            		else {
                		flashHTML = 'This content requires the Adobe Flash Player. <a href=http://www.adobe.com/go/getflash/>Get Flash</a>';
            		}

            		document.getElementById('videoPlayer').innerHTML = flashHTML;
            		kazoo.version = 'rtmp';
            		kazoo.rtmp.container = document.getElementById('videoPlayer');

					var testTimer = setInterval(function () {
            			if (typeof getFlashMovie('video1').setProperty === 'function') {
                			clearInterval(testTimer);

                			initFlash();
            			}
        			},
        			500);
				});
        	}

			function initFlash() {
				var server = RTMP_URL,
			    	user = params.privateIdentity + '@' + params.realm,
			    	authname = params.privateIdentity,
			    	authpass = params.password,
			    	displayname = params.publicIdentity,
			    	rate = 8,
			    	rateName = 'narrowband';

				var phone = getFlashMovie('video1'),
			    	srcValue = 'rtmp://' +server+ '/sip/' +user+ '?rate=' +rate+ '&bidirection=true' + '&arg=' +authname+ '&arg=' +authpass+ '&arg=' +displayname+ '&arg=' +rateName;

				phone.setProperty('src', srcValue);

				kazoo.rtmp.phone = phone;

				params.onLogin && params.onLogin();

				onCallback = function(event) {
					console.log(event);
					switch(event.method) {
						case 'invited': {
							var call = {
								accept: function() {
									phone.callProperty('call', 'accept'); // To accept
								},
								reject: function() {
									phone.callProperty('call', 'reject', '486 Busy Here'); // to reject
								},
								callerName: event.args[0]
							};

							params.onCall && params.onCall(call);

							break;
						}
						case 'accepted': {
							phone.setProperty('publish', 'local');
							phone.setProperty('play', 'remote');

							params.onAccepted && params.onAccepted();
							break;
						}
						case 'byed': {
							phone.setProperty('publish', null);
							phone.setProperty('play', null);

							params.onHangup && params.onHangup();

							break;
						}
						default: {
							break;
						}
					}
				}
			};
		};

		function getSIPml5() {
    		$.getScript(kazoo.config.paths.SIPml5, function(data, textStatus, jqxhr) {
    			var oReadyStateTimer = setInterval(function () {
            		if (document.readyState === 'complete') {
                		clearInterval(oReadyStateTimer);
                		// initialize SIPML5
                		SIPml.init(postInit);
            		}
        		},
        		500);

    			var postInit = function() {
    				if (SIPml.isWebRtcSupported()) {
    					kazoo.version = 'webrtc';

						var eventsListener = function(e) {
							console.log(e);
							switch(e.type) {
								case 'started': {
									login();

									params.started && params.started();

									break;
								}
								case 'i_new_message': {
									acceptMessage(e);

									params.newMessage && params.newMessage();

									break;
								}
					 			case 'i_new_call': {
									var call = {
											accept: function() {
												acceptCall(e);

												params.onAccepted() && params.onAccepted();
											},
											reject: function() {
												rejectCall(e);
											},
											callerName: e.o_event.o_message.o_hdr_From.s_display_name
										};

									params.onCall && params.onCall(call);

									break;
								}
								case 'connected': {
									var response = {
										status: kazoo.webrtc.registerSession
									};

									params.onLogin && params.onLogin(response);

									break;
								}
								case 'terminated': {
									if('currentCall' in kazoo.webrtc) {
										kazoo.webrtc.currentCall = null;

										params.onHangup && params.onHangup(response);
									}

									break;
								}
								case 'stopped': {
									kazoo.webrtc.sipStack = null;
									kazoo.webrtc.registerSession = null;
									kazoo.webrtc.currentCall = null;

									params.onLogout && params.onLogout();

									break;
								}
								default: {
									break;
								}
							}
						};

						function createSipStack() {
							kazoo.webrtc.sipStack = new SIPml.Stack({
                        		realm: params.realm,
                        		impi: params.privateIdentity,
                        		impu: params.publicIdentity,
                        		password: params.password,
                        		websocket_proxy_url: WS_URL,
                        		outbound_proxy_url: null,
                    			ice_servers: [],
                    			enable_rtcweb_breaker: false,
                    			enable_early_ims: true, // Must be true unless you're using a real IMS network
                    			enable_media_stream_cache: false,
                    			bandwidth: null, // could be redefined a session-level
                    			video_size:null, // could be redefined a session-level
                        		events_listener: { events: '*', listener: eventsListener }
                    		});
						};

						function acceptCall(e) {
							kazoo.webrtc.currentCall = e.newSession;
							kazoo.webrtc.currentCall.extra = {
								startTime: (new Date()).getTime()
							};

							e.newSession.accept();
						};

						function rejectCall(e) {
							e.newSession.reject();
						};

						function login() {
							kazoo.webrtc.registerSession = kazoo.webrtc.sipStack.newSession('register', {
								events_listener: { events: '*', listener: eventsListener }
							});

							kazoo.webrtc.registerSession.register();
						};

						createSipStack();

                		kazoo.webrtc.sipStack.start();
					}
					else {
						alert('browser not supported');
					}
				}
    		});
		};
    };

    kazoo.hangup = function() {
    	if(kazoo.version === 'webrtc') {
			kazoo.webrtc.currentCall.hangup();
		}
		else if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'bye');
			kazoo.rtmp.phone.setProperty('publish', null);
			kazoo.rtmp.phone.setProperty('play', null);
		}
    };

    kazoo.logout = function() {
    	if(kazoo.version === 'webrtc') {
			kazoo.webrtc.sipStack.stop();
		}
		else if(kazoo.version === 'rtmp') {
			kazoo.rtmp.container.innerHTML = '';

			kazoo.params.onLogout && kazoo.params.onLogout();
		}
    };

    kazoo.call = function(destination) {
		if(kazoo.version === 'webrtc') {
			if(!kazoo.webrtc.currentCall) {
				kazoo.webrtc.currentCall = kazoo.webrtc.sipStack.newSession('call-audio');
				kazoo.webrtc.currentCall.call(destination);

				/* SIPml5 doesnt trigger an event when the call is accepted, so we'll assume it always is */
				kazoo.params.onAccepted && kazoo.params.onAccepted();
			}
		}
		else if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'invite', destination);
		}
    };

	window.kazoo = kazoo;
}());
