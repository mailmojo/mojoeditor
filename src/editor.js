define(['util/dom', 'plugins'], function (dom, plugins) {
	var editorIndex = 0;

	function convertToIframe (textarea) {
		var iframe = document.createElement('iframe'),
			htmlContent = textarea.value,
			// TODO: This should be supported for pre-rendered iframes too
			skypeMetaTag = '<meta name="SKYPE_TOOLBAR" content="SKYPE_TOOLBAR_PARSER_COMPATIBLE" />\n';
		
		/*
		 * Fix custom self-closing tags to HTML supported elements with separate closing tag.
		 * This is to avoid DOM related errors about non-closed non-empty elements according
		 * to the DTD, which can prevent JavaScript execution in at least WebKit (Safari/Chrome).
		 * All custom empty tags will be saved as self-closing in the template editor.
		 */
		htmlContent = htmlContent.replace(/<mm:(from|date|subject)([^>]*?)\s*\/>/gi,
				'<mm:$1$2></mm:$1>');

		/*
		 * We inject a skype meta tag here because Skype has a toolbar that injects lots
		 * of new html content and styles on different kind of phone number patterns. So
		 * we inject a meta tag for disabling this nasty feature. This meta tag is tested
		 * in IE7,8 and FF on windows and should work. We don't need to make an explicit
		 * removal of this tag, because this tag is not injected when we don't have a
		 * template, and when we have a template, the contents inside head tag is never
		 * updated with the stuff from the content editor when saved.
		 */
		htmlContent = htmlContent.replace(/<head([^>]*)>/gi, '<head$1>\n' + skypeMetaTag);

		textarea.style.display = 'none';
		textarea.parentNode.insertBefore(iframe, textarea);

		iframe.contentDocument.open();
		iframe.contentDocument.write(htmlContent);
		iframe.contentDocument.close();

		return iframe;
	}

	/**
	 * Creates a script element referring to an external JavaScript file, and injects it into
	 * the element specified.
	 *
	 * @param HTMLElement element Element to inject script into.
	 * @param String file         URL, relative or absolute, of JavaScript file.
	 * @param Function fn         Callback when script has loaded.
	 * @return HTMLScriptElement
	 */
	function injectJavaScript (element, file, fn) {
		var script = element.ownerDocument.createElement('script');

		script.setAttribute('type', 'text/javascript');

		if (typeof fn == 'function') {
			script.onreadystatechange = script.onload = function (e) {
				e = e || element.ownerDocument.parentWindow.event;

				/*
				 * For readystatechange events we need to check for both 'complete' and 'loaded'
				 * states. Internet Explorer may report either one of them, depending on how
				 * the file was loaded (i.e. from cache or server).
				 */
				if (e.type == 'load'
						|| (e.type == 'readystatechange' &&
								(script.readyState == 'complete' || script.readyState == 'loaded'))) {
					fn(e);
					// We don't want to trigger both onreadystatechange and onload in a browser.
					script.onreadystatechange = script.onload = null;
				}
			};
		}

		script.setAttribute('src', file);
		return element.appendChild(script);
	}

	var defaults = {
		ckeditor: 'http://static.mailmojo/js/lib/ckeditor/ckeditor.js',
		jquery: 'http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'
	};


	var ContentEditor = function (iframe, opts) {
		this.iframe = iframe;
		this.window = iframe.contentWindow;
		this.opts = opts;
		this.initialized = false;
		this.listenerQueue = [];

		function loadDependencies (callback) {
			// TODO: Make sure every browser implicitly creates a head element if it's missing
			var self = this,
				header = this.iframe.contentDocument.getElementsByTagName('head').item(0),
				numDependencies = 2;

			function onload (dependency) {
				if (--numDependencies === 0 && typeof callback === "function") {
					callback.call(self);
				}
			}

			injectJavaScript(header, this.opts.ckeditor, onload);
			injectJavaScript(header, this.opts.jquery, onload);
		}

		function init () {
			var self = this,
				$ = this.window.jQuery;

			/*
			 * Since internet explorer does not have an importNode function
			 * we create one for it instead.
			 */
			if (typeof this.iframe.contentDocument.importNode == 'undefined') {
				dom.assignCustomImportNode(this.iframe.contentDocument);
			}

			// Prevents the user from "leaving" the content editor.
			$('a:not([editable])').live('click', function (e) {
				e.preventDefault();
			});
			$('form').live('submit', function (e) {
				e.preventDefault();
			});

			// LOAD PLUGINS FOR FEATURES
			$.each(plugins, function (i, plugin) {
				plugin.register(self);
			});

			if (this.listenerQueue.length > 0) {
				var i = 0, len = this.listenerQueue.length;
				for ( ; i < len; i++) {
					$(this.window).on(this.listenerQueue[i].e, this.listenerQueue[i].fn);
				}
			}

			this.initialized = true;
			$(this.window).trigger('initialized.editor');
		}

		loadDependencies.call(this, function () { init.call(this); });
	};

	ContentEditor.prototype.on = function (event, callback) {
		if (this.initialized) {
			this.window.jQuery(this.window).on(event, callback);
		}
		else {
			this.listenerQueue.push({ e: event, fn: callback });
		}
	};

	return {
		/**
		 * Initializes a MailMojo Content Editor from a textarea or iframe
		 * element. Textareas are expected to contain HTML code and it will be
		 * replaced by an iframe where the HTML is injected into. Iframes are then
		 * initialized with required JavaScript libraries and CSS for a fully
		 * functionaly editor.
		 *
		 * The Content Editor has settings too, some of which are required. Specifically
		 * this is URLs for the 3rd party JavaScript dependencies, CKEditor and jQuery.
		 *
		 * @param HTMLElement el The textarea or iframe element to convert into an editor.
		 * @param Object opts    Settings for external dependencies, callbacks and custom
		 *                       behaviour. Following are all available settings:
		 *
		 *                       'ckeditor': URI to CKEditor library,
		 *                       'jquery': URI to jQuery library.
		 *                       'onchange': Callback after changes made by the user using
		 *                                   the content editor.
		 * @returns ContentEditor
		 */
		init: function (el, opts) {
			// TODO: Support merging
			opts = opts || defaults;

			if (el.nodeName.toLowerCase() == 'textarea') {
				el = convertToIframe(el);
			}			

			return new ContentEditor(el, opts);
		}
	};
});
