define(function () {
	var jQuery, EditablesManager,
		/**
		 * List of editable elements which supports block editing.
		 * Internet Explorer does not support namespaces, so match without namespace for it.
		 * @var Array
		 */
		BLOCK_ELEMENTS = ['mm:content'], //$.support.namespaces ? ['mm:content'] : ['content'],
		/**
		 * HTML for creating an image with the edit icon.
		 * @var String
		 */
		editIconHtml = '<img src="' + 'http://static.mailmojo' +
				'/img/icons/edit.png" alt="Rediger" />';

	/**
	 * Determines if an element is one of the block editable elements.
	 *
	 * @param HTMLElement | jQuery The element or jQuery selection to test.
	 * @return Boolean
	 */
	function isBlockElement (element) {
		if (typeof element.jquery !== 'undefined') {
			element = element[0];
		}
		return (jQuery.inArray(element.nodeName.toLowerCase(), BLOCK_ELEMENTS) !== -1);
	}

	EditablesManager = function (editor) {
		this.editor = editor;

		var $editButton = jQuery('<span class="mm-edit" />').append(editIconHtml);

		jQuery(EditablesManager.SELECTOR)
			.append($editButton)
			.find('span.mm-edit')
				.click(jQuery.proxy(this.edit, this));
	};

	EditablesManager.SELECTOR = "h1[editable], h2[editable], h3[editable], " +
			"h4[editable], h5[editable], h6[editable], td[editable], p[editable], span[editable], " +
			"mm\\:content, content";

	/**
	 * Initializes editing of an element's content in a WYSIWYG editor.
	 *
	 * @param Event e
	 */
	EditablesManager.prototype.edit = function (e) {
		var
			$button = jQuery(e.target).closest('.mm-edit'),
			$container = $button.parent(),
			type = isBlockElement($container) ? 'Block' : 'Inline';
		// Adds an overlay to the background
		//toggleOverlay(true);

		// Makes it impossible to open a new dialog, when a dialog is already open.
		if (this.editor.getCurrentEditorPane() !== null) {
			return false;
		}

		// Remove edit button from the content to be edited
		$button.remove();

		// Get a reference for an appropriate editor pane and display it
		this.editor.getEditorPane(type/*, editorPaneOpts*/)
			.setElement($container).show();
	}

	return {
		register: function (editor) {
			jQuery = editor.window.jQuery;
			new EditablesManager(editor);
		}
	};
});
