define(['../util/dom'], function (dom) {
	var $, LinksManager;

	LinksManager = function (editor) {
		this.editor = editor;

		$('a[editable]').click($.proxy(this.editLink, this));
	};

	/**
	 * Initializes editing of an editable link element. Re-uses the WYSIWYGs link dialog.
	 *
	 * @param Event e
	 */
	LinksManager.prototype.editLink = function (e) {
		var self = this,
			original = e.target,
			pane;

		e.preventDefault();
		e.stopPropagation();

		// TODO: Clean up when we don't have to manually remove edited elements from CKEditor
		function getEditedLink () {
			var
				/**
				 * @var CKEDITOR.dom.element
				 */
				link = pane.getSelectedElement.call(this, 'a');
			return link;
		}

		/**
		 * Handles OK event from a dialog, retrieving edited link and making sure the
		 * original link is updated.
		 *
		 * @scope CKEDITOR.dialog('link')
		 */
		function handleOk () {
			var link = getEditedLink.call(this);
			/*
			 * The edited element is owned by the CKEditor document, so we need to import
			 * it into our content editor document for using it further.
			 */
			self.updateLink(original, document.importNode(link.$, true));
		}

		/**
		 * Handles hide event from a dialog, cleaning up our link specific listeners.
		 */
		function handleHide () {
			this.removeListener('ok', handleOk);
			this.removeListener('hide', handleHide);
		}

		// Display an image dialog within the inline editor
		pane = this.editor.getEditorPane('Inline', {
			ready: function () {
				this.showDialog('link', original, function (dialog) {
					dialog.on('ok', handleOk);
					/*
					 * Add onHide listener with priority 1, so we're called before the
					 * default handler in the link dialog. This enables us to clean up our
					 * stuff before the link dialog cleans up and removes some elements.
					 */
					dialog.on('hide', handleHide, null, null, 1);
				});
			}
		});
	};

	/**
	 * Updates an inline editable link with the new href attribute value, and title, style
	 * and class attributes in case they've been edited as well.
	 *
	 * @param DOMElement original The original link element being edited.
	 * @param DOMElement edited   The edited copy of the link element.
	 */
	LinksManager.prototype.updateLink = function (original, edited) {
		var	newHref = edited.getAttribute('data-cke-saved-href') || edited.getAttribute('href');

		original.setAttribute('href', newHref);

		dom.updateAttribute(original, 'class', edited.getAttribute('class'));
		dom.updateAttribute(original, 'title', edited.getAttribute('title'));
		// jQuery normalizes style attribute access in all browsers
		dom.updateAttribute(original, 'style', $(edited).attr('style'));

		this.editor.trigger('contentchanged.editor');
	};

	return {
		register: function (editor) {
			if (typeof $ === "undefined") {
				$ = editor.window.jQuery;
			}
			new LinksManager(editor);
		}
	};
});
