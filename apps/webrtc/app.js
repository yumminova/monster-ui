define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		toastr = require('toastr');
	require('kazoo');

	var app = {

		name: 'webrtc',

		i18n: [ 'en-US' ],

		requests: {
		},

		subscribe: {
			'webrtc.activate': 'render'
		},

		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			/* Used to init the auth token and account id */
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container){
			var self = this;

			self._render(container);
		},

		bindEvents: function(template) {
			var self = this;

			template.find('#login').on('click', function(e) {
				var formData = form2object('form_init');

				self.initPhoneInTheBrowser(formData, template);
			});

			template.find('#call').on('click', function(e) {
				var destination = template.find('#destination').val();

				kazoo.call(destination);
			});

			template.find('#hangup').on('click', function(e) {
				kazoo.hangup();

				template.find('.oncall-wrapper').hide();
				toastr.success('Your call ended properly');
			});

			template.find('#logout').on('click', function(e) {
				kazoo.logout();
			});
		},

		initPhoneInTheBrowser: function(params, template) {
			var self = this,
				onLogin = function(session) {
					template.find('#status').html('Connected');

					template.find('#login').hide();
					template.find('#logout').show();
					template.find('.logged-wrapper').show();
				},
				onLogout = function(session) {
					template.find('#status').html('Disconnected');
					template.find('#logout').hide();
					template.find('#login').show();

					template.find('.oncall-wrapper').hide();
					template.find('.logged-wrapper').hide();
				},
				onCall = function(call) {
					monster.ui.confirm(call.callerName + ' is trying to call you, do you want to take the call?', function() {
						call.accept();
					},
					call.reject);
				},
				onAccepted = function() {
					template.find('.oncall-wrapper').show();
				},
				onHangup = function() {
					template.find('.oncall-wrapper').hide();

					toastr.success('Your call ended properly');
				},
				params = $.extend(true, {
					//forceRTMP: true,
					onAccepted: onAccepted,
					onCall: onCall,
					onLogin: onLogin,
					onLogout: onLogout,
					onHangup: onHangup
				}, params);

			kazoo.init(params);
		},

		// subscription handlers
		_render: function(container) {
			var self = this,
				container = container || $('#ws-content'),
				dataTemplate = {},
				template = $(monster.template(self, 'app', dataTemplate));

			self.bindEvents(template);

			container
				.empty()
				.append(template);
		}
	};

	return app;
});
