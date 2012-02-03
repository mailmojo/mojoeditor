define(['util/datetime'], function (datetime) {
	var jQuery,
		DYNAMIC_ELEMENTS = "mm\\:date, date, mm\\:from, from, mm\\:subject, subject, mm\\:share, share";

	/**
	 * Checks if an element contains any child nodes or text nodes containing text other than
	 * white space.
	 *
	 * @param HTMLElement element The element to check for emptyness.
	 * @return Boolean TRUE if the element has no child nodes or only contains one text node
	 *                 with only whitespace. FALSE otherwise.
	 */
	function isEmptyElement (element) {
		var nodes = element.childNodes,
			num = nodes.length;

		return (num == 0
				|| (num == 1 && nodes[0].nodeValue && nodes[0].nodeValue.match(/^\s*$/)));
	}

	/**
	 * Adds default placeholder content while editing for elements which will be replaced by
	 * dynamic content before actually sending the mailing.
	 * It also takes care to not replace custom content in <mm:share> elements with placeholder
	 * content.
	 * Used as a callback for jQuery.fn.each.
	 *
	 * @param Number i            Index among all dynamic elements.
	 * @param HTMLElement element The dynamic element to add placeholder content for.
	 */
	function addDefaultContent (i, element) {
		// Normalize element name (without namespace) to how Explorer reports it
		var name = element.nodeName.toLowerCase().replace('mm:', ''),
			isEmpty = isEmptyElement(element),
			content = null;

		switch (name) {
			case 'share':
				try {
					content = new CE.ShareService(element, !isEmpty).getButton();
					// This method of copying inline styles also works in IE7
					content.style.cssText = element.style.cssText;
				}
				catch (e) {}
				break;

			case 'date':
				var
					dateFormat = element.getAttribute('format'),
					lang = element.getAttribute('lang') || 'no';

				// TODO: Import locale...
				//datetime.strftime.setText(MailMojo.ContentEditor.Locales[lang]);
				content = datetime.strftime(dateFormat);
				break;

			case 'subject':
				content = '[Emne kommer her]';
				break;

			case 'from':
				content = '[Avsendernavn kommer her]';
				break;
		}

		if (content) {
			if (typeof content === 'string') {
				content = document.createTextNode(content);
			}
			element.appendChild(content);
		}
	}

	/**
	 * Removes all default placeholder content in dynamic content elements.
	 * Used as a callback for jQuery.fn.each before returning the complete mailing content.
	 *
	 * @param Number i            Index among all dynamic elements.
	 * @param HTMLElement element The dynamic element to remove placeholder content for.
	 */
	function removeDefaultContent (i, element) {
		// Normalize element name (without namespace) to how Explorer reports it
		var name = element.nodeName.toLowerCase().replace('mm:', ''),
			$element = jQuery(element);

		switch (name) {
			case 'share':
				/*
				 * For share elements with custom content, just remove the placeholder link
				 * and leave the custom content inside the share element. Otherwise we empty
				 * the element completely as with other default content.
				 */
				if ($element.hasClass('custom')) {
					var $link = $element.children('a');

					$element.append($link.contents());
					$link.remove();
					break;
				}

			case 'date':
			case 'subject':
			case 'from':
				$element.empty();
				break;
		}
	}


	return {
		register: function (editor) {
			jQuery = editor.window.jQuery;

			jQuery(DYNAMIC_ELEMENTS).each(addDefaultContent);

			editor.on('filtercontent.editor', function () {
				return this
					.find(DYNAMIC_ELEMENTS)
						.each(removeDefaultContent)
					.end();
			});
		}
	};
});
