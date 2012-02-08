define(['editor/panes', 'editor/ui', 'plugins', 'util/dom', 'util/type', 'util/url'],
function (panes, ui, plugins, dom, type, url) {


	function convertToIframe (textarea) {
		var iframe = document.createElement('iframe'),
			iframedoc = null,
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

		// TODO: Improve this very simple auto-scaling
		iframe.style.width = textarea.offsetWidth + 'px';
		iframe.style.height = textarea.offsetHeight + 'px';

		textarea.style.display = 'none';
		textarea.parentNode.insertBefore(iframe, textarea);

		iframedoc = iframe.contentWindow.document;
		iframedoc.open();
		iframedoc.write(htmlContent);
		iframedoc.close();

		return iframe;
	}


	/**
	 * Utility function for inspecting script elements to find the base URL to this
	 * script. Used for referencing static CSS and image files packaged with the editor.
	 * @return String
	 */
	function findBaseUrl () {
		var scripts = document.getElementsByTagName('script'),
			len = scripts.length, i = 0,
			baseUrl;
		for ( ; i < len; i++) {
			if ((baseUrl = scripts[i].getAttribute('src') || '').indexOf('mojoeditor') !== -1) {
				baseUrl = url.basePath(baseUrl);
				if (!url.isAbsolute(baseUrl)) {
					baseUrl = url.concat(window.location.pathname, baseUrl);
				}
				return baseUrl;
			}
			else if ((baseUrl = scripts[i].getAttribute('data-main') || '') === 'src/main') {
				return url.concat(window.location.pathname, '/src/');
			}
		}
	}


	/**
	 * TODO: Comment me!
	 */
	var ContentEditor = function (iframe, opts) {
		this.window = iframe.contentWindow;
		this.document = iframe.contentWindow.document;
		this.opts = type.extend({}, ContentEditor.defaults, opts);

		this.listenerQueue = [];
		this.panes = null;
		this.ui = {};

		function loadDependencies (callback) {
			// TODO: Make sure every browser implicitly creates a head element if it's missing
			var self = this,
				header = this.document.getElementsByTagName('head').item(0),	
				numDependencies = 2;

			function onload (dependency) {
				if (--numDependencies === 0 && typeof callback === "function") {
					callback.call(self);
				}
			}

			dom.injectStyleSheet(header, this.opts.root + 'css/editor.css');
			dom.injectJavaScript(header, this.opts.ckeditor, onload);
			dom.injectJavaScript(header, this.opts.jquery, onload);
		}

		function init () {
			var self = this,
				$ = this.window.jQuery;

			this.panes = panes.init(this.window);
			if (typeof opts.imageUploadUrl !== "undefined") {
				this.panes.setEditorOption("filebrowserImageUploadUrl", opts.imageUploadUrl);
			}

			this.ui = ui.init(this);

			/*
			 * Since internet explorer does not have an importNode function
			 * we create one for it instead.
			 */
			if (typeof this.document.importNode == 'undefined') {
				dom.assignCustomImportNode(this.document);
			}

			// Prevents the user from "leaving" the content editor.
			$('a:not([editable])').live('click', function (e) {
				e.preventDefault();
			});
			$('form').live('submit', function (e) {
				e.preventDefault();
			});

			// Register each plugin
			$.each(plugins, function (i, plugin) {
				plugin.register(self);
			});

			if (this.listenerQueue.length > 0) {
				var i = 0, len = this.listenerQueue.length;
				for ( ; i < len; i++) {
					$(this.window).on(this.listenerQueue[i].e, this.listenerQueue[i].fn);
				}
				delete this.listenerQueue;
			}
			
			loading.parentNode.removeChild(loading);
			this.trigger('initialized.editor');
		}

		var loading = this.document.createElement('div'),
			loadingInfo = this.document.createElement('div');

		loading.setAttribute('style', 'position: absolute; left: 0; top: 0; z-index: 9999; background-color: #ffffff; background-color: rgba(255, 255, 255, 0.9)');
		loading.style.width = this.window.innerWidth + 'px';
		loading.style.height = this.window.innerHeight + 'px';

		loadingInfo.setAttribute('style', 'font: 13px Helvetica, Arial, sans-serif; color: #444444; text-align: center');
		loadingInfo.style.paddingTop = (this.window.innerHeight / 2 - 20) + 'px';

		loadingInfo.appendChild(this.document.createTextNode('Laster inn editor...'));
		loading.appendChild(loadingInfo);
		this.document.body.appendChild(loading);

		loadDependencies.call(this, function () { init.call(this); });
	};
	ContentEditor.defaults = {
		root: findBaseUrl(),
		ckeditor: 'http://static.mailmojo/js/lib/ckeditor/ckeditor.js',
		jquery: 'http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'
	};

	/**
	 * Handles a save event from an EditorPane. Saves the current content in the
	 * WYSIWYG editor back into the element being edited.
	 *
	 * @param Event e
	 * @param EditorPane editorPane The pane which triggered the save event.
	 */
	ContentEditor.prototype.handleSave = function (e, editorPane) {
		this.restore(editorPane.getElement(), editorPane.editor.getData());
		this.trigger('contentchanged.editor');
	};

	/**
	 * Handles a cancel event from an EditorPane. Cancels editing by restoring current
	 * element being edited to it's original state.
	 *
	 * @param Event e
	 * @param EditorPane editorPane The pane which triggered the cancel event.
	 */
	ContentEditor.prototype.handleCancel = function (e, editorPane) {
		this.restore(editorPane.getElement());
	};

	/**
	 * Restores an element from being edited to it's normal state, optionally replacing it's
	 * contents.
	 *
	 * @param HTMLElement | jQuery element The element to restore.
	 * @param String newContent            HTML with new content, if any.
	 */
	ContentEditor.prototype.restore = function (element, newContent) {
		var $ = this.window.jQuery,
			$element = $(element);
		// Removes the dimmed overlay. XXX: Let plugins handle?
		//this.toggleOverlay(false);

		if (typeof newContent !== 'undefined') {
			$element.html(newContent);
			this.cleanup(element);
		}
	};

	/**
	 * Performs some pre-processing of the content inside an element, cleaning up attributes
	 * after being edited in CKEditor.
	 * Currently only finds and cleans all images.
	 *
	 * @param HTMLElement element The element to cleanup contents of.
	 */
	ContentEditor.prototype.cleanup = function (element) {
		var $element = this.window.jQuery(element);
		$element.find('img').each(function () {
			// TODO: Implement, should be factored out someplace...
			//cleanupImage(this);
		});
	};

	/**
	 * Displays/hides an overlay behind the editor panel after clicking on an editable element. Makes
	 * it impossible to click on other editables when having an edit panel open.
	 *
	 * @param bool enable
	 */
	ContentEditor.prototype.toggleOverlay = function (enable) {
		if (enable) {
			this.window.jQuery('body').append(this.ui.overlay);
		}
		else {
			this.ui.overlay.remove();
		}
	};

	/**
	 * Returns an EditorPane of a specific type. If a pane of this type has been created
	 * earlier, the existing instance is returned. Otherwise a new instance is created.
	 *
	 * @param String type Type of the EditorPane, currently either 'Block' or 'Inline' is
	 *                    supported.
	 * @param Object opts Extra options for the editorpane which is used when creating a
	 *                    new instance.
	 * @return EditorPane
	 */
	ContentEditor.prototype.getEditorPane = function (type, opts) {
		var self = this;

		opts = opts || {};

		return this.panes.getInstance(type, {
			save: function (e, pane) {
				self.handleSave(e, pane);
				if (typeof opts.handleSave !== "undefined") {
					opts.handleSave(self, pane);
				}
			},
			cancel: function (e, pane) {
				self.handleCancel(e, pane);
				if (typeof opts.handleCancel !== "undefined") {
					opts.handleCancel(self, pane);
				}
			},
			ready: (typeof opts.ready !== "undefined" ? opts.ready : null)
		});
	};

	/**
	 * Return the currently open EditorPane, if any.
	 *
	 * @return EditorPane
	 */
	ContentEditor.prototype.getCurrentEditorPane = function () {
		return this.panes.getCurrent();
	};


	/*
	 * PUBLIC INTERFACE.
	 */
	
	/**
	 * Returns all content from the editor, without any custom editor
	 * HTML.
	 * @return String HTML code from editor.
	 */
	ContentEditor.prototype.getContent = function () {
		var
			$ = this.window.jQuery,
			$clones = $(this.window.document).children().clone(false),
			$fragment = null,
			html = '';

		// Strip out our custom content in the <head>
		$clones = $clones.find("meta[name='SKYPE_TOOLBAR'], script, link").remove().end();

		// Create a document fragment <div> with the content, clean up and return HTML
		$fragment = $('<div/>').append($clones)
				// Remove Content Editor elements
				.find('div.mm-editor, div.mm-add, div.mm-overlay')
					.remove().end()
				.find('span.mm-edit, span.mm-remove')
					.remove().end()
				.find('img.mm-edit')
					.remove().end()
				// Remove CKEditor elements
				.find('div[id^=cke_], div[class^=cke_]')
					.remove().end();

		// Let plugins clean up content too
		this.trigger('filtercontent.editor', [$fragment]);

		html = $fragment.html();

		// Strip XML prolog which is injected by Internet Explorer
		if ($.browser.msie) {
			html = html.replace(/<\?xml[^>]+>/gi, '');
		}
		return html;
	};

	ContentEditor.prototype.on = function (event, callback) {
		if (typeof this.listenerQueue === "undefined") {
			this.window.jQuery(this.window).on(event, callback);
		}
		else {
			this.listenerQueue.push({ e: event, fn: callback });
		}
		return this;
	};

	/**
	 * Convenience alias for triggering global events in the editor context.
	 */
	ContentEditor.prototype.trigger = function (event) {
		var $window = this.window.jQuery(this.window),
			args = Array.prototype.slice.call(arguments);
		$window.trigger.apply($window, args);
	};	

	return {
		/**
		 * Initializes a Content Editor from a textarea or iframe
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
		 *                       'imageUploadUrl': URI to support uploading images to.
		 * @returns ContentEditor
		 */
		init: function (el, opts) {
			if (el.nodeName.toLowerCase() == 'textarea') {
				el = convertToIframe(el);
			}			

			return new ContentEditor(el, opts);
		},

		addPlugin: function (plugin) {
			if (!plugin.hasOwnProperty('register')) {
				throw new Exception("Invalid plugin signature.");
			}
			plugins.push(plugin);
		}
	};
});
